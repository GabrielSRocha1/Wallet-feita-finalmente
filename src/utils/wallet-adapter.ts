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

    console.log(`[WalletAdapter] Tentando conectar: ${walletName}`);
    console.log(`[WalletAdapter] Wallet object:`, wallet);
    console.log(`[WalletAdapter] ReadyState:`, wallet?.readyState);

    if (!wallet) {
        throw new Error(`A carteira ${walletName} não foi detectada.`);
    }

    // Verifica se a wallet está realmente disponível (não apenas o adapter)
    // Fallback manual para o caso do readyState do adapter falhar ou demorar a atualizar
    const w = typeof window !== 'undefined' ? window as any : {};
    const isActuallyInstalled = wallet.readyState !== WalletReadyState.NotDetected ||
        (walletName.toLowerCase() === 'phantom' && !!(w.phantom?.solana || w.solana?.isPhantom)) ||
        (walletName.toLowerCase() === 'solflare' && !!(w.solflare || w.solana?.isSolflare)) ||
        (walletName.toLowerCase() === 'okx' && !!w.okxwallet?.solana);

    if (!isActuallyInstalled) {
        throw new Error(`A extensão ${walletName} não está instalada. Por favor, instale a extensão e recarregue a página.`);
    }

    try {
        console.log(`[WalletAdapter] Chamando wallet.connect() para ${walletName}...`);

        // Algumas wallets (like Solflare) podem demorar um pouco para injetar ou inicializar
        await wallet.connect();

        console.log(`[WalletAdapter] Connect() completou. PublicKey:`, wallet.publicKey);

        // Pequena espera para garantir que o objeto publicKey foi populado
        let attempts = 0;
        while (!wallet.publicKey && attempts < 10) {
            console.log(`[WalletAdapter] Aguardando publicKey... tentativa ${attempts + 1}/10`);
            await new Promise(r => setTimeout(r, 100));
            attempts++;
        }

        // --- FALLBACK DIRETO VIA WINDOW OBJECT ---
        // Se após a tentativa padrão não tivermos publicKey, tentamos via objeto direto
        // Isso resolve casos onde o adapter não está sincronizado com a extensão
        if (!wallet.publicKey) {
            console.warn(`[WalletAdapter] Adapter falhou em retornar publicKey. Tentando fallback direto para ${walletName}...`);
            const w = window as any;
            let directProvider = null;

            if (walletName.toLowerCase() === 'solflare') {
                directProvider = w.solflare || (w.solana?.isSolflare ? w.solana : null);
            } else if (walletName.toLowerCase() === 'phantom') {
                directProvider = w.phantom?.solana || (w.solana?.isPhantom ? w.solana : null);
            }

            if (directProvider && directProvider.connect) {
                try {
                    console.log(`[WalletAdapter] Tentando conexão direta com provider injetado...`);
                    const response = await directProvider.connect();
                    const directKey = response.publicKey || directProvider.publicKey;

                    if (directKey) {
                        console.log(`[WalletAdapter] Fallback direto SUCESSO! Key: ${directKey.toString()}`);
                        return {
                            publicKey: directKey.toString(),
                            wallet: directProvider, // Retorna o provider direto
                            connected: true
                        };
                    }
                } catch (directErr) {
                    console.error(`[WalletAdapter] Erro no fallback direto:`, directErr);
                }
            }
        }
        // -----------------------------------------

        if (!wallet.publicKey) {
            throw new Error("A carteira conectou, mas não retornou um endereço público.");
        }

        console.log(`[WalletAdapter] Conexão bem-sucedida! PublicKey: ${wallet.publicKey.toString()}`);

        return {
            publicKey: wallet.publicKey.toString(),
            wallet,
            connected: true
        };
    } catch (error: any) {
        console.error(`[WalletAdapter] Erro ao conectar ${walletName}:`, error);

        // Mensagens de erro mais amigáveis
        if (error.message?.includes('User rejected')) {
            throw new Error('Você rejeitou a conexão na carteira.');
        }
        if (error.message?.includes('not installed')) {
            throw new Error(`A extensão ${walletName} não está instalada.`);
        }

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
