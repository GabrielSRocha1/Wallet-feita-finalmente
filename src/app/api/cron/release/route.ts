
import { Connection, Keypair, PublicKey, Transaction, TransactionInstruction } from '@solana/web3.js';
import { Program, AnchorProvider, Wallet, BN } from '@coral-xyz/anchor';
import type { Idl } from '@coral-xyz/anchor';
import { NextRequest, NextResponse } from 'next/server';
import { getAssociatedTokenAddress, TOKEN_PROGRAM_ID } from '@solana/spl-token';

// Use the correct Program ID from config or hardcoded if needed
// This should match declare_id! in lib.rs
const PROGRAM_ID = new PublicKey("HMqYLNw1ABgVeFcP2PmwDv6bibcm9y318aTo2g25xQMm");

// Configuração do RPC e Wallet (Admin/Relayer)
const RPC_URL = process.env.NEXT_PUBLIC_SOLANA_RPC_URL || 'https://api.devnet.solana.com';
// RELAYER_PRIVATE_KEY is a JSON array string e.g. "[12,34,...]"
const RELAYER_PRIVATE_KEY = process.env.RELAYER_PRIVATE_KEY;

// IDL Atualizado para o novo VestingContract
const IDL: any = {
    "version": "0.1.0",
    "name": "verum_vesting",
    "instructions": [
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

export async function GET(request: NextRequest) {
    if (!RELAYER_PRIVATE_KEY) {
        return NextResponse.json({ error: 'RELAYER_PRIVATE_KEY not configured' }, { status: 500 });
    }

    try {
        // Setup Connection e Wallet
        const connection = new Connection(RPC_URL, 'confirmed');
        let relayerKeypair: Keypair;
        try {
            relayerKeypair = Keypair.fromSecretKey(
                Uint8Array.from(JSON.parse(RELAYER_PRIVATE_KEY))
            );
        } catch (e) {
            return NextResponse.json({ error: 'Invalid RELAYER_PRIVATE_KEY format' }, { status: 500 });
        }

        const wallet = new Wallet(relayerKeypair);
        const provider = new AnchorProvider(connection, wallet, { commitment: 'confirmed' });

        // @ts-ignore
        const program = new Program(IDL, PROGRAM_ID, provider);

        console.log("Iniciando processo de liberação automática (VestingContract)...");

        // 1. Buscar todas as contas de Vesting
        // @ts-ignore
        const vestingAccounts = await program.account.vestingContract.all();
        console.log(`Encontradas ${vestingAccounts.length} contas de vesting.`);

        const results: any[] = [];

        // 2. Iterar e verificar se pode liberar
        for (const account of vestingAccounts) {
            try {
                const data = account.account;
                const pubkey = account.publicKey;

                const currentTime = Math.floor(Date.now() / 1000);

                // Check releasedAmount vs totalAmount
                // Using BN comparison
                const total = new BN(data.totalAmount);
                const released = new BN(data.releasedAmount);
                const start = new BN(data.startTime).toNumber();

                if (released.gte(total)) {
                    // Already fully released
                    continue;
                }

                // Só processa se já começou
                if (currentTime < start) continue;

                // Tentar liberar
                const beneficiary = new PublicKey(data.beneficiary);
                const mint = new PublicKey(data.mint);

                // Derivar ATA do beneficiário
                const beneficiaryTokenAccount = await getAssociatedTokenAddress(mint, beneficiary);

                // Derivar Escrow PDA ["escrow", vestingContract]
                const [escrowWallet] = PublicKey.findProgramAddressSync(
                    [Buffer.from("escrow"), pubkey.toBuffer()],
                    PROGRAM_ID
                );

                // Check if there is anything to release (simple check to save RPC calls)
                // We could replicate `calculate_vested_amount` here, but for now let's just try calling the instruction
                // if it's past start time. The contract will error if nothing to release.
                // Optimally we'd pre-calculate to avoid error spam.

                console.log(`Tentando liberar para contrato ${pubkey.toString()}...`);

                const tx = await program.methods.claimTokens()
                    .accounts({
                        vestingContract: pubkey,
                        escrowWallet: escrowWallet,
                        beneficiaryTokenAccount: beneficiaryTokenAccount,
                        tokenProgram: TOKEN_PROGRAM_ID
                    })
                    .rpc();

                console.log(`Sucesso! TX: ${tx}`);
                results.push({ account: pubkey.toString(), status: 'success', tx });

            } catch (err: any) {
                // Determine if it's "NothingToRelease" error
                // VestingError::NothingToRelease is usually code 6000 or custom.
                // We'll log it as 'info' if it's just nothing to release vs an actual error.
                const msg = err.message || JSON.stringify(err);
                if (msg.includes("NothingToRelease") || msg.includes("0x1770")) { // 0x1770 = 6000 dec
                    // Expected error if just checking too often
                    // results.push({ account: account.publicKey.toString(), status: 'skipped', reason: 'NothingToRelease' });
                } else {
                    console.error(`Erro ao processar conta ${account.publicKey.toString()}:`, msg);
                    results.push({ account: account.publicKey.toString(), status: 'error', error: msg });
                }
            }
        }

        return NextResponse.json({
            success: true,
            processed: results.length,
            details: results
        });

    } catch (error: any) {
        console.error("Erro geral no script de automação:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
