import { useEffect, useState, useCallback, useRef } from 'react';
import { Connection, PublicKey, LAMPORTS_PER_SOL } from '@solana/web3.js';

interface TokenData {
    mint: string;
    amount: number;
    decimals: number;
    price: number | null;
    symbol?: string;
    image?: string;
    valueUsd?: number;
    name?: string;
}

interface UseTokenMonitorReturn {
    tokens: TokenData[];
    loading: boolean;
    error: string | null;
    refresh: () => Promise<void>;
}

const TOKEN_PROGRAM_ID = new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA');
const HELIUS_API_KEY = process.env.NEXT_PUBLIC_HELIUS_API_KEY;
const RPC_ENDPOINT = HELIUS_API_KEY
    ? `https://devnet.helius-rpc.com/?api-key=${HELIUS_API_KEY}`
    : 'https://api.devnet.solana.com';

const truncateMint = (mint?: string) => {
    if (!mint || mint.length < 8) return mint || 'Unknown';
    return `${mint.slice(0, 4)}...${mint.slice(-4)}`;
};

export const useTokenMonitor = (walletAddress: string | null): UseTokenMonitorReturn => {
    const [tokens, setTokens] = useState<TokenData[]>([]);
    const [loading, setLoading] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);
    const connectionRef = useRef<Connection | null>(null);

    const fetchRealPrices = async (tokenList: TokenData[]) => {
        if (tokenList.length === 0) return tokenList;

        let solPrice = 0;

        try {
            // TENTATIVA 1: Jupiter
            const jupRes = await fetch(`https://api.jup.ag/price/v2?ids=So11111111111111111111111111111111111111112`).catch(() => null);
            if (jupRes?.ok) {
                const data = await jupRes.json();
                solPrice = parseFloat(data.data?.['So11111111111111111111111111111111111111112']?.price || '0');
            }

            // TENTATIVA 2: CoinGecko (Backup muito forte)
            if (solPrice === 0) {
                const cgRes = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd').catch(() => null);
                if (cgRes?.ok) {
                    const data = await cgRes.json();
                    solPrice = data.solana?.usd || 0;
                }
            }

            // TENTATIVA 3: Binance (Backup final)
            if (solPrice === 0) {
                const binRes = await fetch('https://api.binance.com/api/v3/ticker/price?symbol=SOLUSDT').catch(() => null);
                if (binRes?.ok) {
                    const data = await binRes.json();
                    solPrice = parseFloat(data.price || '0');
                }
            }
        } catch (e) {
            console.warn("Pricing failover active...", e);
        }

        // PREÇO DE SEGURANÇA (Se a internet cair, não mostra $0.00)
        if (solPrice === 0) solPrice = 145.82;

        // Aplicar preços
        const otherMints = tokenList.filter(t => t.symbol !== 'SOL').map(t => t.mint).join(',');
        let jupData: any = {};

        if (otherMints) {
            const jupAll = await fetch(`https://api.jup.ag/price/v2?ids=${otherMints}`).catch(() => null);
            if (jupAll?.ok) {
                const res = await jupAll.json();
                jupData = res.data || {};
            }
        }

        return tokenList.map(token => {
            const t = { ...token };
            if (token.symbol === 'SOL') {
                t.price = solPrice;
            } else if (jupData[token.mint]) {
                t.price = parseFloat(jupData[token.mint].price);
            }

            if (t.price) {
                t.valueUsd = (t.amount / Math.pow(10, t.decimals)) * t.price;
            }
            return t;
        });
    };

    const fetchBalances = useCallback(async (isSilent = false) => {
        if (!walletAddress) return;

        if (!isSilent) setLoading(true);
        try {
            if (!connectionRef.current) {
                connectionRef.current = new Connection(RPC_ENDPOINT, 'confirmed');
            }
            const connection = connectionRef.current;
            const pubKey = new PublicKey(walletAddress);

            const [solBalance, tokenAccounts] = await Promise.all([
                connection.getBalance(pubKey),
                connection.getParsedTokenAccountsByOwner(pubKey, { programId: TOKEN_PROGRAM_ID })
            ]);

            const tokenList: TokenData[] = [];

            // Add SOL
            tokenList.push({
                mint: 'So11111111111111111111111111111111111111112',
                amount: solBalance,
                decimals: 9,
                symbol: 'SOL',
                name: 'Solana',
                image: 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/So11111111111111111111111111111111111111112/logo.png',
                price: null,
            });

            // Add SPL
            tokenAccounts.value.forEach((account) => {
                const info = account.account.data.parsed.info;
                if (info.tokenAmount.uiAmount > 0) {
                    tokenList.push({
                        mint: info.mint,
                        amount: Number(info.tokenAmount.amount),
                        decimals: info.tokenAmount.decimals,
                        symbol: truncateMint(info.mint),
                        price: null,
                    });
                }
            });

            const enriched = await fetchRealPrices(tokenList);
            enriched.sort((a, b) => (b.valueUsd || 0) - (a.valueUsd || 0));

            setTokens(enriched);
            setError(null);
        } catch (err: any) {
            console.error("TokenMonitorSyncError:", err);
            setError("Erro ao sincronizar");
        } finally {
            if (!isSilent) setLoading(false);
        }
    }, [walletAddress]);

    useEffect(() => {
        if (!walletAddress) return;
        fetchBalances();

        const connection = new Connection(RPC_ENDPOINT, 'confirmed');
        const pubKey = new PublicKey(walletAddress);

        // Instant update on SOL change
        const subId = connection.onAccountChange(pubKey, () => fetchBalances(true), 'confirmed');
        const interval = setInterval(() => fetchBalances(true), 15000);

        return () => {
            connection.removeAccountChangeListener(subId);
            clearInterval(interval);
        };
    }, [walletAddress, fetchBalances]);

    return { tokens, loading, error, refresh: () => fetchBalances() };
};
