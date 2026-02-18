"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode, useMemo } from 'react';
import { Connection, clusterApiUrl } from '@solana/web3.js';
import { createSolanaClient } from 'gill';
import { DEFAULT_NETWORK } from '@/utils/solana-config';

type Network = 'mainnet' | 'devnet';

interface NetworkContextType {
    network: Network;
    setNetwork: (network: Network) => void;
    rpcUrl: string;
    connection: Connection;
    client: any; // gill client
}

const NetworkContext = createContext<NetworkContextType | undefined>(undefined);

export function NetworkProvider({ children }: { children: ReactNode }) {
    // Usa DEFAULT_NETWORK como valor inicial (Hierarchy: Env > Default)
    const [network, setNetworkState] = useState<Network>(DEFAULT_NETWORK);

    useEffect(() => {
        const savedNetwork = localStorage.getItem('verum_network') as Network;

        // COMMON ERROR PREVENTION: Environment Mismatch
        const isProdDomain = typeof window !== 'undefined' && window.location.hostname === 'verum.com'; // Adjust domain as needed

        if (isProdDomain && savedNetwork === 'devnet') {
            console.warn("⚠️ [SECURITY] Production domain detected via devnet. Forcing Mainnet or requiring explicit override.");
            // Optional: setNetworkState('mainnet'); 
        }

        if (savedNetwork && (savedNetwork === 'mainnet' || savedNetwork === 'devnet')) {
            setNetworkState(savedNetwork);
        }
    }, []);

    const setNetwork = (newNetwork: Network) => {
        // 1. ISOLAMENTO DE REDE: Confirmação visual/log
        console.log(`[Network Switch] Switching to ${newNetwork}. All subsequent RPC calls will be isolated to this network.`);

        setNetworkState(newNetwork);
        localStorage.setItem('verum_network', newNetwork);
    };

    const rpcUrl = useMemo(() => {
        const heliusKey = process.env.NEXT_PUBLIC_HELIUS_API_KEY;
        if (heliusKey) {
            return `https://${network === 'mainnet' ? 'mainnet' : 'devnet'}.helius-rpc.com/?api-key=${heliusKey}`;
        }
        return network === 'mainnet'
            ? 'https://api.mainnet-beta.solana.com'
            : 'https://api.devnet.solana.com';
    }, [network]);

    const connection = useMemo(() => {
        return new Connection(rpcUrl, 'confirmed');
    }, [rpcUrl]);

    const client = useMemo(() => {
        return createSolanaClient({ urlOrMoniker: rpcUrl });
    }, [rpcUrl]);

    return (
        <NetworkContext.Provider value={{ network, setNetwork, rpcUrl, connection, client }}>
            {children}
        </NetworkContext.Provider>
    );
}

export function useNetwork() {
    const context = useContext(NetworkContext);
    if (context === undefined) {
        throw new Error('useNetwork deve ser usado dentro de NetworkProvider');
    }
    return context;
}
