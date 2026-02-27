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
        const savedSession = localStorage.getItem('verum_wallet_session');

        let isAdmin = false;
        if (savedSession) {
            try {
                const session = JSON.parse(savedSession);
                isAdmin = !!session.isAdmin;
            } catch (e) {
                console.error("Erro ao ler sessão para rede:", e);
            }
        }

        // Se não for admin, força Mainnet independentemente do que estiver no localStorage
        if (!isAdmin) {
            setNetworkState('mainnet');
            localStorage.setItem('verum_network', 'mainnet');
            return;
        }

        // Se for admin, respeita o cache ou usa o padrão
        if (savedNetwork && (savedNetwork === 'mainnet' || savedNetwork === 'devnet')) {
            setNetworkState(savedNetwork);
        } else {
            setNetworkState(DEFAULT_NETWORK);
        }
    }, []);

    const setNetwork = (newNetwork: Network) => {
        // SEGURANÇA: Verifica se é admin antes de permitir a troca
        const savedSession = localStorage.getItem('verum_wallet_session');
        let isAdmin = false;
        if (savedSession) {
            try {
                isAdmin = !!JSON.parse(savedSession).isAdmin;
            } catch (e) { }
        }

        if (!isAdmin) {
            console.error("⚠️ [SECURITY] Acesso negado: Somente administradores podem alterar a rede.");
            return;
        }

        // 1. ISOLAMENTO DE REDE: Confirmação visual/log
        console.log(`%c[Network Switch] Switching globally to ${newNetwork.toUpperCase()}`, 'color: #EAB308; font-weight: bold; background: #111; padding: 2px 5px; border-radius: 4px;');
        console.log(`[Isolamento] All subsequent RPC calls and Program IDs are now pointing to ${newNetwork}.`);

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
