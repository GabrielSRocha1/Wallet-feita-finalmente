import {
    Connection,
    PublicKey,
    Transaction,
    SystemProgram,
    SYSVAR_RENT_PUBKEY,
} from '@solana/web3.js';
import { Program, AnchorProvider, BN } from '@coral-xyz/anchor';
import type { Idl } from '@coral-xyz/anchor';
import { getAssociatedTokenAddress, TOKEN_PROGRAM_ID } from '@solana/spl-token';
import { PROGRAM_IDS, DEFAULT_NETWORK } from './solana-config';

// -------------------------------------------------------------------------
// IDL DEFINITION (Based on lib.rs)
// -------------------------------------------------------------------------
const IDL: any = {
    "version": "0.1.0",
    "name": "verum_vesting",
    "instructions": [
        {
            "name": "createVesting",
            "accounts": [
                { "name": "vestingContract", "isMut": true, "isSigner": false },
                { "name": "creator", "isMut": true, "isSigner": true },
                { "name": "beneficiary", "isMut": false, "isSigner": false },
                { "name": "mint", "isMut": false, "isSigner": false },
                { "name": "escrowWallet", "isMut": true, "isSigner": false },
                { "name": "senderTokenAccount", "isMut": true, "isSigner": false },
                { "name": "systemProgram", "isMut": false, "isSigner": false },
                { "name": "tokenProgram", "isMut": false, "isSigner": false },
                { "name": "rent", "isMut": false, "isSigner": false }
            ],
            "args": [
                { "name": "contractId", "type": "u64" },
                { "name": "totalAmount", "type": "u64" },
                { "name": "startTime", "type": "i64" },
                { "name": "endTime", "type": "i64" },
                { "name": "vestingType", "type": { "defined": "VestingType" } }
            ]
        },
        {
            "name": "claimTokens",
            "accounts": [
                { "name": "vestingContract", "isMut": true, "isSigner": false },
                { "name": "escrowWallet", "isMut": true, "isSigner": false },
                { "name": "beneficiaryTokenAccount", "isMut": true, "isSigner": false },
                { "name": "tokenProgram", "isMut": false, "isSigner": false }
            ],
            "args": []
        }
    ],
    "accounts": [
        {
            "name": "VestingContract",
            "type": {
                "kind": "struct",
                "fields": [
                    { "name": "creator", "type": "publicKey" },
                    { "name": "beneficiary", "type": "publicKey" },
                    { "name": "mint", "type": "publicKey" },
                    { "name": "totalAmount", "type": "u64" },
                    { "name": "releasedAmount", "type": "u64" },
                    { "name": "startTime", "type": "i64" },
                    { "name": "endTime", "type": "i64" },
                    { "name": "contractId", "type": "u64" },
                    { "name": "vestingType", "type": { "defined": "VestingType" } },
                    { "name": "bump", "type": "u8" }
                ]
            }
        }
    ],
    "types": [
        {
            "name": "VestingType",
            "type": {
                "kind": "enum",
                "variants": [
                    { "name": "Linear" },
                    { "name": "Cliff" }
                ]
            }
        }
    ]
};

// -------------------------------------------------------------------------
// HELPER: CREATE VESTING TRANSACTION
// -------------------------------------------------------------------------
export interface CreateVestingParams {
    wallet: any; // Wallet Adapter Context
    connection: Connection;
    recipientAddress: string;
    mintAddress: string;
    startTime: number; // Unix timestamp in seconds
    durationSeconds: number;
    cliffSeconds: number; // Not used in Linear/Cliff simple enum but kept for signature compatibility
    amount: number; // Raw amount
    decimals: number;
    revocable: boolean; // Not used in simplified struct
    network?: 'mainnet' | 'devnet';
}

export const createVestingTransaction = async (params: CreateVestingParams) => {
    const {
        wallet,
        connection,
        recipientAddress,
        mintAddress,
        startTime,
        durationSeconds,
        cliffSeconds, // Ignored for now in this strict implementation
        amount,
        decimals,
        revocable,
        network = DEFAULT_NETWORK
    } = params;

    if (!wallet.publicKey) throw new Error("Carteira não conectada.");

    const programId = new PublicKey(PROGRAM_IDS[network]);
    const sender = wallet.publicKey;
    const recipient = new PublicKey(recipientAddress);
    const mint = new PublicKey(mintAddress);

    // 1. Generate unique Contract ID (using timestamp to ensure uniqueness per user/mint collision avoidance)
    // In production, maybe use a counter or random, but Date.now() is decent for this MVP.
    const contractId = new BN(Date.now());

    // 2. Derive Vesting Contract PDA
    // seeds = ["vesting", beneficiary, mint, contract_id]
    const [vestingContractPda] = PublicKey.findProgramAddressSync(
        [
            Buffer.from("vesting"),
            recipient.toBuffer(),
            mint.toBuffer(),
            contractId.toArrayLike(Buffer, 'le', 8)
        ],
        programId
    );

    // 3. Derive Escrow PDA
    // seeds = ["escrow", vesting_contract]
    const [escrowPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("escrow"), vestingContractPda.toBuffer()],
        programId
    );

    // 4. Get Sender's Token Account
    const senderTokenAccount = await getAssociatedTokenAddress(mint, sender);

    // 5. Setup Provider
    const provider = new AnchorProvider(
        connection,
        {
            publicKey: sender,
            signTransaction: wallet.signTransaction,
            signAllTransactions: wallet.signAllTransactions,
        } as any,
        { commitment: 'confirmed' }
    );

    // @ts-ignore
    const program = new Program(IDL, programId, provider);

    // 6. Prepare Args
    const amountBn = new BN(amount);
    const startTimeBn = new BN(startTime);
    const endTimeBn = new BN(startTime + durationSeconds);
    const vestingType = { linear: {} }; // Default to Linear

    console.log(`Creating vesting PDA: ${vestingContractPda.toString()}`);

    // 6. Build Transaction
    try {
        const tx = await program.methods
            .createVesting(
                contractId,
                amountBn,
                startTimeBn,
                endTimeBn,
                vestingType
            )
            .accounts({
                vestingContract: vestingContractPda,
                creator: sender,
                beneficiary: recipient,
                mint: mint,
                escrowWallet: escrowPda,
                senderTokenAccount: senderTokenAccount,
                systemProgram: SystemProgram.programId,
                tokenProgram: TOKEN_PROGRAM_ID,
                rent: SYSVAR_RENT_PUBKEY,
            })
            .transaction();

        // 7. Sign and Send
        tx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
        tx.feePayer = sender;

        const signedTx = await wallet.signTransaction(tx);
        const signature = await connection.sendRawTransaction(signedTx.serialize());

        await connection.confirmTransaction(signature, 'confirmed');
        console.log("Vesting criado com sucesso! Signature:", signature);

        return {
            success: true,
            signature,
            vestingAccount: vestingContractPda.toString(),
            vault: escrowPda.toString()
        };

    } catch (error: any) {
        console.error("Erro ao criar vesting on-chain:", error);
        throw error;
    }
};

// -------------------------------------------------------------------------
// HELPER: CLAIM TOKENS TRANSACTION (Manual Release)
// -------------------------------------------------------------------------
export const releaseTransaction = async (
    wallet: any,
    connection: Connection,
    vestingAccountAddress: string,
    network: 'mainnet' | 'devnet' = DEFAULT_NETWORK
) => {
    if (!wallet.publicKey) throw new Error("Carteira não conectada.");

    const programId = new PublicKey(PROGRAM_IDS[network]);
    const vestingContractPda = new PublicKey(vestingAccountAddress);

    const provider = new AnchorProvider(
        connection,
        {
            publicKey: wallet.publicKey,
            signTransaction: wallet.signTransaction,
            signAllTransactions: wallet.signAllTransactions,
        } as any,
        { commitment: 'confirmed' }
    );
    // @ts-ignore
    const program = new Program(IDL, programId, provider);

    try {
        // 1. Fetch Account Data to get Mint/Beneficiary
        // @ts-ignore
        const vestingContract = await program.account.vestingContract.fetch(vestingContractPda);

        const beneficiary = vestingContract.beneficiary;
        const mint = vestingContract.mint;

        // 2. Derive Escrow PDA
        const [escrowPda] = PublicKey.findProgramAddressSync(
            [Buffer.from("escrow"), vestingContractPda.toBuffer()],
            programId
        );

        // 3. Get Beneficiary Token Account
        const beneficiaryTokenAccount = await getAssociatedTokenAddress(
            mint,
            beneficiary
        );

        console.log(`Reivindicando de: ${vestingContractPda.toString()} para ${beneficiaryTokenAccount.toString()}`);

        const transaction = new Transaction();

        // 3.1 Check if ATA exists, if not, create it
        const accountInfo = await connection.getAccountInfo(beneficiaryTokenAccount);
        if (!accountInfo) {
            console.log("ATA do beneficiário não existe. Adicionando instrução de criação...");
            const { createAssociatedTokenAccountInstruction } = await import('@solana/spl-token');
            transaction.add(
                createAssociatedTokenAccountInstruction(
                    wallet.publicKey, // Payer
                    beneficiaryTokenAccount, // Associated Token Account
                    beneficiary, // Owner
                    mint // Mint
                )
            );
        }

        // 4. Execute Claim
        const claimIx = await program.methods.claimTokens()
            .accounts({
                vestingContract: vestingContractPda,
                escrowWallet: escrowPda,
                beneficiaryTokenAccount: beneficiaryTokenAccount,
                tokenProgram: TOKEN_PROGRAM_ID,
            })
            .instruction();

        transaction.add(claimIx);

        transaction.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
        transaction.feePayer = wallet.publicKey;

        const signedTx = await wallet.signTransaction(transaction);
        const signature = await connection.sendRawTransaction(signedTx.serialize());

        await connection.confirmTransaction(signature, 'confirmed');
        console.log("Claim realizado com sucesso!", signature);

        return { success: true, signature };
    } catch (e: any) {
        console.error("Erro no Release:", e);
        throw e;
    }
};

// -------------------------------------------------------------------------
// HELPER: CLAIM TOKENS (User Requested Integration)
// -------------------------------------------------------------------------
export const claimTokens = async (
    connection: Connection,
    wallet: any,
    vestingPDA: PublicKey,
    mint: PublicKey,
    network: 'mainnet' | 'devnet' = DEFAULT_NETWORK
) => {
    const programId = new PublicKey(PROGRAM_IDS[network]);

    // Setup Anchor Provider
    const provider = new AnchorProvider(
        connection,
        {
            publicKey: wallet.publicKey,
            signTransaction: wallet.signTransaction,
            signAllTransactions: wallet.signAllTransactions,
        } as any,
        { commitment: 'confirmed' }
    );
    // @ts-ignore
    const program = new Program(IDL, programId, provider);

    // Derive Escrow PDA correctly (not ATA)
    const [escrowWallet] = PublicKey.findProgramAddressSync(
        [Buffer.from("escrow"), vestingPDA.toBuffer()],
        programId
    );

    // Get Beneficiary ATA
    const beneficiaryTokenAccount = await getAssociatedTokenAddress(
        mint,
        wallet.publicKey
    );

    const transaction = new Transaction();

    const claimIx = await program.methods
        .claimTokens()
        .accounts({
            vestingContract: vestingPDA,
            escrowWallet: escrowWallet, // Corrected from escrowAta
            beneficiaryTokenAccount: beneficiaryTokenAccount,
            tokenProgram: TOKEN_PROGRAM_ID,
        })
        .instruction();

    transaction.add(claimIx);

    // Custom send to match user pattern or use wallet adapter
    transaction.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
    transaction.feePayer = wallet.publicKey;

    const signedTx = await wallet.signTransaction(transaction);
    const signature = await connection.sendRawTransaction(signedTx.serialize());

    await connection.confirmTransaction(signature, "confirmed");
    return signature;
};

// Re-export helpers
export const getProgramId = (network: 'mainnet' | 'devnet' = DEFAULT_NETWORK) => {
    return PROGRAM_IDS[network];
}

