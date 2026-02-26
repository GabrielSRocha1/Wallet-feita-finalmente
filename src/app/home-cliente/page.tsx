"use client";

import React, { useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useWallet } from "@/contexts/WalletContext";
import { useTokenMonitor } from "@/hooks/useTokenMonitor";
import { useNetwork } from "@/contexts/NetworkContext";
import ConnectWalletModal from "@/components/ConnectWalletModal";
import NetworkSelector from "@/components/NetworkSelector";
import { parseVestingDate, calculateVestingProgress } from "@/utils/date-utils";
import { scanBlockchainContracts } from "@/utils/blockchain-scanner";

export default function HomeClientePage() {
    const router = useRouter();
    const { network: currentNetwork } = useNetwork();
    const { connected, publicKey, isAdmin: isAdminUser, disconnectWallet } = useWallet();
    const { tokens: walletTokens, loading: loadingTokens } = useTokenMonitor(publicKey);
    const [isWalletDropdownOpen, setIsWalletDropdownOpen] = useState(false);
    const [isConnectModalOpen, setIsConnectModalOpen] = useState(false);
    const [contracts, setContracts] = useState<any[]>([]);
    const [activeFilter, setActiveFilter] = useState("em-andamento");
    const [searchQuery, setSearchQuery] = useState("");
    const [tick, setTick] = useState(0);
    const [isSyncingBlockchain, setIsSyncingBlockchain] = useState(false);

    // Ticker para atualizações em tempo real
    useEffect(() => {
        const timer = setInterval(() => setTick(t => t + 1), 1000);
        return () => clearInterval(timer);
    }, []);

    useEffect(() => {
        const fetchContracts = async () => {
            if (publicKey) {
                try {
                    // 1. Busca do Backend (Supabase)
                    const res = await fetch(`/api/contracts?wallet=${publicKey}`);
                    const data = await res.json();

                    let baseContracts: any[] = [];
                    if (data.success && Array.isArray(data.contracts)) {
                        baseContracts = data.contracts;
                    }

                    // 2. Busca do Blockchain (Sync Direto)
                    setIsSyncingBlockchain(true);
                    const onChainContracts = await scanBlockchainContracts(publicKey, currentNetwork, isAdminUser);
                    setIsSyncingBlockchain(false);

                    // 3. Busca do LocalStorage
                    const local = localStorage.getItem('created_contracts');
                    let localParsed: any[] = [];
                    if (local) {
                        try {
                            localParsed = JSON.parse(local);
                        } catch (e) { }
                    }

                    // 4. Merge Inteligente (Deduplicação por ID)
                    // Prioridade: Blockchain > Backend > Local
                    const mergedMap = new Map();

                    // Adiciona locais primeiro (menor prioridade)
                    localParsed.forEach(c => mergedMap.set(c.id, c));

                    // Sobrescreve com backend
                    baseContracts.forEach(c => mergedMap.set(c.id, c));

                    // Sobrescreve com blockchain (Verdade absoluta)
                    onChainContracts.forEach(c => {
                        const existing = mergedMap.get(c.id);
                        if (existing) {
                            // Preserva metadados que só o backend/local tem (como ícones personalizados ou títulos editados)
                            mergedMap.set(c.id, { ...existing, ...c, reclaimed: true });
                        } else {
                            mergedMap.set(c.id, c);
                        }
                    });

                    const merged = Array.from(mergedMap.values());

                    // 5. Sincroniza pro backend contratos que estão no blockchain/local mas não no backend
                    const missingInBackend = merged.filter(c => !baseContracts.find((mc: any) => mc.id === c.id));
                    if (isAdminUser && missingInBackend.length > 0) {
                        fetch('/api/contracts', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ newContracts: missingInBackend })
                        }).catch(() => { });
                    }

                    setContracts(merged);
                    localStorage.setItem('created_contracts', JSON.stringify(merged));
                    return;
                } catch (e) {
                    console.error("Error loading contracts from API/Blockchain:", e);
                }
            }

            // Fallback para o local (caso API/Blockchain falhe)
            const saved = localStorage.getItem("created_contracts");
            if (saved) {
                try {
                    const parsed = JSON.parse(saved);
                    if (Array.isArray(parsed)) {
                        setContracts(parsed);
                    }
                } catch (e) {
                    console.error("Error loading contracts from fallback:", e);
                }
            }
        };

        fetchContracts();
    }, [publicKey, isAdminUser, currentNetwork]);

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

                    // Pula se já estiver cancelado
                    if (c.status === "cancelado" || c.revoked) {
                        return c;
                    }

                    // 1. Cálculo de progresso atual
                    const startDate = parseVestingDate(c.vestingStartDate);
                    if (startDate && c.vestingDuration) {
                        const start = startDate.getTime();
                        const now = Date.now();
                        // Progress Calculation (0 to 1) using unified logic
                        const progress = calculateVestingProgress(c, now);

                        // ----------------------------------------------------
                        // LÓGICA RÍGIDA DE STATUS
                        // ----------------------------------------------------
                        let newStatus = c.status;

                        // Se foi cancelado ou alterado manualmente, preservamos o status para a UI
                        if (c.status === "cancelado" || c.status === "alterado") {
                            newStatus = c.status;
                        } else if (progress >= 1) {
                            // Periodo de vesting finalizado
                            newStatus = "completo";
                        } else if (progress > 0) {
                            // Já iniciou (start_time passado) mas não acabou
                            newStatus = "em-andamento";
                        } else {
                            // Ainda não iniciou (start_time futuro)
                            newStatus = "agendado";
                        }

                        // Atualiza status se mudou (e não era cancelado/alterado)
                        if (newStatus !== c.status) {
                            c.status = newStatus;
                            hasChanges = true;
                        }

                        // Automação: Auto-reivindicação
                        if (c.autoClaim) {
                            const total = c.totalAmount || 0;
                            const unlocked = total * progress;
                            // Update claimed amount silently (simulation)
                            if (c.claimedAmount !== unlocked) {
                                c.claimedAmount = unlocked;
                                hasChanges = true;
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
        try {
            await disconnectWallet();
            // Clear any lingering cookies or local storage just in case
            document.cookie = "wallet_address=; Max-Age=0; path=/";
            localStorage.removeItem('verum_wallet_session');
            setIsWalletDropdownOpen(false);
            window.location.href = "/";
        } catch (e) {
            console.error("Erro ao desconectar:", e);
            window.location.reload();
        }
    };

    const handleCopyAddress = () => {
        if (publicKey) {
            navigator.clipboard.writeText(publicKey);
            setIsWalletDropdownOpen(false);
        }
    };

    const handleClearTests = () => {
        if (confirm("Deseja realmente limpar todos os contratos de teste? Esta ação não afetará o blockchain, apenas o histórico local.")) {
            localStorage.removeItem("created_contracts");
            localStorage.removeItem("selected_contract");
            setContracts([]);
            alert("Dados de teste removidos!");
            window.location.reload();
        }
    };

    const handleViewDetails = (contract: any) => {
        localStorage.setItem("selected_contract", JSON.stringify(contract));
        router.push("/contrato-detalhes");
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

        // Filtra contratos onde o usuário é o destinatário e pertence à rede atual
        const recipientContracts = contracts.filter((c: any) => {
            const isRecipient = c.recipients?.some((r: any) => r.walletAddress === publicKey);
            const contractNetwork = c.network || 'devnet';
            return isRecipient && contractNetwork === currentNetwork;
        });

        console.log(`[UnifiedTokens] Encontrados ${recipientContracts.length} contratos de recebimento para depuração.`);

        // Adiciona/Mescla saldos de vesting
        recipientContracts.forEach((contract: any) => {
            const sym = (contract.selectedToken?.symbol || contract.tokenSymbol || "TKN").toUpperCase();
            const mint = contract.selectedToken?.mint || contract.mintAddress;

            const recipientData = contract.recipients?.find((r: any) => r.walletAddress === publicKey);
            if (!recipientData) return;

            const total = parseFloat(recipientData.amount) || 0;

            // --- Engine de Cáculo Dinâmico (Real-time Simulation) ---
            const calculateSimulatedUnlocked = () => {
                const startDate = parseVestingDate(contract.vestingStartDate);
                if (!startDate || !contract.vestingDuration) return 0;
                try {
                    const start = startDate.getTime();
                    const now = Date.now();
                    const progress = calculateVestingProgress(contract, now);
                    return total * progress;
                } catch (e) { return 0; }
            };

            const unlocked = calculateSimulatedUnlocked();
            const claimed = contract.claimedAmount || 0;
            const claimable = Math.max(0, unlocked - claimed);
            const locked = Math.max(0, total - unlocked);

            // Busca por MINT, SYMBOL ou NOME (Permissivo para casos onde o usuário confunde nome com ticker)
            const existingIdx = baseTokens.findIndex(t =>
                (mint && t.mint === mint) ||
                (t.symbol?.toUpperCase() === sym) ||
                (t.name?.toUpperCase() === sym)
            );

            if (existingIdx > -1) {
                baseTokens[existingIdx].claimableAmount += claimable;
                baseTokens[existingIdx].lockedAmount += locked;
                baseTokens[existingIdx].hasVesting = true;
                // Se o token da carteira não tinha nome/imagem, mas o contrato tem, aproveita
                if (!baseTokens[existingIdx].name && contract.selectedToken?.name) {
                    baseTokens[existingIdx].name = contract.selectedToken.name;
                }
            } else {
                // Token em vesting não está na carteira (pode ser 0 de saldo líquido)
                baseTokens.push({
                    mint: mint || `vesting-${sym}`,
                    amount: 0,
                    decimals: contract.selectedToken?.decimals || 9, // Tenta usar do contrato, senão default 9
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
    }, [walletTokens, contracts, connected, publicKey, currentNetwork, tick]);

    // Filter Logic - Normalized for active category selection
    const relevantContracts = React.useMemo(() => {
        if (!publicKey) return [];

        console.log(`[RelevantContracts] Buscando contratos para ${publicKey}. Total no Storage: ${contracts.length}`);

        // Filtra pela rede selecionada
        const networkFiltered = contracts.filter((c: any) => {
            const contractNetwork = c.network || 'devnet';
            return contractNetwork === currentNetwork;
        });

        if (isAdminUser) {
            console.log(`[RelevantContracts] Admin detectado. Mostrando ${networkFiltered.length} contratos da rede ${currentNetwork}.`);
            return networkFiltered;
        }

        const filtered = networkFiltered.filter((c: any) => {
            const userKey = publicKey;

            // Check if user is recipient
            const isRecipient = c.recipients?.some((r: any) => {
                const rAddr = r.walletAddress || "";
                const match = rAddr === userKey;
                if (match) console.log(`[Filter] Match found for recipient ${rAddr} in contract ${c.id}`);
                return match;
            });

            // Check if user is sender
            const sAddr = c.senderAddress || "";
            const isSender = sAddr === userKey;

            if (isSender) console.log(`[Filter] Match found for sender ${sAddr} in contract ${c.id}`);

            return isRecipient || isSender;
        });

        console.log(`[Filter] Filtered ${filtered.length} contracts for user ${publicKey} on ${currentNetwork}`);
        return filtered;
    }, [contracts, publicKey, isAdminUser, currentNetwork]);

    const filteredByStatus = relevantContracts.filter((contract: any) => {
        const query = searchQuery.toLowerCase().trim();

        // Global Search overrides tabs
        if (query) {
            const matchesTitle = contract.recipients?.[0]?.contractTitle?.toLowerCase().includes(query);
            const matchesWallet = contract.recipients?.some((r: any) =>
                r.walletAddress?.toLowerCase().includes(query)
            );
            // Search matches against ID too
            const matchesId = contract.id?.toLowerCase().includes(query);
            return matchesTitle || matchesWallet || matchesId;
        }

        // Status Filter (Tabs) - STRICT LOGIC
        if (activeFilter === "all") return true;

        // Common Status Normalization
        const rawStatus = (contract.status || "").toLowerCase();

        // 1. Cancelado (Strict String)
        if (activeFilter === "cancelado") {
            return rawStatus === "cancelado" || contract.revoked === true || contract.status === "cancelado";
        }

        // If cancelled, do not show in other tabs (unless explicitly desired, but standard is hide)
        if (rawStatus === "cancelado" || contract.revoked === true || contract.status === "cancelado") return false;

        // 2. Completo (Strict String)
        if (activeFilter === "completo") {
            return rawStatus === "completo";
        }

        // If complete, do not show in pending tabs
        if (rawStatus === "completo") return false;

        // 2.5 Alterado (Strict String)
        if (activeFilter === "alterado") {
            return rawStatus === "alterado";
        }

        // If altered, do not show in pending tabs
        if (rawStatus === "alterado") return false;

        // Calculate unified progress
        const progress = calculateVestingProgress(contract, Date.now());

        // 3. Em Andamento (Strict: Progress > 0% AND < 100%)
        if (activeFilter === "em-andamento") {
            // Also include 'bloqueado' legacy status or empty, provided progress > 0
            if (rawStatus === 'bloqueado' && progress > 0) return true;

            // Explicit check: Must be started (progress > 0)
            return progress > 0 && progress < 1;
        }

        // 4. Agendado (Strict: Progress == 0%)
        if (activeFilter === "agendado") {
            return progress === 0;
        }

        // Fallback
        return rawStatus === activeFilter.replace(/-/g, ' ');
    });

    // Click outside handler for wallet dropdown
    const dropdownRef = React.useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsWalletDropdownOpen(false);
            }
        };

        if (isWalletDropdownOpen) {
            document.addEventListener("mousedown", handleClickOutside);
        } else {
            document.removeEventListener("mousedown", handleClickOutside);
        }

        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, [isWalletDropdownOpen]);

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
                <div className="px-4 py-4 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 shrink-0">
                        <span className="text-[#EAB308] font-bold text-base sm:text-lg tracking-wide gold-text-gradient whitespace-nowrap">Verum Vesting</span>
                    </div>

                    <div className="flex items-center gap-2 sm:gap-3 flex-nowrap shrink-0">
                        {connected && isAdminUser && currentNetwork !== 'mainnet' && (
                            <button
                                onClick={handleClearTests}
                                className="bg-red-500/10 hover:bg-red-500/20 text-red-500 text-[10px] font-bold py-2 px-3 rounded-lg transition-all border border-red-500/20 flex items-center gap-1 cursor-pointer"
                                title="Limpar dados locais de teste"
                            >
                                <span className="material-icons-round text-sm">delete_sweep</span>
                                Limpar Dados
                            </button>
                        )}
                        {connected && <NetworkSelector />}

                        {!connected ? (
                            <button
                                onClick={() => setIsConnectModalOpen(true)}
                                className="bg-[#EAB308] hover:bg-[#CA8A04] text-black text-xs font-bold py-2.5 px-5 rounded-xl transition-all active:scale-95 shadow-lg cursor-pointer"
                            >
                                Conectar carteira
                            </button>
                        ) : (
                            <div className="relative" ref={dropdownRef}>
                                <button
                                    onClick={() => setIsWalletDropdownOpen(!isWalletDropdownOpen)}
                                    className="w-32 sm:w-48 bg-zinc-900 border border-white/10 px-3 sm:px-4 py-2 rounded-xl flex items-center justify-between gap-1 sm:gap-2 hover:bg-zinc-800 transition-colors cursor-pointer"
                                >
                                    <span className="text-xs font-mono text-zinc-400 font-medium whitespace-nowrap">
                                        {formatAddress(publicKey || "")}
                                    </span>
                                    <span className="material-icons-round text-sm text-zinc-500">expand_more</span>
                                </button>

                                {isWalletDropdownOpen && (
                                    <div className="absolute right-0 mt-2 w-48 bg-zinc-900 border border-white/10 rounded-xl shadow-2xl overflow-hidden z-[120] animate-in fade-in zoom-in-95 duration-200">
                                        <button
                                            onClick={handleCopyAddress}
                                            className="w-full px-4 py-3 text-left text-sm hover:bg-white/5 transition-colors flex items-center gap-2 cursor-pointer text-zinc-300"
                                        >
                                            <span className="material-icons-round text-sm">content_copy</span>
                                            Copiar Endereço
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
                </div>
            </header>

            <main className="max-w-screen-md mx-auto px-4 space-y-8 relative z-10 pt-24 text-center sm:text-left pb-32">
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
                        <h2 className="text-zinc-500 text-[10px] font-bold uppercase tracking-widest mb-1">Saldo Total da Carteira</h2>
                        <div className="flex items-baseline gap-2">
                            <p className="text-white text-4xl font-bold tracking-tight">
                                ${unifiedTokens.length > 0 ?
                                    (unifiedTokens.reduce((sum: number, token: any) => sum + (token.totalValueUsd || 0), 0)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                                    : '0.00'
                                }
                            </p>
                            {loadingTokens && <span className="text-[10px] text-[#EAB308] animate-pulse font-bold uppercase ml-2">Sincronizando...</span>}
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
                                                    {token.lockedAmount.toLocaleString(undefined, { maximumFractionDigits: 2 })} LIQ.
                                                    <span className="mx-1">•</span>
                                                    {token.claimableAmount.toLocaleString(undefined, { maximumFractionDigits: 2 })} CLAIM.
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
                    {connected && isSyncingBlockchain && (
                        <div className="flex items-center gap-2 mb-4 px-4 py-2 bg-blue-500/10 border border-blue-500/20 rounded-lg animate-pulse w-fit mx-auto sm:mx-0">
                            <span className="material-icons-round text-blue-400 text-sm">sync</span>
                            <span className="text-blue-400 text-[10px] font-bold uppercase tracking-wider">Sincronizando Blockchain...</span>
                        </div>
                    )}
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
                                                const startDate = parseVestingDate(contract.vestingStartDate);
                                                if (!startDate) return <span className="text-[10px] text-zinc-600 font-bold">--%</span>;

                                                const progress = calculateVestingProgress(contract, Date.now());
                                                const percentage = Math.round(progress * 100);
                                                return <span className="text-[10px] text-[#EAB308] font-black">{percentage}%</span>;
                                            })()}
                                        </div>
                                        <div className="flex flex-col text-zinc-500 leading-tight">
                                            <span className="text-[9px] text-zinc-400 font-bold uppercase tracking-tighter">Desbloqueado/Total</span>
                                            <span className="flex items-center gap-1 font-bold text-zinc-200">
                                                <span className="text-[#EAB308] text-[10px]">🔒</span>
                                                {(() => {
                                                    const total = contract.totalAmount || 0;
                                                    const startDate = parseVestingDate(contract.vestingStartDate);
                                                    if (!startDate) return "0.00";

                                                    const progress = calculateVestingProgress(contract, Date.now());
                                                    const unlocked = total * progress;
                                                    return unlocked.toLocaleString(undefined, { maximumFractionDigits: 2 });
                                                })()} {contract.selectedToken?.symbol}
                                            </span>
                                            <span className="text-[9px] font-mono opacity-60">of {(contract.totalAmount || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })} {contract.selectedToken?.symbol}</span>
                                        </div>
                                    </div>
                                    <div className="h-10 w-px bg-white/5 hidden sm:block mx-3"></div>
                                    <div className="flex flex-col text-zinc-400 leading-tight min-w-[90px]">
                                        <span className="text-[9px] text-zinc-500 font-bold uppercase tracking-tighter mb-0.5">Data Início</span>
                                        <span className="text-zinc-300 font-medium">
                                            {(() => {
                                                const d = parseVestingDate(contract.vestingStartDate);
                                                return d ? d.toLocaleDateString('pt-BR') : "MM/DD/YYYY";
                                            })()}
                                        </span>
                                        <span className="text-[10px] opacity-60">
                                            {(() => {
                                                const d = parseVestingDate(contract.vestingStartDate);
                                                return d ? d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : "00:00";
                                            })()}
                                        </span>
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
                                            const isSender = contract.senderAddress === publicKey;
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
                                        <span
                                            onClick={() => handleViewDetails(contract)}
                                            className="text-[#22C55E] text-[10px] font-bold hover:underline cursor-pointer uppercase tracking-tight"
                                        >
                                            Ver Detalhes
                                        </span>
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

                    {/* CANCELADO - Visível para todos para transparência */}
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
