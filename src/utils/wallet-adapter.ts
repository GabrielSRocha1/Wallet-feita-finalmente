import {
    Adapter,
    WalletReadyState
} from '@solana/wallet-adapter-base';
import { PhantomWalletAdapter } from '@solana/wallet-adapter-phantom';
import { SolflareWalletAdapter } from '@solana/wallet-adapter-solflare';

// Singletons para os adaptadores para evitar múltiplas instâncias
let phantomAdapter: PhantomWalletAdapter | null = null;
let solflareAdapter: SolflareWalletAdapter | null = null;

const getAdapters = () => {
    if (typeof window === 'undefined') return {};

    if (!phantomAdapter) phantomAdapter = new PhantomWalletAdapter();
    if (!solflareAdapter) solflareAdapter = new SolflareWalletAdapter();

    return {
        phantom: phantomAdapter,
        solflare: solflareAdapter,
    };
};

export const detectWallets = () => {
    const adapters = getAdapters();
    const w = typeof window !== 'undefined' ? (window as any) : {};

    const available = {
        phantom: adapters.phantom,
        solflare: (w.solflare || w.solana?.isSolflare) ? {
            name: 'Solflare',
            readyState: WalletReadyState.Installed,
            isSolflare: true,
            connect: async () => {
                const solflare = w.solflare || w.solana;
                await solflare.connect();
                return solflare;
            },
            disconnect: async () => {
                const solflare = w.solflare || w.solana;
                if (solflare?.disconnect) await solflare.disconnect();
            },
            publicKey: (w.solflare || w.solana)?.publicKey,
            on: (event: string, fn: Function) => (w.solflare || w.solana)?.on(event, fn)
        } : adapters.solflare,
        okx: w.okxwallet?.solana ? {
            name: 'OKX Wallet',
            readyState: WalletReadyState.Installed,
            isOKX: true,
            connect: async () => {
                await w.okxwallet.solana.connect();
                return w.okxwallet.solana;
            },
            disconnect: async () => w.okxwallet.solana.disconnect(),
            publicKey: w.okxwallet.solana.publicKey,
            on: (event: string, fn: Function) => w.okxwallet.solana.on(event, fn)
        } : null,
        verum: {
            name: 'Verum',
            readyState: WalletReadyState.Installed,
            isVerum: true,
            publicKey: { toString: () => "Da51JLCnUfN3L3RDNeYkn7kxr7C3otnLaLvbsjmTTzE8" },
            connect: async () => {
                await new Promise(r => setTimeout(r, 500)); // Simula conexão rápida
            },
            disconnect: async () => { },
            on: (event: string, fn: Function) => { }
        }
    };

    return available;
};

export const connectWalletAdapter = async (walletName: string) => {
    const wallets = detectWallets() as any;
    const name = walletName.toLowerCase();
    const wallet = wallets[name];

    if (!wallet) {
        throw new Error(`${walletName} não está disponível ou não foi detectada.`);
    }

    // Se já estiver conectado, apenas retorna (evita hangs)
    if (wallet.connected || (wallet.publicKey && name !== 'verum')) {
        return {
            publicKey: wallet.publicKey?.toString(),
            wallet,
            connected: true
        };
    }

    try {
        // Adiciona um timeout de segurança de 30 segundos para a conexão
        const connectionPromise = wallet.connect();
        const timeoutPromise = new Promise((_, reject) =>
            setTimeout(() => reject(new Error("Timeout: A carteira não respondeu a tempo.")), 60000)
        );

        await Promise.race([connectionPromise, timeoutPromise]);

        if (!wallet.publicKey) {
            throw new Error("A conexão foi estabelecida mas a chave pública não foi encontrada.");
        }

        return {
            publicKey: wallet.publicKey.toString(),
            wallet,
            connected: true
        };
    } catch (error: any) {
        console.error("Erro interno no adapter:", error);
        throw new Error(error.message || "Erro desconhecido ao conectar com a carteira.");
    }
};

export const disconnectWalletAdapter = async (wallet: any) => {
    if (wallet?.disconnect) {
        await wallet.disconnect();
    }
};
