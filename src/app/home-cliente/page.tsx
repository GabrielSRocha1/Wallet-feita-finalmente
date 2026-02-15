"use client";

import React, { useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useWallet } from "@/contexts/WalletContext";
import { useTokenMonitor } from "@/hooks/useTokenMonitor";
import ConnectWalletModal from "@/components/ConnectWalletModal";
import { NETWORK } from "@/utils/solana-config";

export default function HomeClientePage() {
    const router = useRouter();
    const { connected, publicKey, isAdmin: isAdminUser, disconnectWallet } = useWallet();
    const { tokens: walletTokens, loading: loadingTokens } = useTokenMonitor(publicKey);
    const [isWalletDropdownOpen, setIsWalletDropdownOpen] = useState(false);
    const [isConnectModalOpen, setIsConnectModalOpen] = useState(false);
    const [contracts, setContracts] = useState<any[]>([]);
    const [activeFilter, setActiveFilter] = useState("em-andamento");
    const [searchQuery, setSearchQuery] = useState("");

    useEffect(() => {
        const saved = localStorage.getItem("created_contracts");
        if (saved) {
            try {
                const parsed = JSON.parse(saved);
                if (Array.isArray(parsed)) {
                    setContracts(parsed);
                }
            } catch (e) {
                console.error("Error loading contracts:", e);
            }
        }
    }, []);

    // Automação de Status e Auto-reivindicação
    useEffect(() => {
        const processAutomation = () => {
            const saved = localStorage.getItem("created_contracts");
            if (!saved) return;

            try {
                const allContracts = JSON.parse(saved);
                let hasChanges = false;

                const updated = allContracts.map((contract: any) => {
                    let c = { ...contract };

                    // 1. Cálculo de progresso atual
                    if (c.vestingStartDate && c.vestingDuration && c.status !== "cancelado") {
                        const [datePart, timePart] = c.vestingStartDate.split(', ');
                        const [day, month, year] = datePart.split('/').map(Number);
                        const [hour, minute] = timePart.split(':').map(Number);
                        const start = new Date(year, month - 1, day, hour, minute).getTime();
                        const now = Date.now();

                        if (now >= start) {
                            const duration = parseInt(c.vestingDuration);
                            const unit = (c.selectedTimeUnit || "").toLowerCase();
                            let durationMs = 3600000;
                            if (unit.includes('minuto')) durationMs = duration * 60 * 1000;
                            else if (unit.includes('hora')) durationMs = duration * 3600000;
                            else if (unit.includes('dia')) durationMs = duration * 86400000;
                            else if (unit.includes('semana')) durationMs = duration * 7 * 86400000;
                            else if (unit.includes('mês') || unit.includes('mes')) durationMs = duration * 30 * 86400000;
                            else durationMs = duration * 365 * 86400000;

                            const progress = Math.min(1, (now - start) / durationMs);

                            // Automação: Status Completo
                            if (progress >= 1 && c.status !== "completo") {
                                c.status = "completo";
                                hasChanges = true;
                            }

                            // Automação: Auto-reivindicação
                            if (c.autoClaim) {
                                const total = c.totalAmount || 0;
                                const unlocked = total * progress;
                                if (c.claimedAmount !== unlocked) {
                                    c.claimedAmount = unlocked;
                                    hasChanges = true;
                                }
                            }
                        }
                    }

                    return c;
                });

                if (hasChanges) {
                    localStorage.setItem("created_contracts", JSON.stringify(updated));
                    setContracts(updated);
                }
            } catch (e) { console.error(e); }
        };

        const timer = setInterval(processAutomation, 5000); // Check every 5s
        processAutomation(); // Run once on mount
        return () => clearInterval(timer);
    }, []);

    const formatAddress = (addr: string) => {
        if (!addr) return "...";
        return `${addr.substring(0, 5)}...${addr.substring(addr.length - 5)}`;
    };

    const handleDisconnect = async () => {
        await disconnectWallet();
        setIsWalletDropdownOpen(false);
        window.location.reload();
    };

    const toggleNetwork = () => {
        const next = NETWORK === 'mainnet' ? 'devnet' : 'mainnet';
        localStorage.setItem('verum_solana_network', next);
        window.location.reload();
    };

    const handleCopyAddress = () => {
        if (publicKey) {
            navigator.clipboard.writeText(publicKey);
            setIsWalletDropdownOpen(false);
        }
    };

    // Unifica saldo da carteira com saldos em vesting (para destinatários)
    const unifiedTokens = React.useMemo(() => {
        if (!connected || !publicKey) return [];

        // Inicia com os tokens reais da carteira
        const baseTokens = walletTokens.map(t => ({
            ...t,
            liquidAmount: t.amount / Math.pow(10, t.decimals),
            claimableAmount: 0,
            lockedAmount: 0,
            hasVesting: false
        }));

        // Filtra contratos onde o usuário é o destinatário
        const recipientContracts = contracts.filter((c: any) =>
            c.recipients?.some((r: any) => r.walletAddress?.toLowerCase() === publicKey.toLowerCase())
        );

        // Adiciona/Mescla saldos de vesting
        recipientContracts.forEach((contract: any) => {
            const sym = contract.selectedToken?.symbol || contract.tokenSymbol || "TKN";
            const mint = contract.selectedToken?.mint || contract.mintAddress || "Unknown";

            const recipientData = contract.recipients?.find((r: any) => r.walletAddress?.toLowerCase() === publicKey.toLowerCase());
            if (!recipientData) return;

            const total = parseFloat(recipientData.amount) || 0;

            // --- Engine de Cáculo Dinâmico (Real-time Simulation) ---
            const calculateSimulatedUnlocked = () => {
                if (!contract.vestingStartDate || !contract.vestingDuration) return 0;
                try {
                    const [datePart, timePart] = contract.vestingStartDate.split(', ');
                    const [day, month, year] = datePart.split('/').map(Number);
                    const [hour, minute] = timePart.split(':').map(Number);
                    const start = new Date(year, month - 1, day, hour, minute).getTime();
                    const now = Date.now();

                    if (now < start) return 0;

                    const duration = parseInt(contract.vestingDuration);
                    const unit = (contract.selectedTimeUnit || "").toLowerCase();
                    let durationMs = 0;
                    if (unit.includes('minuto')) durationMs = duration * 60 * 1000;
                    else if (unit.includes('hora')) durationMs = duration * 60 * 60 * 1000;
                    else if (unit.includes('dia')) durationMs = duration * 24 * 60 * 60 * 1000;
                    else if (unit.includes('semana')) durationMs = duration * 7 * 24 * 60 * 60 * 1000;
                    else if (unit.includes('mês') || unit.includes('mes')) durationMs = duration * 30 * 24 * 60 * 60 * 1000;
                    else durationMs = duration * 365 * 24 * 60 * 60 * 1000;

                    const elapsed = now - start;
                    const progress = Math.min(1, elapsed / durationMs);
                    return total * progress;
                } catch (e) { return 0; }
            };

            const unlocked = calculateSimulatedUnlocked();
            const claimed = contract.claimedAmount || 0;

            const claimable = Math.max(0, unlocked - claimed);
            const locked = Math.max(0, total - unlocked);
            // --------------------------------------------------------

            const existingIdx = baseTokens.findIndex(t => t.mint === mint || t.symbol === sym);

            if (existingIdx > -1) {
                baseTokens[existingIdx].claimableAmount += claimable;
                baseTokens[existingIdx].lockedAmount += locked;
                baseTokens[existingIdx].hasVesting = true;
            } else {
                baseTokens.push({
                    mint,
                    amount: 0,
                    decimals: 9,
                    symbol: sym,
                    name: contract.selectedToken?.name || sym,
                    image: contract.selectedToken?.icon,
                    price: contract.selectedToken?.price || 0,
                    liquidAmount: 0,
                    claimableAmount: claimable,
                    lockedAmount: locked,
                    hasVesting: true,
                    valueUsd: 0
                });
            }
        });

        // Recalcula valores finais
        return baseTokens.map(token => {
            const unlockedTotal = token.liquidAmount + token.claimableAmount;
            const totalWithLocked = unlockedTotal + token.lockedAmount;
            const price = token.price || 0;

            return {
                ...token,
                displayAmount: unlockedTotal,
                totalValueUsd: totalWithLocked * price,
                rowValueUsd: unlockedTotal * price,
                absoluteTotal: totalWithLocked
            };
        }).sort((a, b) => {
            // Primeiro ordena por valor USD real (líquido)
            if ((b.rowValueUsd || 0) !== (a.rowValueUsd || 0)) {
                return (b.rowValueUsd || 0) - (a.rowValueUsd || 0);
            }
            // Se empatar no USD (ex: ambos $0), ordena pelo total absoluto (bloqueado + líquido)
            return (b.absoluteTotal || 0) - (a.absoluteTotal || 0);
        });
    }, [walletTokens, contracts, connected, publicKey]);

    // Filter Logic - Normalized for active category selection
    const relevantContracts = React.useMemo(() => {
        if (!publicKey) return [];
        if (isAdminUser) return contracts;
        return contracts.filter((c: any) =>
            c.recipients?.some((r: any) => r.walletAddress?.toLowerCase() === publicKey.toLowerCase()) ||
            c.senderAddress?.toLowerCase() === publicKey.toLowerCase()
        );
    }, [contracts, publicKey, isAdminUser]);

    const filteredByStatus = relevantContracts.filter((contract: any) => {
        const query = searchQuery.toLowerCase().trim();

        // If searching, ignore status filter (Global Search)
        if (query) {
            const matchesTitle = contract.recipients?.[0]?.contractTitle?.toLowerCase().includes(query);
            const matchesWallet = contract.recipients?.some((r: any) =>
                r.walletAddress?.toLowerCase().includes(query)
            );
            return matchesTitle || matchesWallet;
        }

        // Status Filter (Used when not searching)
        if (activeFilter === "all") return true;

        // Normalize status: lowercase and replace spaces/newlines with dashes
        const rawStatus = contract.status || "em-andamento";
        const contractStatus = rawStatus
            .toLowerCase()
            .replace(/[\n\r\s]+/g, '-')
            .trim();

        // Tab mapping:
        // 'em-andamento' tab covers: 'em-andamento', 'bloqueado' and default/empty states
        if (activeFilter === "em-andamento") {
            return (
                contractStatus === "em-andamento" ||
                contractStatus === "bloqueado" ||
                contractStatus === "agendado" ||
                contractStatus === ""
            );
        }

        return contractStatus === activeFilter;
    });

    return (
        <div className="bg-black min-h-screen text-white pb-48 font-sans select-none safe-container">
            <style dangerouslySetInnerHTML={{
                __html: `
                ::-webkit-scrollbar {
                    width: 0px;
                    background: transparent;
                }
            `}} />

            {/* Header - Standardized */}
            <header className="fixed top-0 left-1/2 -translate-x-1/2 w-full max-w-screen-md z-[100] bg-black/80 backdrop-blur-md border-b border-white/5 safe-header">
                <div className="px-4 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <span className="text-[#EAB308] font-bold text-lg tracking-wide gold-text-gradient">Verum Vesting</span>
                        <button
                            onClick={toggleNetwork}
                            className={`text-[9px] font-black px-2 py-0.5 rounded border transition-colors ${NETWORK === 'mainnet'
                                    ? 'bg-green-500/10 text-green-500 border-green-500/30'
                                    : 'bg-yellow-500/10 text-yellow-500 border-yellow-500/30'
                                }`}
                        >
                            {NETWORK.toUpperCase()}
                        </button>
                    </div>

                    {!connected ? (
                        <button
                            onClick={() => setIsConnectModalOpen(true)}
                            className="bg-[#EAB308] hover:bg-[#CA8A04] text-black text-xs font-bold py-2.5 px-5 rounded-xl transition-all active:scale-95 shadow-lg cursor-pointer"
                        >
                            Conectar carteira
                        </button>
                    ) : (
                        <div className="relative">
                            <button
                                onClick={() => setIsWalletDropdownOpen(!isWalletDropdownOpen)}
                                className="w-48 bg-zinc-900 border border-white/10 px-4 py-2 rounded-xl flex items-center justify-between gap-2 hover:bg-zinc-800 transition-colors cursor-pointer"
                            >
                                <span className="text-xs font-mono text-zinc-400 font-medium whitespace-nowrap">
                                    {formatAddress(publicKey || "")}
                                </span>
                                <span className="material-icons-round text-sm text-zinc-500">expand_more</span>
                            </button>

                            {isWalletDropdownOpen && (
                                <div className="absolute right-0 mt-2 w-48 bg-zinc-900 border border-white/10 rounded-xl shadow-2xl overflow-hidden z-50 animate-in fade-in zoom-in-95 duration-200">
                                    <button
                                        onClick={handleCopyAddress}
                                        className="w-full px-4 py-3 text-left text-sm hover:bg-white/5 transition-colors flex items-center gap-2 cursor-pointer text-zinc-300"
                                    >
                                        <span className="material-icons-round text-sm">content_copy</span>
                                        Copiar Endereço
                                    </button>
                                    <button
                                        onClick={() => {
                                            if (confirm("Deseja realmente apagar todos os contratos e dados de teste?")) {
                                                localStorage.clear();
                                                window.location.href = "/";
                                            }
                                        }}
                                        className="w-full px-4 py-3 text-left text-sm text-yellow-500 hover:bg-white/5 transition-colors flex items-center gap-2 border-t border-white/5 cursor-pointer mt-1"
                                    >
                                        <span className="material-icons-round text-sm">delete_sweep</span>
                                        Limpar todos os dados
                                    </button>
                                    <button
                                        onClick={handleDisconnect}
                                        className="w-full px-4 py-3 text-left text-sm text-red-500 hover:bg-white/5 transition-colors flex items-center gap-2 border-t border-white/5 cursor-pointer mt-1"
                                    >
                                        <span className="material-icons-round text-sm">logout</span>
                                        Desconectar
                                    </button>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </header>

            <main className="px-4 space-y-8 relative z-10 pt-24 text-center sm:text-left pb-32">
                {/* Title & Actions */}
                <div className="flex justify-between items-center">
                    <div className="flex flex-col">
                        <h1 className="text-xl font-bold text-zinc-100 uppercase tracking-tight">Aquisição de Direitos</h1>
                        {connected && isAdminUser && (
                            <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest mt-1 text-left">
                                Filtro: {activeFilter.replace('-', ' ')}
                            </p>
                        )}
                    </div>
                    {connected && isAdminUser && (
                        <button
                            onClick={() => router.push('/configuracao')}
                            className="bg-[#EAB308] hover:bg-[#CA8A04] text-black text-xs font-bold py-2 px-5 rounded-xl flex items-center gap-1.5 shadow-lg cursor-pointer active:scale-95 transition-all"
                        >
                            <span className="material-icons-round text-sm">add</span>
                            Criar novo
                        </button>
                    )}
                </div>

                {/* Client Balance Section (Top) - Recalculated Total Balance (Wallet + Vesting) */}
                {connected && (
                    <div className="pt-2 text-left animate-in fade-in slide-in-from-top-4 duration-500">
                        <div className="flex items-center gap-2 mb-1">
                            <h2 className="text-zinc-500 text-[10px] font-bold uppercase tracking-widest">Saldo Total da Carteira</h2>
                            <span className="text-[8px] px-1 bg-zinc-800 text-zinc-400 rounded border border-white/5 uppercase">{NETWORK}</span>
                        </div>
                        <div className="flex items-baseline gap-2">
                            <p className="text-white text-4xl font-bold tracking-tight">
                                ${unifiedTokens.length > 0 ?
                                    (unifiedTokens.reduce((sum: number, token: any) => sum + (token.totalValueUsd || 0), 0)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                                    : '0.00'
                                }
                            </p>
                            {loadingTokens ? (
                                <span className="text-[10px] text-[#EAB308] animate-pulse font-bold uppercase ml-2">Sincronizando...</span>
                            ) : unifiedTokens.length === 0 && (
                                <button
                                    onClick={toggleNetwork}
                                    className="text-[9px] text-[#EAB308] hover:underline font-bold uppercase ml-2"
                                >
                                    Nada aqui? Tentar {NETWORK === 'mainnet' ? 'Devnet' : 'Mainnet'}
                                </button>
                            )}
                        </div>
                    </div>
                )}

                {/* Unified Token List - Direct Holdings + Vesting Assets */}
                {connected && unifiedTokens.length > 0 && (
                    <div className="space-y-3 animate-in fade-in slide-in-from-top-4 duration-500">
                        {unifiedTokens.map((token) => {
                            const symbol = token.symbol || "???";
                            const tokenPrice = token.price || 0;
                            const totalValueUsd = token.valueUsd || 0;

                            return (
                                <div
                                    key={token.mint}
                                    className="bg-zinc-900/60 border border-white/5 rounded-2xl p-4 flex items-center justify-between shadow-lg hover:bg-zinc-900/80 transition-all group"
                                >
                                    {/* Left: Token Icon & Name */}
                                    <div className="flex items-center gap-3">
                                        {token.image ? (
                                            <div className="relative w-12 h-12 rounded-full border-2 border-[#EAB308]/20 p-1 bg-black flex items-center justify-center overflow-hidden">
                                                <img
                                                    alt={`${symbol} Logo`}
                                                    className="w-full h-full object-contain"
                                                    src={token.image}
                                                />
                                            </div>
                                        ) : (
                                            <div className="w-12 h-12 rounded-full border-2 border-[#EAB308]/20 bg-zinc-800 flex items-center justify-center font-black text-[#EAB308] text-lg">
                                                {symbol?.[0] || "T"}
                                            </div>
                                        )}
                                        <div>
                                            <div className="flex items-center gap-2">
                                                <h3 className="font-bold text-zinc-100 text-base uppercase tracking-wide">
                                                    {token.name || symbol}
                                                </h3>
                                                {token.hasVesting && (
                                                    <span className="bg-[#EAB308]/10 text-[#EAB308] text-[8px] font-black px-1.5 py-0.5 rounded border border-[#EAB308]/20 uppercase tracking-tighter">
                                                        Vesting
                                                    </span>
                                                )}
                                            </div>
                                            <p className="text-zinc-500 text-xs font-mono">
                                                {tokenPrice > 0 ? `$${tokenPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 })}` : 'Preço indisponível'}
                                            </p>
                                        </div>
                                    </div>

                                    <div className="text-right">
                                        <span className={`font-bold text-base block ${token.rowValueUsd > 0 ? 'text-zinc-200' : 'text-zinc-500'}`}>
                                            ${token.rowValueUsd.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                        </span>
                                        <div className="flex flex-col items-end">
                                            <p className="text-zinc-500 text-xs font-mono whitespace-nowrap">
                                                {token.displayAmount.toLocaleString(undefined, { maximumFractionDigits: 6 })} {symbol}
                                            </p>
                                            {token.hasVesting && (
                                                <p className="text-[9px] text-zinc-600 font-bold uppercase tracking-tight mt-0.5">
                                                    {token.liquidAmount.toLocaleString(undefined, { maximumFractionDigits: 2 })} liq.
                                                    <span className="mx-1">•</span>
                                                    {token.claimableAmount > 0 ? `${token.claimableAmount.toLocaleString(undefined, { maximumFractionDigits: 2 })} claim.` : `${token.lockedAmount.toLocaleString(undefined, { maximumFractionDigits: 2 })} bloq.`}
                                                </p>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}

                {/* Search - Only visible when connected */}
                {connected && isAdminUser && (
                    <div className="relative">
                        <span className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                            <span className="material-icons-outlined text-zinc-500 text-lg">search</span>
                        </span>
                        <input
                            className="w-full bg-zinc-900 border border-white/5 text-zinc-200 text-sm rounded-2xl pl-12 pr-4 py-3.5 focus:outline-none focus:border-[#EAB308]/50 transition-colors placeholder-zinc-600 shadow-inner"
                            placeholder="Procurar contratos..."
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>
                )}

                {/* Contracts List / Connection Block */}
                <div className="space-y-4">
                    {connected ? (
                        filteredByStatus.length > 0 ? (
                            filteredByStatus.map((contract: any) => (
                                <div
                                    key={contract.id}
                                    onClick={() => {
                                        localStorage.setItem("selected_contract", JSON.stringify(contract));
                                        router.push("/contrato-detalhes");
                                    }}
                                    className="bg-zinc-900/40 border border-white/5 rounded-[24px] p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center gap-4 text-[10px] sm:text-xs overflow-hidden cursor-pointer hover:bg-zinc-800/60 hover:border-[#EAB308]/30 transition-all active:scale-[0.99] group shadow-sm text-left"
                                >
                                    <div className="flex items-center gap-3 min-w-[120px]">
                                        <div className="relative w-10 h-10 shrink-0 flex items-center justify-center rounded-full border-2 border-[#EAB308]/20 group-hover:border-[#EAB308]/40 transition-colors">
                                            {(() => {
                                                const total = contract.totalAmount || 1;
                                                const [datePart, timePart] = (contract.vestingStartDate || "01/01/2026, 00:00").split(', ');
                                                const [day, month, year] = datePart.split('/').map(Number);
                                                const [hour, minute] = timePart.split(':').map(Number);
                                                const start = new Date(year, month - 1, day, hour, minute).getTime();
                                                const now = Date.now();
                                                const duration = parseInt(contract.vestingDuration || "1");
                                                const unit = (contract.selectedTimeUnit || "").toLowerCase();
                                                let durationMs = 3600000;
                                                if (unit.includes('minuto')) durationMs = duration * 60 * 1000;
                                                else if (unit.includes('hora')) durationMs = duration * 3600000;
                                                else if (unit.includes('dia')) durationMs = duration * 86400000;
                                                const progress = Math.min(100, Math.max(0, Math.round(((now - start) / durationMs) * 100)) || 0);
                                                return <span className="text-[10px] text-[#EAB308] font-black">{progress}%</span>;
                                            })()}
                                        </div>
                                        <div className="flex flex-col text-zinc-500 leading-tight">
                                            <span className="text-[9px] text-zinc-400 font-bold uppercase tracking-tighter">Desbloqueado/Total</span>
                                            <span className="flex items-center gap-1 font-bold text-zinc-200">
                                                <span className="text-[#EAB308] text-[10px]">🔒</span>
                                                {(() => {
                                                    const total = contract.totalAmount || 0;
                                                    const [datePart, timePart] = (contract.vestingStartDate || "01/01/2026, 00:00").split(', ');
                                                    const [day, month, year] = datePart.split('/').map(Number);
                                                    const [hour, minute] = timePart.split(':').map(Number);
                                                    const start = new Date(year, month - 1, day, hour, minute).getTime();
                                                    const now = Date.now();
                                                    const duration = parseInt(contract.vestingDuration || "1");
                                                    const unit = (contract.selectedTimeUnit || "").toLowerCase();
                                                    let durationMs = 3600000;
                                                    if (unit.includes('minuto')) durationMs = duration * 60 * 1000;
                                                    else if (unit.includes('hora')) durationMs = duration * 3600000;
                                                    else if (unit.includes('dia')) durationMs = duration * 86400000;
                                                    const unlocked = total * Math.min(1, Math.max(0, (now - start) / durationMs));
                                                    return unlocked.toLocaleString(undefined, { maximumFractionDigits: 2 });
                                                })()} {contract.selectedToken?.symbol}
                                            </span>
                                            <span className="text-[9px] font-mono opacity-60">of {contract.totalAmount} {contract.selectedToken?.symbol}</span>
                                        </div>
                                    </div>
                                    <div className="h-10 w-px bg-white/5 hidden sm:block mx-3"></div>
                                    <div className="flex flex-col text-zinc-400 leading-tight min-w-[90px]">
                                        <span className="text-[9px] text-zinc-500 font-bold uppercase tracking-tighter mb-0.5">Data Início</span>
                                        <span className="text-zinc-300 font-medium">{contract.vestingStartDate?.split(',')[0] || "MM dd,yyyy"}</span>
                                        <span className="text-[10px] opacity-60">{contract.vestingStartDate?.split(',')[1] || "00:00 PM"}</span>
                                    </div>
                                    <div className="flex flex-col text-zinc-400 leading-tight flex-1 min-w-[110px]">
                                        <span className="text-[9px] text-zinc-500 font-bold uppercase tracking-tighter mb-0.5">Assunto/ID Contrato</span>
                                        <span className="text-zinc-200 font-bold truncate max-w-[130px]">{contract.recipients?.[0]?.contractTitle || "Sem título"}</span>
                                        <span className="flex items-center gap-1 text-[9px] opacity-60 font-mono">
                                            <span className="material-icons-outlined text-[10px]">content_copy</span>
                                            {formatAddress(contract.id)}
                                        </span>
                                    </div>
                                    <div className="flex flex-col text-zinc-400 leading-tight flex-1 min-w-[120px]">
                                        <span className="text-[9px] text-zinc-500 font-bold uppercase tracking-tighter mb-0.5">Direção</span>
                                        {(() => {
                                            const isSender = contract.senderAddress?.toLowerCase() === publicKey?.toLowerCase();
                                            const recipientAddr = contract.recipients?.[0]?.walletAddress || "";

                                            if (isSender) {
                                                return (
                                                    <>
                                                        <span className="text-[#EF4444] flex items-center gap-1 text-[9px] font-bold">
                                                            <span className="w-1.5 h-1.5 rounded-full bg-[#EF4444]"></span>
                                                            Enviando para
                                                        </span>
                                                        <span className="flex items-center gap-1 text-[10px] font-mono opacity-80">
                                                            <span className="material-icons-outlined text-[10px]">history</span>
                                                            {formatAddress(recipientAddr)}
                                                        </span>
                                                    </>
                                                );
                                            }
                                            return (
                                                <>
                                                    <span className="text-[#22C55E] flex items-center gap-1 text-[9px] font-bold">
                                                        <span className="w-1.5 h-1.5 rounded-full bg-[#22C55E]"></span>
                                                        Recebendo de
                                                    </span>
                                                    <span className="flex items-center gap-1 text-[10px] font-mono opacity-80">
                                                        <span className="material-symbols-outlined text-[10px]">account_balance_wallet</span>
                                                        {formatAddress(contract.senderAddress || "Unknown")}
                                                    </span>
                                                </>
                                            );
                                        })()}
                                    </div>
                                    <div className="flex flex-row sm:flex-col items-center sm:items-start justify-between sm:justify-start gap-1.5 w-full sm:w-auto mt-2 sm:mt-0 pt-3 sm:pt-0 border-t sm:border-t-0 border-white/5">
                                        <div className="flex flex-col sm:gap-1.5">
                                            <span className="text-[9px] text-zinc-500 font-bold uppercase tracking-tighter">Status</span>
                                            <span className={`px-2.5 py-1 rounded-lg text-[9px] font-black uppercase leading-none tracking-wider w-fit
                                                ${contract.status?.toLowerCase().includes('cancelado')
                                                    ? 'bg-[#EF4444]/20 text-[#EF4444] border border-[#EF4444]/30'
                                                    : 'bg-[#EAB308]/20 text-[#EAB308] border border-[#EAB308]/30'}`}>
                                                {contract.status?.replace('-', ' ') || "Em Andamento"}
                                            </span>
                                        </div>
                                        <span className="text-[#22C55E] text-[10px] font-bold hover:underline cursor-pointer uppercase tracking-tight">Ver Detalhes</span>
                                    </div>
                                </div>
                            ))
                        ) : (
                            <div className="dashed-container rounded-[32px] p-10 flex flex-col items-center justify-center text-center space-y-12 my-6 relative overflow-hidden">
                                <div className="flex flex-col items-center max-w-xs mx-auto z-10">
                                    <div className="w-16 h-16 bg-zinc-800/50 rounded-2xl flex items-center justify-center mb-6 border border-white/5">
                                        <span className="material-icons-outlined text-zinc-600 text-4xl">inventory_2</span>
                                    </div>
                                    <h3 className="text-white font-bold text-base mb-2">Nada por aqui</h3>
                                    <p className="text-zinc-500 text-sm leading-relaxed">Não encontramos nenhum contrato com este filtro nesta carteira.</p>
                                </div>
                                <div className="absolute inset-0 z-0 opacity-[0.03]" style={{ backgroundImage: 'radial-gradient(#EAB308 1px, transparent 1px)', backgroundSize: '24px 24px' }}></div>
                            </div>
                        )
                    ) : (
                        /* Guest State / No Wallet */
                        <div className="dashed-container rounded-[32px] p-10 flex flex-col items-center justify-center text-center space-y-12 my-6 relative overflow-hidden min-h-[400px]">
                            <div className="flex flex-col items-center max-w-xs mx-auto z-10">
                                <div className="w-20 h-20 bg-[#EAB308]/10 rounded-3xl flex items-center justify-center mb-8 border border-[#EAB308]/20 shadow-2xl">
                                    <span className="material-icons-outlined text-[#EAB308] text-5xl">account_balance_wallet</span>
                                </div>
                                <h3 className="text-white font-bold text-xl mb-3 tracking-tight">Conecte sua carteira</h3>
                                <p className="text-zinc-500 text-sm mb-10 leading-relaxed px-4">
                                    Acesse sua conta para visualizar seus contratos de aquisição e acompanhar seus rendimentos em tempo real.
                                </p>
                                <button
                                    onClick={() => setIsConnectModalOpen(true)}
                                    className="bg-[#EAB308] hover:bg-[#CA8A04] text-black text-sm font-bold py-4 px-10 rounded-2xl shadow-2xl w-full cursor-pointer transition-all active:scale-90 flex items-center justify-center gap-2"
                                >
                                    <span className="material-icons-round text-lg">login</span>
                                    Conectar agora
                                </button>
                            </div>
                            <div className="absolute inset-0 z-0 opacity-[0.05]" style={{ backgroundImage: 'radial-gradient(#EAB308 1.5px, transparent 1.5px)', backgroundSize: '32px 32px' }}></div>
                        </div>
                    )}
                </div>


            </main>

            {/* Bottom Nav - Only visible when connected */}
            {connected && (
                <nav className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-screen-md bg-black/95 backdrop-blur-md border-t border-white/10 px-2 sm:px-6 py-4 flex justify-between items-center z-[200] safe-footer shadow-[0_-10px_40px_rgba(0,0,0,0.8)]">
                    {/* EM ANDAMENTO - Visível para todos */}
                    <button
                        onClick={() => {
                            setActiveFilter("em-andamento");
                            setSearchQuery("");
                        }}
                        data-user-access="true"
                        data-tab-id="em-andamento"
                        className={`flex flex-col items-center gap-1 group flex-1 cursor-pointer transition-all ${activeFilter === 'em-andamento' && !searchQuery ? 'text-[#EAB308]' : 'text-zinc-500'}`}
                    >
                        <div className="relative">
                            <span className="material-icons-round text-xl sm:text-2xl">gesture</span>
                            {activeFilter === 'em-andamento' && !searchQuery && <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 bg-[#EAB308] rounded-full animate-pulse"></div>}
                        </div>
                        <span className="text-[8px] sm:text-[9px] font-black uppercase tracking-widest text-center">Andamento</span>
                    </button>

                    {/* AGENDADO - Visível para todos */}
                    <button
                        onClick={() => {
                            setActiveFilter("agendado");
                            setSearchQuery("");
                        }}
                        className={`flex flex-col items-center gap-1 group flex-1 cursor-pointer transition-all ${activeFilter === 'agendado' && !searchQuery ? 'text-[#EAB308]' : 'text-zinc-500'}`}
                    >
                        <div className="relative">
                            <span className="material-icons-round text-xl sm:text-2xl">edit_note</span>
                            {activeFilter === 'agendado' && !searchQuery && <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 bg-[#EAB308] rounded-full animate-pulse"></div>}
                        </div>
                        <span className="text-[8px] sm:text-[9px] font-black uppercase tracking-widest text-center">Agendado</span>
                    </button>

                    {/* COMPLETO - Visível para todos */}
                    <button
                        onClick={() => {
                            setActiveFilter("completo");
                            setSearchQuery("");
                        }}
                        data-user-access="true"
                        data-tab-id="completo"
                        className={`flex flex-col items-center gap-1 group flex-1 cursor-pointer transition-all ${activeFilter === 'completo' && !searchQuery ? 'text-[#EAB308]' : 'text-zinc-500'}`}
                    >
                        <div className="relative">
                            <span className="material-icons-round text-xl sm:text-2xl">fact_check</span>
                            {activeFilter === 'completo' && !searchQuery && <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 bg-[#EAB308] rounded-full animate-pulse"></div>}
                        </div>
                        <span className="text-[8px] sm:text-[9px] font-black uppercase tracking-widest text-center">Completo</span>
                    </button>

                    {/* ALTERADO - Visível para todos */}
                    <button
                        onClick={() => {
                            setActiveFilter("alterado");
                            setSearchQuery("");
                        }}
                        className={`flex flex-col items-center gap-1 group flex-1 cursor-pointer transition-all ${activeFilter === 'alterado' && !searchQuery ? 'text-[#EAB308]' : 'text-zinc-500'}`}
                    >
                        <div className="relative">
                            <span className="material-icons-round text-xl sm:text-2xl">published_with_changes</span>
                            {activeFilter === 'alterado' && !searchQuery && <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 bg-[#EAB308] rounded-full animate-pulse"></div>}
                        </div>
                        <span className="text-[8px] sm:text-[9px] font-black uppercase tracking-widest text-center">Alterado</span>
                    </button>

                    {/* CANCELADO - Apenas Admin */}
                    {isAdminUser && (
                        <button
                            onClick={() => {
                                setActiveFilter("cancelado");
                                setSearchQuery("");
                            }}
                            className={`flex flex-col items-center gap-1 group flex-1 cursor-pointer transition-all ${activeFilter === 'cancelado' && !searchQuery ? 'text-red-500' : 'text-zinc-500'}`}
                        >
                            <div className="relative">
                                <span className="material-icons-round text-xl sm:text-2xl">cancel</span>
                                {activeFilter === 'cancelado' && !searchQuery && <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 bg-red-500 rounded-full animate-pulse"></div>}
                            </div>
                            <span className="text-[8px] sm:text-[9px] font-black uppercase tracking-widest text-center">Cancelado</span>
                        </button>
                    )}
                </nav>
            )}
            {/* Wallet Connection Modal */}
            <ConnectWalletModal
                isOpen={isConnectModalOpen}
                onClose={() => setIsConnectModalOpen(false)}
            />
        </div>
    );
}
