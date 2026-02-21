// utils/createTransaction.ts
import { Program, BN } from '@project-serum/anchor';
import { Connection, PublicKey, SystemProgram, Transaction } from '@solana/web3.js';
import { detectTokenProgram } from './tokenProgram';
import {
    getAssociatedTokenAddress,
    createAssociatedTokenAccountIdempotentInstruction
} from '@solana/spl-token';

const TOKEN_2022_PROGRAM_ID = new PublicKey("TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb");


/**
 * Helper para criar e enviar a transação de criação de vesting.
 * Centraliza a lógica de detecção de programa de token e derivação de contas.
 */
export const createVestingTransaction = async (
    program: Program,
    connection: Connection,
    params: {
        contractId: number | BN;
        totalAmount: number | BN;
        startTime: number | BN;
        endTime: number | BN;
        vestingType: any;
        mintAddress: string;
        creator: PublicKey;
        beneficiary: PublicKey;
    }
) => {
    const {
        contractId,
        totalAmount,
        startTime,
        endTime,
        vestingType,
        mintAddress,
        creator,
        beneficiary
    } = params;

    try {
        const mintPubkey = new PublicKey(mintAddress);

        // 1. Detectar automaticamente o programa correto (SPL ou Token-2022)
        const tokenProgramId = await detectTokenProgram(connection, mintAddress);


        // 2. Derivar as contas necessárias (PDAs e ATAs)
        const idBN = contractId instanceof BN ? contractId : new BN(contractId);

        // PDA do Contrato de Vesting
        const [vestingContract] = PublicKey.findProgramAddressSync(
            [
                Buffer.from("vesting"),
                creator.toBuffer(),
                mintPubkey.toBuffer(),
                idBN.toArrayLike(Buffer, "le", 8)
            ],
            program.programId
        );

        // PDA da Carteira Escrow (Vault)
        const [escrowWallet] = PublicKey.findProgramAddressSync(
            [Buffer.from("escrow"), vestingContract.toBuffer()],
            program.programId
        );

        // ATA do Criador
        const senderTokenAccount = await getAssociatedTokenAddress(
            mintPubkey,
            creator,
            false,
            tokenProgramId
        );

        // 3. Montar a transação
        const transaction = new Transaction();

        // Garantir que a ATA do Criador existe
        transaction.add(
            createAssociatedTokenAccountIdempotentInstruction(
                creator,
                senderTokenAccount,
                creator,
                mintPubkey,
                tokenProgramId
            )
        );

        // Instrução do Contrato
        const ix = await program.methods
            .createVesting(
                idBN,
                totalAmount instanceof BN ? totalAmount : new BN(totalAmount),
                startTime instanceof BN ? startTime : new BN(startTime),
                endTime instanceof BN ? endTime : new BN(endTime),
                vestingType
            )
            .accounts({
                vestingContract,
                creator: creator,
                beneficiary: beneficiary,
                mint: mintPubkey,
                escrowWallet,
                senderTokenAccount,
                systemProgram: SystemProgram.programId,
                tokenProgram: tokenProgramId, // detectado dinamicamente — Interface<TokenInterface>
            })
            .instruction();

        transaction.add(ix);

        // 🧪 SIMULAÇÃO — revela erros reais antes de enviar
        const simulation = await connection.simulateTransaction(transaction);
        console.log('[createTransaction] simulação:', JSON.stringify(simulation, null, 2));
        if (simulation.value.err) {
            console.error('[createTransaction] ❌ Erro na simulação:', simulation.value.err);
            console.error('[createTransaction] Logs do programa:', simulation.value.logs);
            throw new Error(`Simulação falhou: ${JSON.stringify(simulation.value.err)}\n\nLogs:\n${simulation.value.logs?.join('\n')}`);
        }

        // Enviar transação usando o provider do Anchor (que lida com a assinatura da wallet)
        const txSignature = await (program.provider as any).sendAndConfirm(transaction);

        return { tx: txSignature, vestingContract: vestingContract.toBase58() };
    } catch (error) {
        console.error('Erro ao criar transação de vesting:', error);
        throw error;
    }
};
