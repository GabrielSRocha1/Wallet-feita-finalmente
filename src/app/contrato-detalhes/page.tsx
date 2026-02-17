"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import ChangeRecipientModal from "@/components/ChangeRecipientModal";
import CancelContractModal from "@/components/CancelContractModal";
import { isAdmin, getWalletCookie } from "@/utils/rbac";
import { useWallet } from "@/contexts/WalletContext";

export default function VestingContractDetailsPage() {
    const router = useRouter();
    const { disconnectWallet } = useWallet();
    const [isWalletDropdownOpen, setIsWalletDropdownOpen] = useState(false);
    const [isChangeRecipientModalOpen, setIsChangeRecipientModalOpen] = useState(false);
    const [isCancelModalOpen, setIsCancelModalOpen] = useState(false);
    const [showToast, setShowToast] = useState(false);
    const [toastMessage, setToastMessage] = useState("");
    const [contractData, setContractData] = useState<any>(null);
    const [walletAddress, setWalletAddress] = useState("Da51j...TTzE8"); // Default/Placeholder
    const [isAdminUser, setIsAdminUser] = useState(false);
    const [loading, setLoading] = useState(true);
    const [isClaiming, setIsClaiming] = useState(false);

    useEffect(() => {
        const interval = setInterval(() => {
            if (!contractData) return;

            // Engine de Automação em Tempo Real
            const stats = getDynamicVesting();
            let hasChanges = false;
            let updates: any = {};

            // 0. Check for Scheduled -> In Progress
            if (contractData.status === "agendado") {
                try {
                    const [datePart, timePart] = contractData.vestingStartDate.split(', ');
                    const [day, month, year] = datePart.split('/').map(Number);
                    const [hour, minute] = timePart.split(':').map(Number);
                    const start = new Date(year, month - 1, day, hour, minute).getTime();

                    if (Date.now() >= start) {
                        updates.status = "em-andamento";
                        hasChanges = true;
                    }
                } catch (e) {
                    console.error("Error checking schedule start:", e);
                }
            }

            // 1. Check for Auto-Completion
            if (stats.progress >= 100 && contractData.status !== "completo" && contractData.status !== "cancelado") {
                updates.status = "completo";
                hasChanges = true;
            }

            // 2. Check for Auto-Claim
            if (contractData.autoClaim && contractData.claimedAmount !== stats.unlocked) {
                updates.claimedAmount = stats.unlocked;
                hasChanges = true;
            }

            if (hasChanges) {
                updateContract(updates);
            } else {
                // Just force a re-render for UI sync
                setContractData((prev: any) => prev ? { ...prev } : null);
            }
        }, 5000); // Check and refresh every 5s for precision

        // 1. Try to load specific selected contract
        const selectedStr = localStorage.getItem("selected_contract");
        const savedConfig = localStorage.getItem("contract_draft");
        const savedRecipients = localStorage.getItem("recipients_draft");

        // 2. Load Wallet Address
        const connectedAddress = getWalletCookie();
        if (connectedAddress) {
            setWalletAddress(connectedAddress);
            setIsAdminUser(isAdmin(connectedAddress));
        }

        if (selectedStr) {
            try {
                const contract = JSON.parse(selectedStr);
                if (contract) {
                    setContractData({
                        ...contract,
                        tokenName: contract.selectedToken?.name || "Token",
                        tokenSymbol: contract.selectedToken?.symbol || "TKN",
                        tokenIcon: contract.selectedToken?.icon,
                        status: contract.status || "Bloqueado",
                        unlockedAmount: contract.unlockedAmount || 0,
                        claimedAmount: contract.claimedAmount || 0,
                        mintAddress: contract.selectedToken?.mintAddress || "DmSnH6gmikCc4s4oWuRGXZXr8wVfrbykWfby",
                        senderAddress: contract.senderAddress || connectedAddress || "CtauGKgV4jmVyFQ1SWcGjy3s5jppZt",
                        recipientAddress: contract.recipients?.[0]?.walletAddress || "Indefinido",
                        vestingStartDate: contract.vestingStartDate
                    });
                }
            } catch (e) {
                console.error("Error parsing selected contract:", e);
            }
        } else if (savedConfig && savedRecipients) {
            try {
                const config = JSON.parse(savedConfig);
                const recipients = JSON.parse(savedRecipients);

                if (config && recipients && Array.isArray(recipients)) {
                    const totalAmount = recipients.reduce((sum: number, r: any) => sum + (parseFloat(r.amount) || 0), 0);

                    setContractData({
                        ...config,
                        recipients,
                        totalAmount,
                        tokenName: config.selectedToken?.name || "Token",
                        tokenSymbol: config.selectedToken?.symbol || "TKN",
                        tokenIcon: config.selectedToken?.icon,
                        status: "Bloqueado",
                        unlockedAmount: 0,
                        claimedAmount: 0,
                        mintAddress: config.selectedToken?.mintAddress || "DmSnH6gmikCc4s4oWuRGXZXr8wVfrbykWfby",
                        senderAddress: connectedAddress || "CtauGKgV4jmVyFQ1SWcGjy3s5jppZt",
                        recipientAddress: recipients[0]?.walletAddress || "Indefinido",
                        vestingStartDate: config.vestingStartDate
                    });
                }
            } catch (e) {
                console.error("Error parsing draft data:", e);
            }
        }
        setLoading(false);
    }, []);

    // Helper functions for display
    const formatAddress = (addr: string) => {
        if (!addr) return "...";
        if (addr.length <= 12) return addr;
        return `${addr.substring(0, 4)}...${addr.substring(addr.length - 4)}`;
    };

    const copyToClipboard = async (text: string, label: string) => {
        try {
            await navigator.clipboard.writeText(text);
            setToastMessage(`${label} copiado!`);
            setShowToast(true);
            setTimeout(() => setShowToast(false), 2000);
        } catch (err) {
            console.error('Erro ao copiar:', err);
            setToastMessage('Erro ao copiar');
            setShowToast(true);
            setTimeout(() => setShowToast(false), 2000);
        }
    };

    // --- Dynamic Engine for Details ---
    const getDynamicVesting = () => {
        if (!contractData?.vestingStartDate || !contractData?.vestingDuration) {
            return { unlocked: 0, progress: 0, locked: contractData?.totalAmount || 0 };
        }
        try {
            const [datePart, timePart] = contractData.vestingStartDate.split(', ');
            const [day, month, year] = datePart.split('/').map(Number);
            const [hour, minute] = timePart.split(':').map(Number);
            const start = new Date(year, month - 1, day, hour, minute).getTime();
            const now = Date.now();

            if (now < start) return { unlocked: 0, progress: 0, locked: contractData.totalAmount };

            const total = contractData.totalAmount || 0;
            const duration = parseInt(contractData.vestingDuration);
            const unit = (contractData.selectedTimeUnit || "").toLowerCase();
            let durationMs = 3600000;
            if (unit.includes('minuto')) durationMs = duration * 60 * 1000;
            else if (unit.includes('hora')) durationMs = duration * 3600000;
            else if (unit.includes('dia')) durationMs = duration * 86400000;
            else if (unit.includes('semana')) durationMs = duration * 7 * 86400000;
            else if (unit.includes('mês') || unit.includes('mes')) durationMs = duration * 30.44 * 86400000;
            else durationMs = duration * 365.25 * 86400000;

            const progress = Math.min(1, (now - start) / durationMs);
            const unlocked = total * progress;
            return {
                unlocked,
                progress: Math.round(progress * 100),
                locked: Math.max(0, total - unlocked)
            };
        } catch (e) {
            return { unlocked: 0, progress: 0, locked: contractData?.totalAmount || 0 };
        }
    };

    const dynamicStats = getDynamicVesting();

    const handleBackNavigation = () => {
        if (isAdminUser) {
            router.push('/'); // Admin Home
        } else {
            router.push('/home-cliente'); // Client Home
        }
    };

    const calculateEndDate = () => {
        if (!contractData?.vestingStartDate || !contractData?.vestingDuration) {
            return "Indefinida";
        }

        try {
            const [datePart, timePart] = contractData.vestingStartDate.split(', ');
            const [day, month, year] = datePart.split('/').map(Number);
            const [hour, minute] = timePart.split(':').map(Number);

            const date = new Date(year, month - 1, day, hour, minute);
            const duration = parseInt(contractData.vestingDuration);
            const unit = contractData.selectedTimeUnit?.toLowerCase() || "";

            if (unit.includes('minuto')) date.setMinutes(date.getMinutes() + duration);
            else if (unit.includes('hora')) date.setHours(date.getHours() + duration);
            else if (unit.includes('dia')) date.setDate(date.getDate() + duration);
            else if (unit.includes('semana')) date.setDate(date.getDate() + (duration * 7));
            else if (unit.includes('mês') || unit.includes('mes')) date.setMonth(date.getMonth() + duration);
            else if (unit.includes('ano')) date.setFullYear(date.getFullYear() + duration);

            return date.toLocaleString('pt-BR', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            }).replace(',', '');
        } catch (e) {
            return "Indefinida";
        }
    };

    const updateContract = (updatedFields: any) => {
        if (!contractData) return;

        const updatedContract = { ...contractData, ...updatedFields };

        // 1. Update State
        setContractData(updatedContract);

        // 2. Update selected_contract
        localStorage.setItem("selected_contract", JSON.stringify(updatedContract));

        // 3. Update created_contracts list
        const existingStr = localStorage.getItem("created_contracts");
        if (existingStr) {
            try {
                const existing = JSON.parse(existingStr);
                if (Array.isArray(existing)) {
                    const updatedList = existing.map((c: any) =>
                        c.id === contractData.id ? { ...c, ...updatedFields } : c
                    );
                    localStorage.setItem("created_contracts", JSON.stringify(updatedList));
                }
            } catch (e) {
                console.error("Error updating contracts list:", e);
            }
        }
    };

    const handleCancel = () => {
        setIsCancelModalOpen(true);
    };

    const confirmCancel = () => {
        updateContract({ status: "cancelado" });
        setIsCancelModalOpen(false);
        setToastMessage("Contrato cancelado com sucesso!");
        setShowToast(true);
        setTimeout(() => setShowToast(false), 2000);
    };

    const handleRecipientChange = (newAddress: string) => {
        const updatedRecipients = [...(contractData.recipients || [])];
        if (updatedRecipients[0]) {
            updatedRecipients[0] = { ...updatedRecipients[0], walletAddress: newAddress };
        }

        updateContract({
            recipients: updatedRecipients,
            recipientAddress: newAddress,
            status: "alterado"
        });

        setIsChangeRecipientModalOpen(false);
        setToastMessage("Destinatário e status atualizados!");
        setShowToast(true);
        setTimeout(() => setShowToast(false), 2000);
    };

    const handleClaim = async () => {
        if (isClaiming || !contractData) return;

        const stats = getDynamicVesting();
        const availableToClaim = stats.unlocked - (contractData.claimedAmount || 0);

        if (availableToClaim <= 0) {
            setToastMessage("Nenhum saldo novo para reivindicar!");
            setShowToast(true);
            setTimeout(() => setShowToast(false), 2000);
            return;
        }

        setIsClaiming(true);

        // Simula delay de rede
        await new Promise(resolve => setTimeout(resolve, 2000));

        updateContract({
            claimedAmount: stats.unlocked
        });

        setIsClaiming(false);
        setToastMessage(`${availableToClaim.toFixed(4)} ${contractData.tokenSymbol} reivindicados!`);
        setShowToast(true);
        setTimeout(() => setShowToast(false), 2000);
    };

    if (loading) {
        return <div className="min-h-screen bg-black text-white flex items-center justify-center animate-pulse">Carregando detalhes...</div>;
    }

    if (!contractData) {
        return (
            <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center gap-6 p-4">
                <div className="w-20 h-20 bg-zinc-900 rounded-full flex items-center justify-center border border-zinc-800">
                    <span className="material-symbols-outlined text-zinc-500 text-4xl">search_off</span>
                </div>
                <div className="text-center space-y-2">
                    <h2 className="text-xl font-bold">Nenhum contrato encontrado</h2>
                    <p className="text-zinc-400 text-sm max-w-xs mx-auto">
                        Não encontramos um contrato recém-criado neste navegador.
                    </p>
                </div>
                <button
                    onClick={() => router.push('/configuracao')}
                    className="bg-[#EAB308] text-black px-6 py-3 rounded-xl font-bold hover:opacity-90 transition-all active:scale-95 shadow-lg flex items-center gap-2 cursor-pointer"
                >
                    <span className="material-symbols-outlined text-xl">add_circle</span>
                    Criar Novo Contrato
                </button>
            </div>
        );
    }

    return (
        <div className="bg-black text-white min-h-screen pb-10">
            {/* Header */}
            <header className="sticky top-0 z-50 bg-black/80 backdrop-blur-md border-b border-zinc-800 px-4 py-3">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <div
                            onClick={handleBackNavigation}
                            className="w-8 h-8 flex items-center justify-center cursor-pointer"
                        >
                            <svg className="w-6 h-6 fill-[#EAB308]" viewBox="0 0 100 100">
                                <path d="M20 10 L50 90 L80 10 L65 10 L50 55 L35 10 Z"></path>
                            </svg>
                        </div>
                        <div className="flex items-center text-sm font-medium gap-1">
                            <span
                                onClick={handleBackNavigation}
                                className="text-zinc-400 cursor-pointer hover:text-zinc-300 transition-colors"
                            >
                                Token bloqueado
                            </span>
                            <span className="material-symbols-outlined text-xs text-zinc-500">chevron_right</span>
                            <span>Contrato Vesting</span>
                        </div>
                    </div>
                    <div className="relative">
                        <button
                            onClick={() => setIsWalletDropdownOpen(!isWalletDropdownOpen)}
                            className="w-48 bg-zinc-900 border border-white/10 px-4 py-2 rounded-xl flex items-center justify-between gap-2 hover:bg-zinc-800 transition-colors cursor-pointer"
                        >
                            <span className="text-xs font-mono text-zinc-400 font-medium whitespace-nowrap">{formatAddress(walletAddress)}</span>
                            <span className="material-icons-round text-sm text-zinc-500">expand_more</span>
                        </button>
                        {isWalletDropdownOpen && (
                            <div className="absolute right-0 mt-2 w-48 bg-zinc-900 border border-white/10 rounded-xl shadow-2xl overflow-hidden z-50 animate-in fade-in zoom-in-95 duration-200">
                                <button
                                    onClick={() => copyToClipboard(walletAddress || "", 'Endereço da carteira')}
                                    className="w-full flex items-center gap-2 px-4 py-3 text-sm text-zinc-300 hover:bg-white/5 transition-colors cursor-pointer border-b border-white/5"
                                >
                                    <span className="material-icons-round text-sm">content_copy</span>
                                    Copiar endereço
                                </button>
                                <button
                                    onClick={async () => {
                                        try {
                                            await disconnectWallet();
                                            document.cookie = "wallet_address=; Max-Age=0; path=/";
                                            localStorage.removeItem('verum_wallet_session');
                                            setIsWalletDropdownOpen(false);
                                            window.location.href = '/home-cliente';
                                        } catch (e) {
                                            console.error("Erro ao desconectar:", e);
                                            window.location.href = '/home-cliente';
                                        }
                                    }}
                                    className="w-full flex items-center gap-2 px-4 py-3 text-sm text-red-500 hover:bg-white/5 transition-colors cursor-pointer"
                                >
                                    <span className="material-icons-round text-sm">logout</span>
                                    Desconectar
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </header>

            <main className="px-4 mt-6 mb-[60px]">
                {/* Progress Section */}
                <section className="flex items-center gap-6 py-4 border-b border-zinc-800 mb-8">
                    <div className="relative w-16 h-16">
                        <svg className="w-full h-full">
                            <circle className="text-zinc-800" cx="32" cy="32" fill="transparent" r="28" stroke="currentColor" strokeWidth="4"></circle>
                            <circle
                                className="text-[#EAB308] progress-ring__circle transition-all duration-1000 ease-out"
                                cx="32" cy="32" fill="transparent" r="28" stroke="currentColor"
                                strokeDasharray="175.9"
                                strokeDashoffset={175.9 * (1 - (dynamicStats.unlocked / contractData.totalAmount) || 1)} // Calculate offset based on percentage
                                strokeLinecap="round" strokeWidth="4"
                            ></circle>
                        </svg>
                        <div className="absolute inset-0 flex items-center justify-center text-xs font-bold">
                            {dynamicStats.progress}%
                        </div>
                    </div>
                    <div className="space-y-1">
                        <div className="text-zinc-400 text-xs font-medium uppercase tracking-wider">Desbloqueado</div>
                        <div className="flex items-center gap-1.5 font-bold">
                            <span className="material-symbols-outlined text-[#EAB308] text-xl">monetization_on</span>
                            <span>{dynamicStats.unlocked.toLocaleString(undefined, { maximumFractionDigits: 2 })} {contractData.tokenSymbol}</span>
                        </div>
                        <div className="flex items-center gap-2 text-[10px] text-zinc-500">
                            <span>{contractData.totalAmount} {contractData.tokenSymbol} <span className="text-[#EAB308]">({formatAddress(contractData.senderAddress)})</span></span>
                            <span>•</span>
                            <span className="flex items-center gap-1">
                                CHAIN
                                <Image
                                    alt="Solana Logo"
                                    className="w-3 h-3 grayscale opacity-80"
                                    src="https://lh3.googleusercontent.com/aida-public/AB6AXuCRs5ENhjri17AxnB8o4Ew31dhW5T7txs39BQmGOwyYqtK2fFKWUHD-akTsMbwEWXlzSGD9QIt3x80wssC5tUf-K2QNW3jIoZwooQy2qQoadEMhogSZLqltU1ggiji_QZezAEF7h4bSVhu9rVd1_1LaqHKzW6nlXUQcEhDUitlyqM34zWCIEjeLn5rlS8SoJ3W4C69lrwBMTiZ7LddxFsf7PXlIcg-3XY_yMaE6nMEkML_JlIvnehSREmOZvUDU000HyDUUctVe4CM"
                                    width={12}
                                    height={12}
                                />
                                <span className="font-bold tracking-tighter text-white">SOLANA</span>
                            </span>
                        </div>
                    </div>
                </section>

                {/* Contract Details */}
                <section className="space-y-6">
                    <div className="inline-block bg-[#EAB308]/20 text-[#EAB308] border border-[#EAB308]/30 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider">
                        {contractData.status?.replace('-', ' ')}
                    </div>

                    <div className="space-y-2">
                        <h1 className="text-xl font-bold">{contractData.tokenName} - Bloqueio por token</h1>
                        <div
                            onClick={() => copyToClipboard("SimulatedContractID123", 'Contrato ID')}
                            className="flex items-center gap-2 text-sm font-medium text-zinc-300 cursor-pointer hover:text-[#EAB308] transition-colors"
                        >
                            <span className="material-symbols-outlined text-sm">content_copy</span>
                            <span>7xKX...RrXFk</span>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                        <div className="space-y-1">
                            <div className="text-zinc-500 text-[10px] font-bold uppercase tracking-widest">Hora de desbloquear</div>
                            <div className="text-sm font-bold">{contractData.vestingStartDate || "Indefinida"}</div>
                        </div>
                        <div className="space-y-1">
                            <div className="text-zinc-500 text-[10px] font-bold uppercase tracking-widest">Data e hora de término</div>
                            <div className="text-sm font-bold">{calculateEndDate()}</div>
                        </div>
                        <div className="space-y-1">
                            <div className="text-zinc-500 text-[10px] font-bold uppercase tracking-widest">Direção</div>
                            {(() => {
                                const isSender = walletAddress.toLowerCase() === contractData.senderAddress?.toLowerCase();
                                const isRecipient = walletAddress.toLowerCase() === contractData.recipientAddress?.toLowerCase();

                                if (isSender) {
                                    return (
                                        <div className="flex items-center gap-1 text-sm font-bold">
                                            <span className="material-symbols-outlined text-red-500 text-base">arrow_circle_left</span>
                                            Saída
                                        </div>
                                    );
                                }

                                return (
                                    <div className="flex items-center gap-1 text-sm font-bold">
                                        <span className="material-symbols-outlined text-green-500 text-base">arrow_circle_right</span>
                                        Entrada
                                    </div>
                                );
                            })()}
                        </div>
                    </div>

                    <div className="grid grid-cols-3 gap-2 pt-4">
                        <div className="space-y-1">
                            <div className="text-zinc-500 text-[9px] font-bold uppercase tracking-widest">Bloqueado</div>
                            <div className="flex items-center gap-1 text-sm font-bold">
                                <span className="material-symbols-outlined text-[#EAB308] text-base">monetization_on</span>
                                {dynamicStats.locked.toLocaleString(undefined, { maximumFractionDigits: 2 })} {contractData.tokenSymbol} <span className="text-zinc-500 font-normal">($0)</span>
                            </div>
                        </div>
                        <div className="space-y-1">
                            <div className="text-zinc-500 text-[9px] font-bold uppercase tracking-widest">Desbloqueado</div>
                            <div className="flex items-center gap-1 text-sm font-bold">
                                <span className="material-symbols-outlined text-[#EAB308] text-base">monetization_on</span>
                                {dynamicStats.unlocked.toLocaleString(undefined, { maximumFractionDigits: 2 })} {contractData.tokenSymbol} <span className="text-zinc-500 font-normal">($0)</span>
                            </div>
                        </div>
                        <div className="space-y-1">
                            <div className="text-zinc-500 text-[9px] font-bold uppercase tracking-widest">Reivindicado</div>
                            <div className="flex items-center gap-1 text-sm font-bold">
                                <span className="material-symbols-outlined text-[#EAB308] text-base">monetization_on</span>
                                {Number(contractData.claimedAmount || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 })} {contractData.tokenSymbol} <span className="text-zinc-500 font-normal">($0)</span>
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-3 gap-2 py-4">
                        <div className="space-y-1">
                            <div className="text-zinc-500 text-[9px] font-bold leading-tight uppercase">Endereço da casa da moeda</div>
                            <div className="flex items-center gap-1 text-xs">
                                <span className="font-bold">{contractData.tokenSymbol}</span>
                                <span
                                    onClick={() => copyToClipboard(contractData.mintAddress, 'Endereço da casa da moeda')}
                                    className="material-symbols-outlined text-xs cursor-pointer hover:text-[#EAB308] transition-colors"
                                >
                                    content_copy
                                </span>
                                <span className="text-zinc-400 truncate max-w-[80px]">{formatAddress(contractData.mintAddress)}</span>
                            </div>
                        </div>
                        <div className="space-y-1">
                            <div className="text-zinc-500 text-[9px] font-bold leading-tight uppercase">Endereço do destinatário</div>
                            <div className="flex items-center gap-1 text-xs">
                                <span
                                    onClick={() => copyToClipboard(contractData.recipientAddress, 'Endereço do destinatário')}
                                    className="material-symbols-outlined text-xs cursor-pointer hover:text-[#EAB308] transition-colors"
                                >
                                    content_copy
                                </span>
                                <span className="text-zinc-400 truncate max-w-[80px]">{formatAddress(contractData.recipientAddress)}</span>
                            </div>
                        </div>
                        <div className="space-y-1">
                            <div className="text-zinc-500 text-[9px] font-bold leading-tight uppercase">Endereço do remetente</div>
                            <div className="flex items-center gap-1 text-xs">
                                <span
                                    onClick={() => copyToClipboard(contractData.senderAddress, 'Endereço do remetente')}
                                    className="material-symbols-outlined text-xs cursor-pointer hover:text-[#EAB308] transition-colors"
                                >
                                    content_copy
                                </span>
                                <span className="text-zinc-400 truncate max-w-[80px]">{formatAddress(contractData.senderAddress)}</span>
                            </div>
                        </div>
                    </div>

                    {/* Chart */}
                    {/* Stepped Chart */}
                    <div className="relative h-48 mt-8 pl-8 pb-10">
                        {/* Y-Axis Labels */}
                        <div className="absolute left-0 top-0 h-48 flex flex-col justify-between text-[8px] text-zinc-600 font-bold pr-2 border-r border-zinc-800">
                            <span>{contractData.totalAmount}</span>
                            <span>{Math.round(contractData.totalAmount * 0.75)}</span>
                            <span>{Math.round(contractData.totalAmount * 0.50)}</span>
                            <span>{Math.round(contractData.totalAmount * 0.25)}</span>
                            <span>0</span>
                        </div>

                        {/* Chart Area */}
                        <div className="relative h-48 border-b border-zinc-800 w-full flex items-end gap-[2px]">
                            {/* Horizontal Grid Lines */}
                            <div className="absolute inset-0 flex flex-col justify-between pointer-events-none opacity-5">
                                <div className="w-full border-t border-zinc-400"></div>
                                <div className="w-full border-t border-zinc-400"></div>
                                <div className="w-full border-t border-zinc-400"></div>
                                <div className="w-full border-t border-zinc-400"></div>
                            </div>

                            {/* Stepped Bars */}
                            {/* Stepped Bars */}
                            {(() => {
                                const calculateChartSteps = () => {
                                    const duration = parseInt(contractData.vestingDuration || "0");
                                    const unit = (contractData.selectedTimeUnit || "").toLowerCase();
                                    const schedule = (contractData.selectedSchedule || "meses").toLowerCase(); // Default to months if missing

                                    const getMultiplier = (u: string) => {
                                        if (u.includes('minuto')) return 60 * 1000;
                                        if (u.includes('hora')) return 3600 * 1000;
                                        if (u.includes('dia')) return 86400 * 1000;
                                        if (u.includes('semana')) return 7 * 86400 * 1000;
                                        if (u.includes('mês') || u.includes('mes')) return 30.44 * 86400 * 1000; // Augment precision
                                        if (u.includes('ano')) return 365.25 * 86400 * 1000;
                                        return 0;
                                    };

                                    const durationMs = duration * getMultiplier(unit);
                                    // Schedule implies "Every 1 X"
                                    const scheduleMs = 1 * getMultiplier(schedule);

                                    if (scheduleMs <= 0 || durationMs <= 0) return 24; // Fallback

                                    const steps = Math.ceil(durationMs / scheduleMs);
                                    // Cap at 100 bars for performance/UI safety, min 1
                                    return Math.max(1, Math.min(steps, 100));
                                };

                                const totalSteps = calculateChartSteps();

                                return Array.from({ length: totalSteps }).map((_, i) => {
                                    // Calculate progress required for this step to be unlocked
                                    // If we have N steps, step i (0-indexed) represents the interval [i/N, (i+1)/N]
                                    // A step is fully unlocked when progress >= (i + 1) / N
                                    // Or partially? Usually linear vesting means continuous.
                                    // But stepped chart implies discrete blocks.
                                    // If Schedule is "Monthly", it usually unlocks at the END of the month? Or linearly?
                                    // "Linear" vesting usually means block-by-block if schedule is set.
                                    // Let's assume proportional fill for visual effect if linear, or binary if discrete.
                                    // For a nice UI, let's make it binary based on the timeline.

                                    // Change: Color the bar if we are *inside* or *past* this step, not just fully completed.
                                    // This makes the chart look like it enters the bar as the "Unlock" line moves.
                                    const stepThreshold = (i / totalSteps) * 100;
                                    const isUnlocked = dynamicStats.progress > stepThreshold;

                                    // Visual height: Linear increase from 0 to 100%
                                    const height = ((i + 1) / totalSteps) * 100;

                                    return (
                                        <div
                                            key={i}
                                            className={`flex-1 transition-all duration-500 rounded-t-sm ${isUnlocked
                                                ? 'bg-gradient-to-t from-[#EAB308]/40 to-[#EAB308] opacity-100 shadow-[0_0_10px_rgba(234,179,8,0.2)]'
                                                : 'bg-zinc-800/40 opacity-40'
                                                }`}
                                            style={{ height: `${height}%` }}
                                            title={`Passo ${i + 1}/${totalSteps}`}
                                        ></div>
                                    );
                                });
                            })()}

                            {/* Floating UNLOCK Cursor */}
                            <div
                                className="absolute top-0 h-full pointer-events-none transition-all duration-1000 ease-in-out border-l border-dotted border-[#EAB308] z-10"
                                style={{ left: `${dynamicStats.progress}%` }}
                            >
                                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                                    <span className="text-[8px] font-black text-[#EAB308] whitespace-nowrap bg-black/80 px-1 py-0.5 rounded border border-[#EAB308]/20 flex items-center gap-1">
                                        <span className="w-1 h-1 bg-[#EAB308] rounded-full animate-pulse"></span>
                                        UNLOCK
                                    </span>
                                </div>
                            </div>
                        </div>

                        {/* X-Axis Labels (Timeline) */}
                        <div className="flex justify-between mt-2 text-[8px] font-bold text-zinc-500 uppercase tracking-tighter">
                            {(() => {
                                const startStr = contractData.vestingStartDate || "START";
                                const endStr = calculateEndDate();

                                const parseDate = (s: string) => {
                                    try {
                                        const [d, t] = s.split(', ');
                                        const [day, mo, yr] = d.split('/').map(Number);
                                        const [h, m] = t.split(':').map(Number);
                                        return new Date(yr, mo - 1, day, h, m).getTime();
                                    } catch (e) { return Date.now(); }
                                };

                                const startTs = parseDate(startStr);
                                const endTs = parseDate(endStr);
                                const diff = endTs - startTs;

                                const fmt = (ts: number) => {
                                    const d = new Date(ts);
                                    return d.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }).replace(',', '');
                                };

                                return (
                                    <>
                                        <div className="text-left w-1/4">
                                            <span className="text-white block">{startStr.split(',')[0]}</span>
                                            <span className="opacity-50">{startStr.split(',')[1]} <span className="text-[#EAB308]">START</span></span>
                                        </div>
                                        <div className="text-center w-1/4 opacity-40">
                                            <span className="block">{fmt(startTs + diff * 0.25).split(' ')[0]}</span>
                                            <span>{fmt(startTs + diff * 0.25).split(' ')[1]}</span>
                                        </div>
                                        <div className="text-center w-1/4 opacity-40">
                                            <span className="block">{fmt(startTs + diff * 0.5).split(' ')[0]}</span>
                                            <span>{fmt(startTs + diff * 0.5).split(' ')[1]}</span>
                                        </div>
                                        <div className="text-center w-1/4 opacity-40">
                                            <span className="block">{fmt(startTs + diff * 0.75).split(' ')[0]}</span>
                                            <span>{fmt(startTs + diff * 0.75).split(' ')[1]}</span>
                                        </div>
                                        <div className="text-right w-1/4">
                                            <span className="text-white block">{endStr.split(' ')[0]}</span>
                                            <span className="opacity-50">{endStr.split(' ')[1]} <span className="text-[#EAB308]">END</span></span>
                                        </div>
                                    </>
                                );
                            })()}
                        </div>
                    </div>
                </section>

                {/* Actions Section */}
                {isAdminUser && (
                    <>
                        <section className="mt-12 space-y-4">
                            <h2 className="text-[10px] font-bold text-zinc-500 uppercase tracking-[0.2em]">Ações do Contrato</h2>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <button
                                    onClick={() => setIsChangeRecipientModalOpen(true)}
                                    disabled={contractData.status === "cancelado"}
                                    className="bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-4 px-6 rounded-2xl flex items-center justify-between group transition-all active:scale-[0.98] cursor-pointer"
                                >
                                    <div className="flex items-center gap-3">
                                        <span className="material-symbols-outlined text-[#EAB308]">person_edit</span>
                                        <span className="text-sm">Alterar Destinatário</span>
                                    </div>
                                    <span className="material-symbols-outlined text-zinc-500 group-hover:text-white transition-colors">chevron_right</span>
                                </button>

                                <button
                                    onClick={handleCancel}
                                    disabled={contractData.status === "cancelado"}
                                    className="bg-red-500/10 hover:bg-red-500/20 disabled:opacity-30 disabled:cursor-not-allowed text-red-500 font-bold py-4 px-6 rounded-2xl flex items-center justify-between group transition-all active:scale-[0.98] border border-red-500/20 cursor-pointer"
                                >
                                    <div className="flex items-center gap-3">
                                        <span className="material-symbols-outlined">cancel</span>
                                        <span className="text-sm">Cancelar Contrato</span>
                                    </div>
                                    <span className="material-symbols-outlined text-red-500/50 group-hover:text-red-500 transition-colors">delete_forever</span>
                                </button>
                            </div>
                        </section>

                        <ChangeRecipientModal
                            isOpen={isChangeRecipientModalOpen}
                            onClose={() => setIsChangeRecipientModalOpen(false)}
                            onConfirm={handleRecipientChange}
                            currentAddress={contractData.recipientAddress}
                        />

                        <CancelContractModal
                            isOpen={isCancelModalOpen}
                            onClose={() => setIsCancelModalOpen(false)}
                            onConfirm={confirmCancel}
                        />
                    </>
                )}

                {/* Status Bar (Matches Image) */}
                <section className="mt-12 bg-zinc-900/50 border border-zinc-800 rounded-3xl p-6 flex flex-col sm:flex-row items-center justify-between gap-6">
                    <div className="space-y-2 text-center sm:text-left">
                        <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Status Atual</p>
                        <div className="inline-block bg-[#EAB308]/20 text-[#EAB308] border border-[#EAB308]/30 px-4 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-tighter">
                            {contractData.status.replace('-', ' ')}
                        </div>
                    </div>

                    <button
                        className={`w-full sm:w-auto font-black uppercase tracking-tighter text-xs px-8 py-4 rounded-2xl transition-all active:scale-95 border border-zinc-700/50 flex items-center justify-center gap-2
                            ${isClaiming
                                ? 'bg-zinc-800 text-zinc-500 cursor-not-allowed'
                                : 'bg-zinc-800 hover:bg-zinc-700 text-green-500 cursor-pointer'
                            }`}
                        onClick={handleClaim}
                        disabled={isClaiming}
                    >
                        {isClaiming ? (
                            <>
                                <div className="w-3 h-3 border-2 border-green-500/20 border-t-green-500 rounded-full animate-spin"></div>
                                PROCESSANDO...
                            </>
                        ) : (
                            'REIVINDICAÇÃO'
                        )}
                    </button>
                </section>

            </main>

            {/* Toast Notification */}
            {showToast && (
                <div className="fixed bottom-10 left-1/2 transform -translate-x-1/2 bg-zinc-800 text-white px-4 py-2 rounded-lg shadow-lg border border-zinc-700 z-[200] w-[90%] max-w-screen-md flex items-center gap-2 animate-in fade-in slide-in-from-bottom-2 duration-300">
                    <span className="material-symbols-outlined text-[#EAB308] text-sm">check_circle</span>
                    <span className="text-sm font-medium">{toastMessage}</span>
                </div>
            )}
        </div>
    );
}
