import {
    Adapter,
    WalletReadyState
} from '@solana/wallet-adapter-base';
import { PhantomWalletAdapter } from '@solana/wallet-adapter-phantom';
import { SolflareWalletAdapter } from '@solana/wallet-adapter-solflare';

// Singletons para evitar múltiplas instâncias
let phantomAdapter: PhantomWalletAdapter | null = null;
let solflareAdapter: SolflareWalletAdapter | null = null;

const getPhantomAdapter = () => {
    if (typeof window === 'undefined') return null;
    if (!phantomAdapter) phantomAdapter = new PhantomWalletAdapter();
    return phantomAdapter;
};

const getSolflareAdapter = () => {
    if (typeof window === 'undefined') return null;
    if (!solflareAdapter) solflareAdapter = new SolflareWalletAdapter();
    return solflareAdapter;
};

export const detectWallets = () => {
    if (typeof window === 'undefined') return {};
    const w = window as any;

    return {
        phantom: getPhantomAdapter(),
        solflare: getSolflareAdapter(),
        okx: w.okxwallet?.solana ? {
            name: 'OKX Wallet',
            readyState: WalletReadyState.Installed,
            connect: async () => {
                await w.okxwallet.solana.connect();
                return w.okxwallet.solana;
            },
            disconnect: async () => {
                if (w.okxwallet.solana.disconnect) await w.okxwallet.solana.disconnect();
            },
            get publicKey() { return w.okxwallet.solana.publicKey; },
            on: (event: string, fn: Function) => w.okxwallet.solana.on(event, fn)
        } : null,
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
        throw new Error(`A carteira ${walletName} não foi detectada.`);
    }

    try {
        // Algumas wallets (like Solflare) podem demorar um pouco para injetar ou inicializar
        await wallet.connect();

        // Pequena espera para garantir que o objeto publicKey foi populado
        let attempts = 0;
        while (!wallet.publicKey && attempts < 10) {
            await new Promise(r => setTimeout(r, 100));
            attempts++;
        }

        if (!wallet.publicKey) {
            throw new Error("A carteira conectou, mas não retornou um endereço público.");
        }

        return {
            publicKey: wallet.publicKey.toString(),
            wallet,
            connected: true
        };
    } catch (error: any) {
        console.error("Erro no adaptador:", error);
        throw new Error(error.message || "Falha na conexão com a carteira");
    }
};

export const disconnectWalletAdapter = async (wallet: any) => {
    try {
        if (wallet?.disconnect) {
            await wallet.disconnect();
        }
    } catch (e) {
        console.warn("Erro ao desconectar:", e);
    }
};
