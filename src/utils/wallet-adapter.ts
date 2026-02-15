import {
    Adapter,
    WalletReadyState
} from '@solana/wallet-adapter-base';
import { PhantomWalletAdapter } from '@solana/wallet-adapter-phantom';
import { SolflareWalletAdapter } from '@solana/wallet-adapter-solflare';

// Função para obter instâncias dos adaptadores
const getAdapters = () => {
    // Verifica se estamos no browser
    if (typeof window === 'undefined') return {};

    return {
        phantom: new PhantomWalletAdapter(),
        solflare: new SolflareWalletAdapter(),
        // OKX Wallet geralmente injeta como 'okxwallet' e é compatível com a interface Solana
        // Para simplificar, vamos detectar manualmente se não houver adapter oficial instalado
    };
};

export const detectWallets = () => {
    const adapters = getAdapters();
    const w = typeof window !== 'undefined' ? (window as any) : {};

    return {
        phantom: adapters.phantom,
        solflare: w.solflare || w.solana?.isSolflare ? {
            name: 'Solflare',
            readyState: WalletReadyState.Installed,
            connect: async () => {
                const solflare = w.solflare || w.solana;
                await solflare.connect();
                return solflare;
            },
            disconnect: async () => {
                const solflare = w.solflare || w.solana;
                if (solflare.disconnect) await solflare.disconnect();
            },
            publicKey: (w.solflare || w.solana).publicKey,
            on: (event: string, fn: Function) => (w.solflare || w.solana).on(event, fn)
        } : adapters.solflare,
        // Detecta OKX manualmente pois não instalamos adapter específico (ou usa Phantom se compatível)
        okx: w.okxwallet?.solana ? {
            name: 'OKX Wallet',
            readyState: WalletReadyState.Installed,
            connect: async () => {
                await w.okxwallet.solana.connect();
                return w.okxwallet.solana;
            },
            disconnect: async () => w.okxwallet.solana.disconnect(),
            publicKey: w.okxwallet.solana.publicKey,
            on: (event: string, fn: Function) => w.okxwallet.solana.on(event, fn)
        } : null,
        // Mock wallet para testes e acesso Admin rápido
        verum: {
            name: 'Verum',
            readyState: WalletReadyState.Installed,
            publicKey: { toString: () => "Da51JLCnUfN3L3RDNeYkn7kxr7C3otnLaLvbsjmTTzE8" },
            connect: async () => { },
            disconnect: async () => { },
            on: (event: string, fn: Function) => { }
        }
    };
};

export const connectWalletAdapter = async (walletName: string) => {
    const wallets = detectWallets() as any;
    const wallet = wallets[walletName.toLowerCase()];

    if (!wallet) {
        throw new Error(`${walletName} não está disponível ou não foi detectada.`);
    }

    if (wallet.readyState === WalletReadyState.NotDetected && !wallet.isSolflare && !wallet.isPhantom) {
        throw new Error(`${walletName} não está instalada.`);
    }

    try {
        await wallet.connect();
        return {
            publicKey: wallet.publicKey?.toString(),
            wallet,
            connected: true
        };
    } catch (error: any) {
        throw new Error(`Falha ao conectar: ${error.message}`);
    }
};

export const disconnectWalletAdapter = async (wallet: any) => {
    if (wallet?.disconnect) {
        await wallet.disconnect();
    }
};
