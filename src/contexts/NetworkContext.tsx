"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

type Network = 'mainnet' | 'devnet';

interface NetworkContextType {
    network: Network;
    setNetwork: (network: Network) => void;
}

const NetworkContext = createContext<NetworkContextType | undefined>(undefined);

export function NetworkProvider({ children }: { children: ReactNode }) {
    const [network, setNetworkState] = useState<Network>('mainnet');

    useEffect(() => {
        const savedNetwork = localStorage.getItem('verum_network') as Network;
        if (savedNetwork && (savedNetwork === 'mainnet' || savedNetwork === 'devnet')) {
            setNetworkState(savedNetwork);
        }
    }, []);

    const setNetwork = (newNetwork: Network) => {
        setNetworkState(newNetwork);
        localStorage.setItem('verum_network', newNetwork);
    };

    return (
        <NetworkContext.Provider value={{ network, setNetwork }}>
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
