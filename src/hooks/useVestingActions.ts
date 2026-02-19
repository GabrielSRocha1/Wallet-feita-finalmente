import { useWallet } from '@/contexts/WalletContext';
import { useNetwork } from '@/contexts/NetworkContext';
import {
    PublicKey,
    Transaction,
    Connection,
} from '@solana/web3.js';
import {
    getAssociatedTokenAddress,
    createAssociatedTokenAccountInstruction,
    createTransferInstruction,
    getAccount,
} from '@solana/spl-token';
import { releaseTransaction } from '@/utils/verum-contract';
import { getRpcUrl } from '@/utils/solana-config';

export const useVestingActions = () => {
    const { publicKey, wallet, connected } = useWallet();
    const { network } = useNetwork();

    const sendTokens = async (mintAddress: string, destinationAddress: string, amount: number, decimals: number) => {
        if (!connected || !wallet || !publicKey) {
            throw new Error("Carteira não conectada.");
        }

        const connection = new Connection(getRpcUrl(network), 'confirmed');
        const mint = new PublicKey(mintAddress);
        const destination = new PublicKey(destinationAddress);
        const sender = new PublicKey(publicKey);

        // 1. Get ATAs
        const sourceATA = await getAssociatedTokenAddress(mint, sender);
        const destinationATA = await getAssociatedTokenAddress(mint, destination);

        const transaction = new Transaction();

        // 2. Check if destination ATA exists
        try {
            await getAccount(connection, destinationATA);
        } catch (error: any) {
            // Simplified check: if it fails, we assume it's because it doesn't exist
            // In a production environment, we'd check the error type more strictly
            transaction.add(
                createAssociatedTokenAccountInstruction(
                    sender,
                    destinationATA,
                    destination,
                    mint
                )
            );
        }

        // 3. Add transfer instruction
        // Convert amount to raw units
        const rawAmount = Math.floor(amount * Math.pow(10, decimals));

        transaction.add(
            createTransferInstruction(
                sourceATA,
                destinationATA,
                sender,
                rawAmount
            )
        );

        // 4. Send transaction
        const {
            context: { slot: minContextSlot },
            value: { blockhash, lastValidBlockHeight }
        } = await connection.getLatestBlockhashAndContext();

        const signature = await wallet.sendTransaction(transaction, connection, { minContextSlot });
        await connection.confirmTransaction({ blockhash, lastValidBlockHeight, signature }, 'confirmed');

        return signature;
    };

    const claimTokens = async (vestingAccountAddress: string) => {
        if (!connected || !wallet) throw new Error("Carteira não conectada.");
        const connection = new Connection(getRpcUrl(network), 'confirmed');
        return await releaseTransaction(wallet, connection, vestingAccountAddress, network);
    };

    return {
        sendTokens,
        claimTokens,
        publicKey: connected ? publicKey : null
    };
};
