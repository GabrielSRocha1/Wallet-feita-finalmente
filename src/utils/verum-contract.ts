import {
    createTransaction,
    signTransaction,
    getSignatureFromTransaction,
    sendAndConfirmTransaction
} from 'gill';

import { rpc, VERUM_PROGRAM_ID } from './solana-config';

// Busca informações de vesting do usuário
export const getUserVestingInfo = async (publicKey: string) => {
    try {
        // Implementar chamada ao programa Verum
        // Exemplo com gill:
        // @ts-ignore - Supressão de TS temporária pois a tipagem da gill pode variar
        const accountInfo = await rpc.getAccountInfo(publicKey).send();

        // Parse dos dados do programa (ajuste conforme seu IDL)
        // const vestingData = parseVestingData(accountInfo.data);

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
export const getTokenBalance = async (tokenAccount: string) => {
    try {
        // @ts-ignore
        const balance = await rpc.getTokenAccountBalance(tokenAccount).send();
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

// Cria transação de claim (resgatar tokens desbloqueados)
export const createClaimTransaction = async (wallet: any, vestingAccount: string) => {
    // Implementar instrução de claim do programa Verum
    // const instruction = createClaimInstruction(vestingAccount, wallet.publicKey);

    // const transaction = createTransaction({ version: 0 });
    // transaction.add(instruction);

    return null;
};

// Envia transação
export const sendTransaction = async (wallet: any, transaction: any) => {
    try {
        // Nota: Se estiver usando Wallet Adapter no frontend, a assinatura deve ser feita via wallet.signTransaction
        // Este método assume que 'wallet' é um Signer (Keypair) com chave privada
        const signed = await signTransaction([wallet], transaction);
        const signature = getSignatureFromTransaction(signed);

        await sendAndConfirmTransaction(rpc, signed, {
            commitment: 'confirmed'
        });

        return { success: true, signature };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
};
