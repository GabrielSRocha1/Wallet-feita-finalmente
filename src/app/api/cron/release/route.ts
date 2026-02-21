export const runtime = "nodejs";

import { NextRequest, NextResponse } from 'next/server';

// O IDL agora usa 'writable' em vez de 'isMut' para compatibilidade com versões novas do Anchor
const IDL: any = {
    "version": "0.1.0",
    "name": "verum_vesting",
    "instructions": [
        {
            "name": "claimTokens",
            "accounts": [
                { "name": "vestingContract", "writable": true, "signer": false },
                { "name": "escrowWallet", "writable": true, "signer": false },
                { "name": "beneficiaryTokenAccount", "writable": true, "signer": false },
                { "name": "beneficiary", "writable": false, "signer": false },
                { "name": "tokenProgram", "writable": false, "signer": false },
                { "name": "token2022Program", "writable": false, "signer": false }
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
    const RELAYER_PRIVATE_KEY = process.env.RELAYER_PRIVATE_KEY;
    if (!RELAYER_PRIVATE_KEY) {
        return NextResponse.json({ error: 'RELAYER_PRIVATE_KEY not configured' }, { status: 500 });
    }

    try {
        // Importações dinâmicas para evitar erro de build do Turbopack
        const { Connection, Keypair, PublicKey, Transaction } = await import('@solana/web3.js');
        const { Program, AnchorProvider } = await import('@coral-xyz/anchor');
        const { getAssociatedTokenAddress, createAssociatedTokenAccountIdempotentInstruction } = await import('@solana/spl-token');

        const PROGRAM_ID = new PublicKey("HMqYLNw1ABgVeFcP2PmwDv6bibcm9y318aTo2g25xQMm");
        const RPC_URL = process.env.NEXT_PUBLIC_SOLANA_RPC_URL || 'https://api.devnet.solana.com';

        const connection = new Connection(RPC_URL, 'confirmed');
        const relayerKeypair = Keypair.fromSecretKey(Uint8Array.from(JSON.parse(RELAYER_PRIVATE_KEY)));

        // Mock de Wallet para evitar NodeWallet não exportado
        const wallet = {
            publicKey: relayerKeypair.publicKey,
            signTransaction: async (tx: any) => {
                tx.partialSign(relayerKeypair);
                return tx;
            },
            signAllTransactions: async (txs: any[]) => {
                return txs.map(tx => {
                    tx.partialSign(relayerKeypair);
                    return tx;
                });
            }
        };

        const provider = new AnchorProvider(connection, wallet as any, { commitment: 'confirmed' });
        // Na v0.30+, o Program recebe idl e provider. O programId deve estar no IDL ou passado separadamente se necessário
        const program = new Program(IDL, provider);

        const splTokenProgramId = new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA");
        const token2022ProgramId = new PublicKey("TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb");

        console.log("[Relayer] Buscando contratos de vesting...");
        // Usando as any para evitar erro de tipo no account namespace
        const vestingAccounts = await (program.account as any).vestingContract.all();
        console.log(`[Relayer] Encontrados ${vestingAccounts.length} contratos.`);

        const results = [];
        const currentTime = Math.floor(Date.now() / 1000);

        for (const record of vestingAccounts) {
            try {
                const contract = record.account as any;
                const contractPubkey = record.publicKey;

                if (contract.isCancelled || contract.releasedAmount.gte(contract.totalAmount)) {
                    continue;
                }

                if (currentTime < contract.startTime.toNumber()) {
                    continue;
                }

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

                const transaction = new Transaction();
                transaction.add(
                    createAssociatedTokenAccountIdempotentInstruction(
                        relayerKeypair.publicKey,
                        beneficiaryTokenAccount,
                        contract.beneficiary,
                        contract.mint,
                        tokenProgramId
                    )
                );

                const claimIx = await program.methods.claimTokens()
                    .accounts({
                        vestingContract: contractPubkey,
                        escrowWallet,
                        beneficiaryTokenAccount,
                        beneficiary: contract.beneficiary,
                        tokenProgram: splTokenProgramId,
                        token2022Program: token2022ProgramId,
                    } as any)
                    .instruction();

                transaction.add(claimIx);

                const tx = await provider.sendAndConfirm(transaction);

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
