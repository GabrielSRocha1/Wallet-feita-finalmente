import {
    createTransaction,
    signTransaction,
    getSignatureFromTransaction
} from 'gill';

import { Connection, PublicKey } from '@solana/web3.js';

import {
    rpc as staticRpc,
    PROGRAM_IDS,
    sendAndConfirmTransaction as staticSend,
    DEFAULT_NETWORK
} from './solana-config';

// Helper para obter o ID do programa correto
const getProgramId = (network: 'mainnet' | 'devnet' = DEFAULT_NETWORK) => {
    return PROGRAM_IDS[network];
}

// Helper para obter RPC correto (da injeção ou static fallback)
const getRpc = (injectedRpc?: any) => {
    return injectedRpc || staticRpc;
}

// Busca informações de vesting do usuário
export const getUserVestingInfo = async (publicKey: string, network: 'mainnet' | 'devnet' = DEFAULT_NETWORK, injectedRpc?: any) => {
    try {
        const currentRpc = getRpc(injectedRpc);
        const programId = getProgramId(network);

        // TODO: Usar programId na query se necessário (ex: getProgramAccounts)
        // Por enquanto, apenas busca info da conta do usuário

        // @ts-ignore - Supressão para typings do gill
        const accountInfoResponse = await currentRpc.getAccountInfo(publicKey).send();
        const accountInfo = accountInfoResponse?.value;

        // VERIFICAÇÃO DE SEGURANÇA: Conta Vazia (Zombie Account)
        if (!accountInfo) {
            console.warn(`[Vesting] Conta ${publicKey} não encontrada no ledger.`);
            return null;
        }

        if (accountInfo.data.length === 0 || (Array.isArray(accountInfo.data) && accountInfo.data[0] === "")) {
            console.warn(`[Vesting] Conta ${publicKey} é uma System Account sem dados de programa.`);
            return null;
        }

        // Validação se a conta pertence ao programa correto
        if (accountInfo.owner !== programId) {
            console.error(`[Security Violation] Conta ${publicKey} pertence ao owner ${accountInfo.owner}, esperado ${programId}`);
            return null;
        }

        // Parse dos dados do programa...

        return {
            totalLocked: 0,
            totalUnlocked: 0,
            nextUnlock: null,
            tokens: []
        };
    } catch (error) {
        console.error('Erro ao buscar vesting:', error);
        return null;
    }
};

// Busca saldo de tokens SPL
export const getTokenBalance = async (tokenAccount: string, injectedRpc?: any) => {
    try {
        const currentRpc = getRpc(injectedRpc);
        // @ts-ignore
        const balance = await currentRpc.getTokenAccountBalance(tokenAccount).send();
        return {
            amount: balance.value.amount,
            decimals: balance.value.decimals,
            uiAmount: balance.value.uiAmount
        };
    } catch (error) {
        console.error('Erro ao buscar saldo:', error);
        return { amount: '0', decimals: 0, uiAmount: 0 };
    }
};

// Cria transação de claim
export const createClaimTransaction = async (
    wallet: any,
    vestingAccount: string,
    network: 'mainnet' | 'devnet' = DEFAULT_NETWORK
) => {
    const programId = getProgramId(network);
    // Implementar instrução de claim usando programId correto
    // const instruction = createClaimInstruction(vestingAccount, wallet.publicKey, programId);

    // const transaction = createTransaction({ version: 0 });
    // transaction.add(instruction);

    return null;
};

// Envia transação e realiza validação de 3 camadas
export const executeTransactionWith3LayerValidation = async (
    connection: Connection,
    wallet: any,
    transaction: any,
    validationConfig: {
        targetAccount: PublicKey;
        expectedOwner?: PublicKey;
        validatorFn: (accountInfo: any | null) => boolean;
        commitment?: 'confirmed' | 'finalized';
    }
) => {
    const { targetAccount, validatorFn, commitment = 'confirmed' } = validationConfig;
    let signature: string | null = null;

    try {
        // CAMADA 1: SUBMISSÃO (Submission)
        console.group('🔒 Layer 1: Transaction Submission');
        const signed = await signTransaction([wallet], transaction);
        signature = getSignatureFromTransaction(signed);

        if (!signature) throw new Error("Falha ao obter assinatura da transação");

        console.log(`Assinatura gerada: ${signature}`);

        // Envio raw (usando connection diretamente para ter controle)
        // Serializa a transação assinada
        const rawTransaction = signed.serialize ? signed.serialize() : signed;

        // Nota: Se 'signed' for do tipo do 'gill' ou 'web3.js', a serialização pode variar.
        // Assumindo compatibilidade com sendRawTransaction do connection.
        // Se 'signed' não for Buffer, precisamos garantir a serialização correta.
        // O helper 'sendAndConfirmTransaction' do gill já faz isso, podemos usar ele para 1 e 2.
        // Mas para controle total das camadas, vamos usar o sender estático ou injetado.

        await staticSend(signed, { commitment }); // Cobre Camada 1 e parte da 2 (espera confirmação básica)
        console.log('✅ Layer 1 Validada: Transação enviada ao mempool.');
        console.groupEnd();

        // CAMADA 2: CONFIRMAÇÃO (Confirmation polling)
        console.group('⏳ Layer 2: Network Confirmation');
        console.log(`Aguardando confirmação (${commitment})...`);

        const latestBlockhash = await connection.getLatestBlockhash();
        const confirmStrategy = {
            blockhash: latestBlockhash.blockhash,
            lastValidBlockHeight: latestBlockhash.lastValidBlockHeight,
            signature: signature
        };

        const confirmation = await connection.confirmTransaction(confirmStrategy, commitment);

        if (confirmation.value.err) {
            throw new Error(`Falha na confirmação on-chain: ${JSON.stringify(confirmation.value.err)}`);
        }

        console.log('✅ Layer 2 Validada: Bloco confirmado.');
        console.groupEnd();

        // CAMADA 3: VALIDAÇÃO DE ESTADO (State Verification)
        console.group('🔎 Layer 3: State Verification (Proof)');
        console.log(`Verificando estado da conta: ${targetAccount.toString()}...`);

        let attempts = 0;
        const maxAttempts = 5;
        let verified = false;

        while (attempts < maxAttempts && !verified) {
            attempts++;
            // Delay exponencial para permitir propagação
            await new Promise(r => setTimeout(r, 1000 * attempts));

            const accountInfo = await connection.getAccountInfo(targetAccount, commitment);

            if (validatorFn(accountInfo)) {
                verified = true;
                console.log(`✅ Layer 3 Validada: Estado verificado na tentativa ${attempts}.`);
            } else {
                console.warn(`Tentativa ${attempts} falhou na validação de estado. Retentando...`);
            }
        }

        if (!verified) {
            throw new Error("Transação confirmada, mas o estado on-chain não reflete as mudanças esperadas (Timeout de validação).");
        }
        console.groupEnd();

        return { success: true, signature, verified: true };

    } catch (error: any) {
        console.error("❌ Falha na validação de 3 camadas:", error);
        console.groupEnd();
        return { success: false, error: error.message, signature };
    }
};

// Envia transação (Legacy Wrapper)
// injectedSendFn permite injetar a função de envio do contexto se necessário
export const sendTransaction = async (wallet: any, transaction: any, injectedSendFn?: any) => {
    try {
        // Nota: Se estiver usando Wallet Adapter no frontend, a assinatura deve ser feita via wallet.signTransaction
        // Este método assume que 'wallet' é um Signer (Keypair) com chave privada (Backend/Admin)

        const signed = await signTransaction([wallet], transaction);
        const signature = getSignatureFromTransaction(signed);

        const sender = injectedSendFn || staticSend;

        await sender(signed, {
            commitment: 'confirmed'
        });

        return { success: true, signature };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
};

// Alias para compatibilidade retroativa (nome antigo: releaseTransaction)
export const releaseTransaction = sendTransaction;
