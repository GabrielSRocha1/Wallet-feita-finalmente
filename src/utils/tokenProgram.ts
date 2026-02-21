// utils/tokenProgram.ts
import { Connection, PublicKey } from '@solana/web3.js';

/**
 * Detecta se um mint pertence ao programa SPL Token (Legado) ou ao Token Extensions (Token-2022).
 * Isso é fundamental para que o contrato de vesting aceite ambos os padrões.
 */
export const detectTokenProgram = async (
    connection: Connection,
    mintAddress: string
): Promise<PublicKey> => {
    try {
        const mintPubkey = new PublicKey(mintAddress);
        // Buscar informações da conta mint
        const mintInfo = await connection.getAccountInfo(mintPubkey);

        if (!mintInfo) {
            throw new Error(`Mint account ${mintAddress} not found`);
        }

        // Verificar qual programa possui a conta
        const owner = mintInfo.owner.toBase58();

        // Retornar o programa correto
        // Token-2022: TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb
        if (owner === 'TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb') {
            console.log(`[TokenProgram] Detectado Token-2022 para ${mintAddress}`);
            return new PublicKey('TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb');
        }

        // Fallback/Padrão: TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA (SPL Token)
        console.log(`[TokenProgram] Detectado SPL Token padrão para ${mintAddress}`);
        return new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA');

    } catch (error) {
        console.error('Erro ao detectar programa de token:', error);
        // Em caso de erro, retorna o programa de token padrão como fallback de segurança
        return new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA');
    }
};
