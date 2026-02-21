import { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { Connection, PublicKey, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { useNetwork } from '@/contexts/NetworkContext';
import { getRpcUrl } from '@/utils/solana-config';

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

const TOKEN_PROGRAM_ID_STR = 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA';
const TOKEN_2022_PROGRAM_ID_STR = 'TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb';

const TOKEN_PROGRAM_ID = new PublicKey(TOKEN_PROGRAM_ID_STR);
const TOKEN_2022_PROGRAM_ID = new PublicKey(TOKEN_2022_PROGRAM_ID_STR);

const HELIUS_API_KEY = process.env.NEXT_PUBLIC_HELIUS_API_KEY;

const tryGetPublicKey = (address: string | null | undefined): PublicKey | null => {
    if (!address) return null;
    try {
        const cleanAddress = address.trim();
        if (cleanAddress.length < 32 || cleanAddress.length > 44) return null;
        return new PublicKey(cleanAddress);
    } catch (e) {
        return null;
    }
};

const getRpcEndpoint = (network: string) => {
    return getRpcUrl(network as any);
};

const truncateMint = (mint?: string) => {
    if (!mint || mint.length < 8) return mint || 'Unknown';
    return `${mint.slice(0, 4)}...${mint.slice(-4)}`;
};

export const useTokenMonitor = (walletAddress: string | null): UseTokenMonitorReturn => {
    const { network, connection } = useNetwork();
    const [tokens, setTokens] = useState<TokenData[]>([]);
    const [loading, setLoading] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);

    const fetchRealPrices = async (tokenList: TokenData[]) => {
        if (tokenList.length === 0) return tokenList;
        let solPrice = 0;
        try {
            const jupRes = await fetch(`https://api.jup.ag/price/v2?ids=So11111111111111111111111111111111111111112`).catch(() => null);
            if (jupRes?.ok) {
                const data = await jupRes.json();
                const price = data.data?.['So11111111111111111111111111111111111111112']?.price;
                if (price) solPrice = parseFloat(price);
                console.log(`[useTokenMonitor] Preço SOL Jupiter: $${solPrice}`);
            }
        } catch (e) { console.warn("[useTokenMonitor] Price error (Jupiter):", e); }

        // Fallback robusto para SOL se Jupiter falhar
        if (solPrice === 0) {
            try {
                const cgRes = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd').catch(() => null);
                if (cgRes?.ok) {
                    const data = await cgRes.json();
                    if (data?.solana?.usd) {
                        solPrice = parseFloat(data.solana.usd);
                        console.log(`[useTokenMonitor] Preço SOL CoinGecko: $${solPrice}`);
                    }
                }
            } catch (e) { console.warn("[useTokenMonitor] Price error (CoinGecko):", e); }
        }

        if (solPrice === 0) {
            try {
                const dexRes = await fetch('https://api.dexscreener.com/latest/dex/tokens/So11111111111111111111111111111111111111112').catch(() => null);
                if (dexRes?.ok) {
                    const data = await dexRes.json();
                    if (data?.pairs?.length > 0) {
                        const wsolPairs = data.pairs.filter((p: any) => p.baseToken?.address === 'So11111111111111111111111111111111111111112' && p.priceUsd);
                        if (wsolPairs.length > 0) {
                            wsolPairs.sort((a: any, b: any) => (b.liquidity?.usd || 0) - (a.liquidity?.usd || 0));
                            solPrice = parseFloat(wsolPairs[0].priceUsd);
                            console.log(`[useTokenMonitor] Preço SOL DexScreener: $${solPrice}`);
                        }
                    }
                }
            } catch (e) { console.warn("[useTokenMonitor] Price error (DexScreener):", e); }
        }

        if (solPrice === 0) {
            try {
                const bitRes = await fetch('https://api.binance.com/api/v3/ticker/price?symbol=SOLUSDT').catch(() => null);
                if (bitRes?.ok) {
                    const data = await bitRes.json();
                    solPrice = parseFloat(data.price);
                    console.log(`[useTokenMonitor] Preço SOL Binance: $${solPrice}`);
                }
            } catch (e) { console.warn("[useTokenMonitor] Price error (Binance):", e); }
        }

        if (solPrice === 0) solPrice = 145.82;

        const otherTokens = tokenList.filter(t => t.symbol !== 'SOL');
        const mints = otherTokens.map(t => t.mint).filter(Boolean);

        let priceMap: Record<string, number> = {};

        if (mints.length > 0) {
            try {
                const jupAll = await fetch(`https://api.jup.ag/price/v2?ids=${mints.join(',')}`).catch(() => null);
                if (jupAll?.ok) {
                    const res = await jupAll.json();
                    Object.entries(res.data || {}).forEach(([mint, data]: [string, any]) => {
                        priceMap[mint] = parseFloat(data.price);
                    });
                }

                // Fallback de preço DexScreener (Crucial para moedas menores)
                const missingMints = mints.filter(m => !priceMap[m]);
                if (missingMints.length > 0) {
                    console.log(`[useTokenMonitor] Buscando preços no DexScreener para: ${missingMints.join(', ')}`);
                    const dexRes = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${missingMints.slice(0, 30).join(',')}`).catch(() => null);
                    if (dexRes?.ok) {
                        const dexData = await dexRes.json();
                        // Agrupa pares por baseToken para pegar o de maior liquidez
                        const pairsByMint: Record<string, any> = {};
                        (dexData.pairs || []).forEach((pair: any) => {
                            const baseAddr = pair.baseToken?.address;
                            if (!baseAddr || !pair.priceUsd) return;
                            const existing = pairsByMint[baseAddr];
                            const liq = pair.liquidity?.usd || 0;
                            if (!existing || liq > (existing.liquidity?.usd || 0)) {
                                pairsByMint[baseAddr] = pair;
                            }
                        });
                        Object.entries(pairsByMint).forEach(([addr, pair]: [string, any]) => {
                            if (!priceMap[addr]) {
                                priceMap[addr] = parseFloat(pair.priceUsd);
                                console.log(`[useTokenMonitor] DexScreener preço para ${addr}: $${pair.priceUsd}`);
                            }
                        });
                    }
                }
            } catch (e) { console.warn("[useTokenMonitor] Price enrichment error:", e); }
        }

        return tokenList.map(token => {
            const t = { ...token };
            const amount = t.amount / Math.pow(10, t.decimals);

            if (token.symbol === 'SOL') {
                t.price = solPrice;
            } else if (priceMap[token.mint]) {
                // Preço encontrado nas APIs externas (Jupiter / DexScreener)
                t.price = priceMap[token.mint];
            } else if (token.price && token.price > 0) {
                // Preço já veio do Helius getAsset (price_info) — mantém
                t.price = token.price;
            }

            if (t.price) {
                t.valueUsd = amount * t.price;
            }
            return t;
        });
    };

    const runManualFallback = useCallback(async (pubKey: PublicKey, existingList: TokenData[]) => {
        console.log(`[useTokenMonitor] Buscando saldos via RPC para: ${pubKey.toBase58()}`);
        try {
            const [tokenAccounts, token2022Accounts] = await Promise.all([
                connection.getParsedTokenAccountsByOwner(pubKey, { programId: TOKEN_PROGRAM_ID }),
                connection.getParsedTokenAccountsByOwner(pubKey, { programId: TOKEN_2022_PROGRAM_ID })
            ]);

            const processAccounts = (accounts: any[]) => {
                accounts.forEach((account) => {
                    const info = account.account.data.parsed.info;
                    const mint = info.mint;
                    const uiAmount = info.tokenAmount.uiAmount || 0;
                    const decimals = info.tokenAmount.decimals;
                    const rawAmount = String(info.tokenAmount.amount);

                    if (parseFloat(rawAmount) > 0) {
                        const exists = existingList.find(t => t.mint === mint);
                        if (exists) {
                            exists.amount = parseFloat(rawAmount);
                            return;
                        }

                        console.log(`[useTokenMonitor] Token RPC: ${mint}, Qtd: ${uiAmount}`);
                        existingList.push({
                            mint,
                            amount: parseFloat(rawAmount),
                            decimals: decimals || 0,
                            symbol: truncateMint(mint),
                            price: null,
                        });
                    }
                });
            };

            processAccounts(tokenAccounts.value);
            processAccounts(token2022Accounts.value);
        } catch (e) {
            console.error("[useTokenMonitor] RPC Fallback falhou:", e);
        }
    }, [connection]);

    const fetchBalances = useCallback(async (isSilent = false) => {
        const pubKey = tryGetPublicKey(walletAddress);
        if (!pubKey) return;

        if (!isSilent) setLoading(true);

        try {
            const rpcUrl = getRpcEndpoint(network);
            const solBalance = await connection.getBalance(pubKey);
            const tokenList: TokenData[] = [];

            tokenList.push({
                mint: 'So11111111111111111111111111111111111111112',
                amount: solBalance,
                decimals: 9,
                symbol: 'SOL',
                name: 'Solana',
                image: 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/So11111111111111111111111111111111111111112/logo.png',
                price: null,
            });

            if (HELIUS_API_KEY) {
                try {
                    // Usa a API REST da Helius para listar token accounts (mais confiável que DAS para fungíveis)
                    const heliusRestUrl = `https://${network === 'mainnet' ? 'mainnet' : 'devnet'}.helius-rpc.com/?api-key=${HELIUS_API_KEY}`;
                    console.log(`[useTokenMonitor] Buscando token accounts via Helius REST para: ${walletAddress}`);

                    const taResponse = await fetch(heliusRestUrl, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            jsonrpc: '2.0',
                            id: 'get-token-accounts',
                            method: 'getTokenAccountsByOwner',
                            params: [
                                walletAddress,
                                { programId: TOKEN_PROGRAM_ID_STR },
                                { encoding: 'jsonParsed' }
                            ]
                        })
                    });
                    const taData = await taResponse.json();
                    const taAccounts = taData.result?.value || [];

                    // Token 2022
                    const ta2022Response = await fetch(heliusRestUrl, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            jsonrpc: '2.0',
                            id: 'get-token-2022-accounts',
                            method: 'getTokenAccountsByOwner',
                            params: [
                                walletAddress,
                                { programId: TOKEN_2022_PROGRAM_ID_STR },
                                { encoding: 'jsonParsed' }
                            ]
                        })
                    });
                    const ta2022Data = await ta2022Response.json();
                    const ta2022Accounts = ta2022Data.result?.value || [];

                    const allAccounts = [...taAccounts, ...ta2022Accounts];
                    console.log(`[useTokenMonitor] Helius RPC encontrou ${allAccounts.length} token accounts.`);

                    // Coleta mints com saldo > 0
                    const mintsToEnrich: string[] = [];
                    allAccounts.forEach((account: any) => {
                        const info = account.account?.data?.parsed?.info;
                        if (!info) return;
                        const mint = info.mint;
                        const rawAmount = String(info.tokenAmount?.amount || '0');
                        if (parseFloat(rawAmount) > 0 && mint !== 'So11111111111111111111111111111111111111112') {
                            const exists = tokenList.find(t => t.mint === mint);
                            if (!exists) {
                                tokenList.push({
                                    mint,
                                    amount: parseFloat(rawAmount),
                                    decimals: info.tokenAmount?.decimals || 0,
                                    symbol: truncateMint(mint), // placeholder, será enriquecido abaixo
                                    name: '',
                                    image: '',
                                    price: null,
                                });
                                mintsToEnrich.push(mint);
                            }
                        }
                    });

                    // Enriquece com metadados via getAsset em batch
                    if (mintsToEnrich.length > 0) {
                        console.log(`[useTokenMonitor] Enriquecendo ${mintsToEnrich.length} tokens com metadados...`);
                        const assetResponse = await fetch(heliusRestUrl, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                jsonrpc: '2.0',
                                id: 'get-assets-batch',
                                method: 'getAssets',
                                params: { ids: mintsToEnrich }
                            })
                        });
                        const assetData = await assetResponse.json();
                        const assets: any[] = assetData.result || [];

                        assets.forEach((asset: any) => {
                            const idx = tokenList.findIndex(t => t.mint === asset.id);
                            if (idx === -1) return;
                            const info = asset.token_info;
                            tokenList[idx].symbol = info?.symbol || asset.content?.metadata?.symbol || truncateMint(asset.id);
                            tokenList[idx].name = asset.content?.metadata?.name || info?.symbol || tokenList[idx].symbol;
                            tokenList[idx].image = asset.content?.links?.image || asset.content?.files?.[0]?.uri || '';
                            if (info?.price_info?.price_per_token) {
                                tokenList[idx].price = info.price_info.price_per_token;
                            }
                        });
                    }
                } catch (e) { console.warn("[useTokenMonitor] Helius token fetch failed.", e); }
            }

            // SEMPRE executa o fallback para garantir capturar moedas que o indexador ainda não viu
            await runManualFallback(pubKey, tokenList);

            const enriched = await fetchRealPrices(tokenList);
            enriched.sort((a, b) => (b.valueUsd || 0) - (a.valueUsd || 0));

            setTokens(enriched);
            setError(null);
            console.log(`[useTokenMonitor] Sync completo. Carteira: ${pubKey.toBase58()}, Moedas: ${enriched.length}`);
        } catch (err: any) {
            console.error("TokenMonitorError:", err);
            setError("Erro na sincronização");
        } finally {
            if (!isSilent) setLoading(false);
        }
    }, [walletAddress, network, connection, runManualFallback]);

    useEffect(() => {
        const pubKey = tryGetPublicKey(walletAddress);
        if (!pubKey) {
            setTokens([]);
            return;
        }
        fetchBalances();
        const subId = connection.onAccountChange(pubKey, () => fetchBalances(true), 'confirmed');
        const interval = setInterval(() => fetchBalances(true), 30000);
        return () => {
            connection.removeAccountChangeListener(subId);
            clearInterval(interval);
        };
    }, [walletAddress, fetchBalances, connection]);

    return { tokens, loading, error, refresh: () => fetchBalances() };
};
