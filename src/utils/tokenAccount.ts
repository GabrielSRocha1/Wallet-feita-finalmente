import {
    Connection,
    PublicKey,
    Transaction,
    sendAndConfirmTransaction,
    Commitment
} from '@solana/web3.js';
import {
    getAssociatedTokenAddressSync,
    createAssociatedTokenAccountInstruction,
    ASSOCIATED_TOKEN_PROGRAM_ID,
    TOKEN_PROGRAM_ID
} from '@solana/spl-token';
import { TOKEN_2022_PROGRAM_ID } from '@solana/spl-token';

/**
 * Obtém ou cria uma ATA para Token-2022
 * @param connection - Conexão Solana
 * @param payer - Quem paga a taxa (Signer's public key)
 * @param mint - Endereço do mint do token
 * @param owner - Dono da ATA
 * @param allowOwnerOffCurve - Permite owner off-curve (pda)
 * @returns Endereço da ATA
 */
export async function getOrCreateToken2022ATA(
    connection: Connection,
    payer: PublicKey,
    mint: PublicKey,
    owner: PublicKey,
    allowOwnerOffCurve: boolean = false,
    commitment: Commitment = 'confirmed'
): Promise<{ ata: PublicKey; instruction: any | null }> {

    // Calcula o endereço da ATA para Token-2022
    const ata = getAssociatedTokenAddressSync(
        mint,
        owner,
        allowOwnerOffCurve,
        TOKEN_2022_PROGRAM_ID,
        ASSOCIATED_TOKEN_PROGRAM_ID
    );

    console.log("Token-2022 ATA Address:", ata.toBase58());

    // Verifica se a conta já existe
    const account = await connection.getAccountInfo(ata, commitment);

    if (!account) {
        console.log("ATA não existe, criando...");

        // Cria a instrução para criar a ATA
        const createATAInstruction = createAssociatedTokenAccountInstruction(
            payer,        // Quem paga
            ata,          // Endereço da ATA a ser criada
            owner,        // Dono da ATA
            mint,         // Mint do token
            TOKEN_2022_PROGRAM_ID,  // Token-2022 Program
            ASSOCIATED_TOKEN_PROGRAM_ID
        );

        // Retorna a instrução e o endereço para ser adicionado à transação
        return { ata, instruction: createATAInstruction };
    }

    // Verifica se é realmente uma conta Token-2022
    if (account.owner.toBase58() !== TOKEN_2022_PROGRAM_ID.toBase58()) {
        throw new Error(
            `Conta existe mas é do programa errado. ` +
            `Esperado: ${TOKEN_2022_PROGRAM_ID.toBase58()}, ` +
            `Recebido: ${account.owner.toBase58()}`
        );
    }

    console.log("ATA já existe");
    return { ata, instruction: null };
}

/**
 * Cria e envia transação para criar ATA Token-2022 (standalone)
 */
export async function createToken2022ATA(
    connection: Connection,
    payer: any, // Wallet adapter ou Keypair
    mint: PublicKey,
    owner: PublicKey,
    allowOwnerOffCurve: boolean = false
): Promise<PublicKey> {

    const { ata, instruction } = await getOrCreateToken2022ATA(
        connection,
        payer.publicKey,
        mint,
        owner,
        allowOwnerOffCurve
    );

    if (instruction) {
        const transaction = new Transaction().add(instruction);

        // Se usar wallet adapter
        if (payer.signTransaction) {
            const { blockhash } = await connection.getLatestBlockhash();
            transaction.recentBlockhash = blockhash;
            transaction.feePayer = payer.publicKey;

            const signed = await payer.signTransaction(transaction);
            const signature = await connection.sendRawTransaction(signed.serialize());
            await connection.confirmTransaction(signature);
        } else {
            // Se for Keypair
            await sendAndConfirmTransaction(connection, transaction, [payer]);
        }

        console.log("ATA Token-2022 criada:", ata.toBase58());
    }

    return ata;
}

/**
 * Verifica o tipo de token (SPL ou Token-2022) e retorna o programa correto
 */
export async function detectTokenProgram(
    connection: Connection,
    mint: PublicKey
): Promise<PublicKey> {
    const mintInfo = await connection.getAccountInfo(mint);

    if (!mintInfo) {
        throw new Error("Mint não encontrado");
    }

    console.log("Mint Owner:", mintInfo.owner.toBase58());

    if (mintInfo.owner.equals(TOKEN_2022_PROGRAM_ID)) {
        return TOKEN_2022_PROGRAM_ID;
    } else if (mintInfo.owner.equals(TOKEN_PROGRAM_ID)) {
        return TOKEN_PROGRAM_ID;
    } else {
        throw new Error(`Programa de token desconhecido: ${mintInfo.owner.toBase58()}`);
    }
}

/**
 * Função universal que funciona com SPL Token E Token-2022
 */
export async function getOrCreateATAUniversal(
    connection: Connection,
    payer: PublicKey,
    mint: PublicKey,
    owner: PublicKey,
    allowOwnerOffCurve: boolean = false
): Promise<{ ata: PublicKey; instruction: any | null; tokenProgram: PublicKey }> {

    // Detecta automaticamente o tipo de token
    const tokenProgram = await detectTokenProgram(connection, mint);
    const isToken2022 = tokenProgram.equals(TOKEN_2022_PROGRAM_ID);

    console.log(`Detectado: ${isToken2022 ? 'Token-2022' : 'SPL Token'}`);

    // Calcula ATA com o programa correto
    const ata = getAssociatedTokenAddressSync(
        mint,
        owner,
        allowOwnerOffCurve,
        tokenProgram,
        ASSOCIATED_TOKEN_PROGRAM_ID
    );

    const account = await connection.getAccountInfo(ata);

    if (!account) {
        const instruction = createAssociatedTokenAccountInstruction(
            payer,
            ata,
            owner,
            mint,
            tokenProgram,
            ASSOCIATED_TOKEN_PROGRAM_ID
        );

        return { ata, instruction, tokenProgram };
    }

    return { ata, instruction: null, tokenProgram };
}