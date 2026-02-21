"use client";

import { useCallback } from 'react';
import { Connection } from '@solana/web3.js';
import {
    getAccount,
} from '@solana/spl-token';
import { releaseTransaction } from '@/utils/verum-contract';
import { getRpcUrl } from '@/utils/solana-config';

export const useVestingActions = () => {
    const release = useCallback(
        async (
            wallet: any,
            connected: boolean,
            network: 'mainnet' | 'devnet',
            vestingAccountAddress: string
        ) => {
            if (!connected || !wallet) throw new Error("Carteira não conectada.");
            const connection = new Connection(getRpcUrl(network), 'confirmed');
            return await releaseTransaction(wallet, connection, vestingAccountAddress, network);
        },
        []
    );

    return {
        release,
        sendTokens: async (...args: any[]) => {
            console.log("Mock sendTokens called", args);
            return { success: true, signature: "mock" };
        },
    };
};
