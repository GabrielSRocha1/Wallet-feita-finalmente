"use client";

import React, { createContext, useContext, ReactNode } from 'react';
import { useSolana } from '@/hooks/useSolana';
import { detectWallets } from '@/utils/wallet-adapter';

// Re-exporta tipos para compatibilidade
export type WalletName = 'phantom' | 'solflare' | 'okx' | 'verum';

interface WalletContextType {
    connected: boolean;
    publicKey: string | null;
    wallet: any | null;
    loading: boolean;
    error: string | null;
    isAdmin: boolean;
    connectWallet: (walletName: string) => Promise<void>;
    disconnectWallet: () => Promise<void>;
    clearError: () => void;
    availableWallets: any;
}

const WalletContext = createContext<WalletContextType | undefined>(undefined);

// Função auxiliar para verificar instalação
export const isWalletInstalled = (walletName: string): boolean => {
    if (typeof window === 'undefined') return false;
    const w = window as any;

    if (walletName === 'verum') return true;

    // Detecção direta via objetos injetados (mais confiável em desktop)
    const isPhantom = !!(w.phantom?.solana?.isPhantom || w.solana?.isPhantom);
    const isSolflare = !!(w.solflare?.isSolflare || w.solana?.isSolflare);
    const isOKX = !!(w.okxwallet?.solana);

    if (walletName === 'phantom') return isPhantom;
    if (walletName === 'solflare') return isSolflare;
    if (walletName === 'okx') return isOKX;

    return false;
};

export function WalletProvider({ children }: { children: ReactNode }) {
    const solana = useSolana();

    // Adaptador para manter a interface antiga connectWallet (que recebia WalletName)
    // O hook useSolana usa 'connect'
    const connectWallet = async (walletName: string) => {
        await solana.connect(walletName);
    };

    const clearError = () => {
        // O hook useSolana limpa erro ao tentar conectar novamente
        // Podemos adicionar um método específico no hook se necessário, 
        // mas por enquanto vamos deixar vazio ou forçar update se o hook permitir
    };

    return (
        <WalletContext.Provider
            value={{
                ...solana,
                connectWallet, // Alias para connect
                disconnectWallet: solana.disconnect, // Alias para disconnect
                clearError,
                wallet: solana.wallet
            }}
        >
            {children}
        </WalletContext.Provider>
    );
}

export function useWallet() {
    const context = useContext(WalletContext);
    if (context === undefined) {
        throw new Error('useWallet deve ser usado dentro de WalletProvider');
    }
    return context;
}
