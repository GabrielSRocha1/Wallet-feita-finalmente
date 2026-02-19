import { Connection, PublicKey } from '@solana/web3.js';
import { getTokenBalance } from './verum-contract';

export interface ReleaseValidationResult {
    success: boolean;
    recipientParams: {
        address: string;
        preBalance: number;
        postBalance: number;
        delta: number;
    };
    txSignature?: string;
    timestamp: string;
}

/**
 * Technical Prompt - Automatic Release Validation
 * Validates that a release actually reached the recipient's wallet.
 */
export const validateReleaseToWallet = async (
    connection: Connection,
    recipientAddress: string,
    tokenMintAddress: string,
    expectedAmount: number,
    txSignature: string,
    preFlightBalance?: number
): Promise<ReleaseValidationResult> => {
    console.group('🤖 Automatic Release Validator');
    console.log(`Target: ${recipientAddress}`);
    console.log(`Expected Amount: ${expectedAmount}`);
    console.log(`Tx: ${txSignature}`);

    try {
        const recipientPubkey = new PublicKey(recipientAddress);
        const mintPubkey = new PublicKey(tokenMintAddress);

        // 1. Find the associated token account (ATA) or specific token account
        // Ideally we should know the ATA address, but verification often starts with Owner
        const tokenAccounts = await connection.getParsedTokenAccountsByOwner(recipientPubkey, {
            mint: mintPubkey
        });

        if (tokenAccounts.value.length === 0) {
            throw new Error("Recipient does not have a token account for this mint.");
        }

        // Assuming primary usage of the first account found for simplicity in validation
        const targetTokenAccount = tokenAccounts.value[0].pubkey.toString();

        console.log(`Monitoring Token Account: ${targetTokenAccount}`);

        // 2. Poll for balance update (Wait for finalization and indexing)
        let attempts = 0;
        const maxAttempts = 10;
        let currentBalance = 0;
        let balanceMatched = false;

        const initialBalance = (preFlightBalance !== undefined
            ? preFlightBalance
            : (await getTokenBalance(targetTokenAccount, connection)).uiAmount) ?? 0;

        console.log(`Initial Balance: ${initialBalance}`);

        while (attempts < maxAttempts && !balanceMatched) {
            attempts++;
            await new Promise(r => setTimeout(r, 2000)); // 2s polling interval

            const balanceData = await getTokenBalance(targetTokenAccount, connection);
            currentBalance = balanceData.uiAmount || 0;

            const delta = currentBalance - initialBalance;

            // Tolerance for floating point (epsilon 0.000001)
            if (delta >= expectedAmount - 0.000001) {
                balanceMatched = true;
                console.log(`✅ Balance Updated! New verification balance: ${currentBalance} (+${delta})`);
            } else {
                console.log(`⏳ Attempt ${attempts}/${maxAttempts}: Balance ${currentBalance} (Delta: ${delta}). Waiting for ${expectedAmount}...`);
            }
        }

        if (!balanceMatched) {
            throw new Error(`Timeout waiting for funds. Balance stuck at ${currentBalance}`);
        }

        console.log("✅ Automatic Release: Delivery Confirmed");

        return {
            success: true,
            recipientParams: {
                address: recipientAddress,
                preBalance: initialBalance,
                postBalance: currentBalance,
                delta: currentBalance - initialBalance
            },
            txSignature,
            timestamp: new Date().toISOString()
        };

    } catch (error: any) {
        console.error("❌ Release Validation Failed:", error);
        return {
            success: false,
            recipientParams: {
                address: recipientAddress,
                preBalance: preFlightBalance || 0,
                postBalance: 0,
                delta: 0
            },
            txSignature,
            timestamp: new Date().toISOString()
        };
    } finally {
        console.groupEnd();
    }
};

/**
 * Pre-validation check to snapshot balance before an operation
 */
export const snapshotTokenBalance = async (
    connection: Connection,
    recipientAddress: string,
    tokenMintAddress: string
): Promise<number> => {
    try {
        const recipientPubkey = new PublicKey(recipientAddress);
        const mintPubkey = new PublicKey(tokenMintAddress);

        const tokenAccounts = await connection.getParsedTokenAccountsByOwner(recipientPubkey, {
            mint: mintPubkey
        });

        if (tokenAccounts.value.length === 0) return 0;

        // Basic parser
        const info = tokenAccounts.value[0].account.data.parsed.info;
        return info.tokenAmount.uiAmount || 0;
    } catch (e) {
        console.warn("Could not snapshot balance:", e);
        return 0;
    }
};
