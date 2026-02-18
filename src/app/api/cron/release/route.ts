
import { Connection, Keypair, PublicKey, Transaction, TransactionInstruction } from '@solana/web3.js';
import { Program, AnchorProvider, Wallet, Idl } from '@project-serum/anchor';
import { NextRequest, NextResponse } from 'next/server';
import * as anchor from '@project-serum/anchor';

// Nota: Você precisará copiar o IDL do contrato para este arquivo ou importá-lo
// Como não temos o IDL buildado localmente no Windows, vou usar uma definição simplificada ou carregar do arquivo se existir.
// Para este exemplo, vou assumir uma estrutura básica.

const PROGRAM_ID = new PublicKey("HMqYLNw1ABgVeFcP2PmwDv6bibcm9y318aTo2g25xQMm");

// Configuração do RPC e Wallet (Admin/Relayer)
// Você deve configurar essas variáveis de ambiente no .env.local
const RPC_URL = process.env.NEXT_PUBLIC_SOLANA_RPC_URL || 'https://api.devnet.solana.com';
const RELAYER_PRIVATE_KEY = process.env.RELAYER_PRIVATE_KEY;

// IDL Simplificado para a instrução 'release'
const IDL: Idl = {
    "version": "0.1.0",
    "name": "verum_vesting",
    "instructions": [
        {
            "name": "release",
            "accounts": [
                { "name": "beneficiary", "isMut": true, "isSigner": false }, // Mudado para false!
                { "name": "beneficiaryTokenAccount", "isMut": true, "isSigner": false },
                { "name": "vestingAccount", "isMut": true, "isSigner": false },
                { "name": "vault", "isMut": true, "isSigner": false },
                { "name": "tokenProgram", "isMut": false, "isSigner": false }
            ],
            "args": []
        }
    ],
    "accounts": [
        {
            "name": "VestingAccount",
            "type": {
                "kind": "struct",
                "fields": [
                    { "name": "sender", "type": "publicKey" },
                    { "name": "beneficiary", "type": "publicKey" },
                    { "name": "custodyWallet", "type": "publicKey" },
                    { "name": "mint", "type": "publicKey" },
                    { "name": "vault", "type": "publicKey" },
                    { "name": "startTime", "type": "i64" },
                    { "name": "cliffTime", "type": "i64" },
                    { "name": "duration", "type": "u64" },
                    { "name": "totalAmount", "type": "u64" },
                    { "name": "releasedAmount", "type": "u64" },
                    { "name": "revocable", "type": "bool" },
                    { "name": "revoked", "type": "bool" },
                    { "name": "bump", "type": "u8" }
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
        const relayerWallet = Keypair.fromSecretKey(
            Uint8Array.from(JSON.parse(RELAYER_PRIVATE_KEY))
        );
        const wallet = new Wallet(relayerWallet);
        const provider = new AnchorProvider(connection, wallet, { commitment: 'confirmed' });

        // @ts-ignore
        const program = new Program(IDL, PROGRAM_ID, provider);

        console.log("Iniciando processo de liberação automática...");

        // 1. Buscar todas as contas de Vesting
        // @ts-ignore
        const vestingAccounts = await program.account.vestingAccount.all();
        console.log(`Encontradas ${vestingAccounts.length} contas de vesting.`);

        const results = [];

        // 2. Iterar e verificar se pode liberar
        for (const account of vestingAccounts) {
            try {
                const data = account.account;
                const pubkey = account.publicKey;

                const currentTime = Math.floor(Date.now() / 1000);

                // Lógica de Vesting (Simplificada para JS, ideal é tentar simular ou calcular)
                // Se já estiver revogado ou totalmente liberado, pular
                if (data.revoked || data.releasedAmount.eq(data.totalAmount)) {
                    continue;
                }

                // Calcular montante vestado
                const start = data.startTime.toNumber();
                const duration = data.duration.toNumber();
                const total = data.totalAmount.toNumber();

                // Só processa se passou do cliff (se houver) e se passou tempo suficiente
                if (currentTime < start) continue;

                // Tentar liberar
                // Precisamos das contas associadas (Token Account do Beneficiário)
                // Isso pode ser complexo se não tivermos armazenado, mas podemos derivar ou buscar
                // O beneficiaryTokenAccount é geralmente a ATA do beneficiary para o Mint do contrato

                const beneficiary = data.beneficiary;
                const mint = data.mint;

                // Derivar ATA do beneficiário
                const [beneficiaryTokenAccount] = await PublicKey.findProgramAddress(
                    [beneficiary.toBuffer(), new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA").toBuffer(), mint.toBuffer()],
                    new PublicKey("ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL")
                );

                console.log(`Tentando liberar para contrato ${pubkey.toString()}...`);

                const tx = await program.methods.release()
                    .accounts({
                        beneficiary: beneficiary,
                        beneficiaryTokenAccount: beneficiaryTokenAccount,
                        vestingAccount: pubkey,
                        vault: data.vault,
                        tokenProgram: new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA")
                    })
                    .rpc();

                console.log(`Sucesso! TX: ${tx}`);
                results.push({ account: pubkey.toString(), status: 'success', tx });

            } catch (err: any) {
                console.error(`Erro ao processar conta ${account.publicKey.toString()}:`, err.message);
                results.push({ account: account.publicKey.toString(), status: 'error', error: err.message });
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
