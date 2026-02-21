export const runtime = "nodejs";

import { Connection, Keypair, PublicKey, Transaction } from '@solana/web3.js';
import { Program, AnchorProvider, NodeWallet, Idl, BN } from '@coral-xyz/anchor';
import { NextRequest, NextResponse } from 'next/server';
import { getAssociatedTokenAddress, createAssociatedTokenAccountIdempotentInstruction } from '@solana/spl-token';

const PROGRAM_ID = new PublicKey("HMqYLNw1ABgVeFcP2PmwDv6bibcm9y318aTo2g25xQMm");
const RPC_URL = process.env.NEXT_PUBLIC_SOLANA_RPC_URL || 'https://api.devnet.solana.com';
const RELAYER_PRIVATE_KEY = process.env.RELAYER_PRIVATE_KEY;

// IDL atualizado com base no lib.rs mais recente
const IDL: Idl = {
    "version": "0.1.0",
    "name": "verum_vesting",
    "instructions": [
        {
            "name": "claimTokens",
            "accounts": [
                { "name": "vestingContract", "isMut": true, "isSigner": false },
                { "name": "escrowWallet", "isMut": true, "isSigner": false },
                { "name": "beneficiaryTokenAccount", "isMut": true, "isSigner": false },
                { "name": "beneficiary", "isMut": false, "isSigner": false },
                { "name": "tokenProgram", "isMut": false, "isSigner": false },
                { "name": "token2022Program", "isMut": false, "isSigner": false }
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
                    { "name": "bump", "type": "u8" },
                    { "name": "isCancelled", "type": "bool" },
                    { "name": "isToken2022", "type": "bool" }
                ]
            }
        }
    ],
    "types": [
        {
            "name": "VestingType",
            "type": {
                "kind": "enum",
                "variants": [{ "name": "Linear" }, { "name": "Cliff" }]
            }
        }
    ]
};

export async function GET(request: NextRequest) {
    if (!RELAYER_PRIVATE_KEY) {
        return NextResponse.json({ error: 'RELAYER_PRIVATE_KEY not configured' }, { status: 500 });
    }

    try {
        const connection = new Connection(RPC_URL, 'confirmed');
        const relayerKeypair = Keypair.fromSecretKey(Uint8Array.from(JSON.parse(RELAYER_PRIVATE_KEY)));
        const wallet = new NodeWallet(relayerKeypair);
        const provider = new AnchorProvider(connection, wallet, { commitment: 'confirmed' });
        const program = new Program(IDL, PROGRAM_ID, provider);

        const splTokenProgramId = new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA");
        const token2022ProgramId = new PublicKey("TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb");

        console.log("[Relayer] Buscando contratos de vesting...");
        const vestingAccounts = await program.account.vestingContract.all();
        console.log(`[Relayer] Encontrados ${vestingAccounts.length} contratos.`);

        const results = [];
        const currentTime = Math.floor(Date.now() / 1000);

        for (const record of vestingAccounts) {
            try {
                const contract = record.account as any;
                const contractPubkey = record.publicKey;

                // 1. Filtros básicos
                if (contract.isCancelled || contract.releasedAmount.gte(contract.totalAmount)) {
                    continue;
                }

                // 2. Verificar se há algo para liberar (simulação simplificada do cálculo do contrato)
                if (currentTime < contract.startTime.toNumber()) {
                    continue;
                }

                // 3. Preparar contas para claim
                const tokenProgramId = contract.isToken2022 ? token2022ProgramId : splTokenProgramId;

                const beneficiaryTokenAccount = await getAssociatedTokenAddress(
                    contract.mint,
                    contract.beneficiary,
                    false,
                    tokenProgramId
                );

                const [escrowWallet] = PublicKey.findProgramAddressSync(
                    [Buffer.from("escrow"), contractPubkey.toBuffer()],
                    PROGRAM_ID
                );

                console.log(`[Relayer] Processando claim para: ${contractPubkey.toBase58()}`);

                // 4. Montar a transação
                const transaction = new Transaction();

                // Garantir que a ATA do beneficiário existe (Idempotent)
                transaction.add(
                    createAssociatedTokenAccountIdempotentInstruction(
                        relayerKeypair.publicKey, // Relayer paga o rent da ATA se necessário
                        beneficiaryTokenAccount,
                        contract.beneficiary,
                        contract.mint,
                        tokenProgramId
                    )
                );

                // Instrução do Contrato
                const claimIx = await program.methods.claimTokens()
                    .accounts({
                        vestingContract: contractPubkey,
                        escrowWallet,
                        beneficiaryTokenAccount,
                        beneficiary: contract.beneficiary,
                        tokenProgram: splTokenProgramId,
                        token2022Program: token2022ProgramId,
                    })
                    .instruction();

                transaction.add(claimIx);

                // Enviar usando o provider para automatizar sign/confirm
                const tx = await (program.provider as any).sendAndConfirm(transaction);

                console.log(`[Relayer] Sucesso: ${tx}`);
                results.push({ contract: contractPubkey.toBase58(), tx });

            } catch (err: any) {
                console.error(`[Relayer] Erro no contrato ${record.publicKey.toBase58()}:`, err.message);
                results.push({ contract: record.publicKey.toBase58(), error: err.message });
            }
        }

        return NextResponse.json({
            success: true,
            processed: results.length,
            details: results
        });

    } catch (error: any) {
        console.error("[Relayer] Erro geral:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
