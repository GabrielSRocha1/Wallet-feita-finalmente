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

    // 1. Detecção direta via objetos injetados (Normalmente mais rápida e confiável)
    const directPhantom = !!(w.phantom?.solana?.isPhantom || (w.solana?.isPhantom && !w.solana?.isSolflare));
    const directSolflare = !!(w.solflare?.isSolflare || (w.solana?.isSolflare && !w.solana?.isPhantom));
    const directOKX = !!(w.okxwallet?.solana);

    if (walletName === 'phantom' && directPhantom) return true;
    if (walletName === 'solflare' && directSolflare) return true;
    if (walletName === 'okx' && directOKX) return true;

    // 2. Fallback para os adapters (detectWallets)
    const wallets = detectWallets();
    const wallet = (wallets as any)[walletName.toLowerCase()];

    if (!wallet) return false;

    // Se o adapter diz que está instalado, confiamos nele
    const isInstalled = wallet.readyState === 'Installed' || wallet.readyState === 'Loadable';

    console.log(`[isWalletInstalled] ${walletName} check:`, {
        directCheck: walletName === 'phantom' ? directPhantom : (walletName === 'solflare' ? directSolflare : directOKX),
        adapterReadyState: wallet.readyState,
        isInstalled
    });

    return isInstalled;
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
