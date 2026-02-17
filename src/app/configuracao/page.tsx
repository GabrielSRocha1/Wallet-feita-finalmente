"use client";

import React, { useState } from "react";
import Link from "next/link";
import TokenDropdown from "@/components/TokenDropdown";
import TimeUnitDropdown from "@/components/TimeUnitDropdown";
import UnlockScheduleDropdown from "@/components/UnlockScheduleDropdown";
import DateTimePickerModal from "@/components/DateTimePickerModal";
import RecipientSelectionDropdown from "@/components/RecipientSelectionDropdown";
import Image from "next/image";
import ExitWarningModal from "@/components/ExitWarningModal";
import { useRouter } from "next/navigation";
import { useWallet } from "@/contexts/WalletContext";
import { useTokenMonitor } from "@/hooks/useTokenMonitor";

export default function ConfigurationPage() {
    const router = useRouter();
    const { publicKey } = useWallet();
    const { tokens: walletTokens, loading: loadingTokens } = useTokenMonitor(publicKey);

    // Filter and map real wallet tokens for the dropdown
    const availableTokens = walletTokens
        .filter((t: any) => t.amount > 0 || t.symbol === 'SOL') // Always show SOL if balance >= 0, or just filter > 0
        .map((t: any) => ({
            name: t.name || t.symbol || "Unknown",
            symbol: t.symbol || "UNK",
            icon: t.image || "",
            balance: `${(t.amount / Math.pow(10, t.decimals)).toLocaleString(undefined, { maximumFractionDigits: 6 })} ${t.symbol}`,
            price: t.price ? `$${t.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 })}` : "N/A",
            totalValue: t.valueUsd ? `$${t.valueUsd.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : "$0.00",
            address: t.mint,
            mint: t.mint,
            decimals: t.decimals
        }));

    const [isTokenDropdownOpen, setIsTokenDropdownOpen] = useState(false);
    const [selectedToken, setSelectedToken] = useState({
        name: "Escolha um token",
        symbol: "",
        icon: "",
        mint: "",
        decimals: 0
    });

    const [isTimeUnitDropdownOpen, setIsTimeUnitDropdownOpen] = useState(false);
    const [selectedTimeUnit, setSelectedTimeUnit] = useState("Dias");

    const [isUnlockDropdownOpen, setIsUnlockDropdownOpen] = useState(false);
    const [selectedSchedule, setSelectedSchedule] = useState("Cronograma");

    const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);
    const [vestingStartDate, setVestingStartDate] = useState("dd/mm/yyyy, hh:mm");

    const [isRecipientDropdownOpen, setIsRecipientDropdownOpen] = useState(false);
    const [selectedRecipientOption, setSelectedRecipientOption] = useState("Somente o remetente");

    const [vestingDuration, setVestingDuration] = useState("");
    const [cliffAmount, setCliffAmount] = useState("");

    const [cliffType, setCliffType] = useState<"PERCENTAGEM" | "QUANTIDADE">("PERCENTAGEM");
    const [toggles, setToggles] = useState({
        cancelable: true,
        autoClaim: true,
    });

    const [isWarningModalOpen, setIsWarningModalOpen] = useState(false);

    // Load saved draft on mount
    React.useEffect(() => {
        const savedDraft = localStorage.getItem("contract_draft");
        if (savedDraft) {
            try {
                const data = JSON.parse(savedDraft);
                setSelectedToken(data.selectedToken);
                setSelectedTimeUnit(data.selectedTimeUnit);
                setSelectedSchedule(data.selectedSchedule);
                setVestingStartDate(data.vestingStartDate);
                setSelectedRecipientOption(data.selectedRecipientOption);
                setVestingDuration(data.vestingDuration);
                setCliffAmount(data.cliffAmount);
                setCliffType(data.cliffType);
                setToggles(data.toggles);
            } catch (e) {
                console.error("Erro ao carregar rascunho:", e);
            }
        }
    }, []);

    const handleToggle = (key: keyof typeof toggles) => {
        setToggles(prev => ({ ...prev, [key]: !prev[key] }));
    };

    const handleGoHome = () => {
        setIsWarningModalOpen(true);
    };

    const confirmGoHome = () => {
        localStorage.removeItem("contract_draft");
        router.push("/home-cliente");
    };

    const handleContinue = () => {
        const configData = {
            senderAddress: publicKey,
            selectedToken,
            selectedTimeUnit,
            selectedSchedule,
            vestingStartDate,
            selectedRecipientOption,
            vestingDuration,
            cliffAmount,
            cliffType,
            toggles
        };
        localStorage.setItem("contract_draft", JSON.stringify(configData));
        router.push("/destinatarios");
    };

    return (
        <div className="bg-black text-white min-h-screen pb-32 font-sans">
            {/* Header */}
            <header className="sticky top-0 z-50 bg-black/80 backdrop-blur-md px-4 py-4 flex items-center justify-between border-b border-white/5">
                <div className="flex items-center gap-2">
                    <button onClick={handleGoHome} className="hover:opacity-80 transition-opacity">
                        <span className="material-icons-round text-xl text-white">home</span>
                    </button>
                    <span className="material-icons-round text-sm text-gray-500">chevron_right</span>
                    <span className="text-sm font-medium">Configuração</span>
                </div>
                <button
                    onClick={handleGoHome}
                    className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20 transition-colors"
                >
                    <span className="material-icons-round text-xl text-white">close</span>
                </button>
            </header>

            <main className="px-4 pt-6 space-y-8">
                <h1 className="text-2xl font-bold">Configuração Token Linear</h1>

                {/* Token Section */}
                <section className="space-y-3 relative">
                    <label className="block text-sm font-medium">Token <span className="text-red-500">*</span></label>
                    <div className="relative">
                        <div
                            onClick={() => setIsTokenDropdownOpen(!isTokenDropdownOpen)}
                            className="bg-[#2C2C2E] p-4 rounded-xl flex items-center justify-between cursor-pointer border border-white/10"
                        >
                            <div className="flex items-center gap-2">
                                {selectedToken.icon ? (
                                    <div className="w-6 h-6 rounded-full bg-[#D4AF37] flex items-center justify-center overflow-hidden">
                                        <img src={selectedToken.icon} alt={selectedToken.symbol} className="w-full h-full object-cover" />
                                    </div>
                                ) : (
                                    <div className="w-6 h-6 rounded-full bg-white/10 flex items-center justify-center border border-white/5">
                                        <span className="material-icons-round text-sm text-gray-500">token</span>
                                    </div>
                                )}
                                <span className={selectedToken.symbol ? "text-white" : "text-gray-400"}>
                                    {selectedToken.name}
                                </span>
                            </div>
                            <span className="material-icons-round text-gray-400">expand_more</span>
                        </div>

                        <TokenDropdown
                            isOpen={isTokenDropdownOpen}
                            onClose={() => setIsTokenDropdownOpen(false)}
                            onSelect={(token: any) => setSelectedToken(token)}
                            customTokens={publicKey ? availableTokens : undefined}
                            loading={loadingTokens}
                        />
                    </div>
                </section>

                {/* Vesting Duration Section */}
                <section className="space-y-3">
                    <div className="flex items-center gap-1">
                        <label className="text-sm font-medium">Vesting Duração <span className="text-red-500">*</span></label>
                        <span className="material-icons-round text-sm text-gray-400">info</span>
                    </div>
                    <div className="relative">
                        <div className="grid grid-cols-12 gap-0 overflow-hidden rounded-xl border border-white/10 bg-[#2C2C2E]">
                            <input
                                className="col-span-9 bg-transparent border-none focus:ring-0 p-4 text-white placeholder-gray-500 outline-none"
                                type="text"
                                name="vestingDuration"
                                autoComplete="off"
                                placeholder="0"
                                value={vestingDuration}
                                onChange={(e) => setVestingDuration(e.target.value)}
                            />
                            <div
                                onClick={() => setIsTimeUnitDropdownOpen(!isTimeUnitDropdownOpen)}
                                className="col-span-3 border-l border-white/10 flex items-center justify-center gap-1 cursor-pointer hover:bg-white/5 transition-colors"
                            >
                                <span className="text-sm">{selectedTimeUnit}</span>
                                <span className="material-icons-round text-sm">expand_more</span>
                            </div>
                        </div>

                        <TimeUnitDropdown
                            isOpen={isTimeUnitDropdownOpen}
                            onClose={() => setIsTimeUnitDropdownOpen(false)}
                            selectedUnit={selectedTimeUnit}
                            onSelect={setSelectedTimeUnit}
                        />
                    </div>
                    <p className="text-xs text-gray-500">Aquisição total em <span className="text-gray-300 font-bold">
                        {(() => {
                            if (!vestingDuration) return "mm, dd, yyyy, hh:mm AM";
                            try {
                                const duration = parseInt(vestingDuration);
                                if (isNaN(duration)) return "mm, dd, yyyy, hh:mm AM";

                                let baseDate = new Date();
                                if (vestingStartDate && vestingStartDate !== "dd/mm/yyyy, hh:mm") {
                                    const [d, t] = vestingStartDate.split(', ');
                                    const [day, month, year] = d.split('/').map(Number);
                                    const [hour, minute] = t.split(':').map(Number);
                                    baseDate = new Date(year, month - 1, day, hour, minute);
                                }

                                const unit = selectedTimeUnit.toLowerCase();
                                if (unit.includes('minuto')) baseDate.setMinutes(baseDate.getMinutes() + duration);
                                else if (unit.includes('hora')) baseDate.setHours(baseDate.getHours() + duration);
                                else if (unit.includes('dia')) baseDate.setDate(baseDate.getDate() + duration);
                                else if (unit.includes('semana')) baseDate.setDate(baseDate.getDate() + (duration * 7));
                                else if (unit.includes('mês') || unit.includes('mes')) baseDate.setMonth(baseDate.getMonth() + duration);
                                else if (unit.includes('ano')) baseDate.setFullYear(baseDate.getFullYear() + duration);

                                return baseDate.toLocaleString('en-US', {
                                    month: '2-digit',
                                    day: '2-digit',
                                    year: 'numeric',
                                    hour: '2-digit',
                                    minute: '2-digit',
                                    hour12: true
                                });
                            } catch (e) {
                                return "mm, dd, yyyy, hh:mm AM";
                            }
                        })()}
                    </span> <span className="text-red-500">*</span></p>
                </section>

                {/* Unlock Schedule Section */}
                <section className="space-y-3">
                    <div className="flex items-center gap-1">
                        <label className="text-sm font-medium">Desbloquear cronograma <span className="text-red-500">*</span></label>
                        <span className="material-icons-round text-sm text-gray-400">info</span>
                    </div>
                    <div className="relative">
                        <div
                            onClick={() => setIsUnlockDropdownOpen(!isUnlockDropdownOpen)}
                            className="bg-[#2C2C2E] p-4 rounded-xl flex items-center justify-between border border-white/10 cursor-pointer"
                        >
                            <span className="text-gray-400">{selectedSchedule}</span>
                            <span className="material-icons-round text-gray-400">expand_more</span>
                        </div>

                        <UnlockScheduleDropdown
                            isOpen={isUnlockDropdownOpen}
                            onClose={() => setIsUnlockDropdownOpen(false)}
                            selectedSchedule={selectedSchedule}
                            onSelect={setSelectedSchedule}
                        />
                    </div>
                </section>

                {/* Start Date Section */}
                <section className="space-y-3">
                    <h3 className="text-sm font-semibold">Data de início do período Vesting</h3>
                    <div className="bg-[#1C1C1E] rounded-2xl p-4 border border-white/5 space-y-4">
                        <div className="space-y-2">
                            <label className="text-sm font-medium">O período de desbloqueio começa</label>
                            <div
                                onClick={() => setIsDatePickerOpen(true)}
                                className="bg-[#2C2C2E] p-3 rounded-xl border border-white/10 flex items-center justify-between cursor-pointer hover:bg-white/5 transition-colors"
                            >
                                <span className="text-gray-400 text-sm">{vestingStartDate}</span>
                                <span className="material-icons-round text-gray-400">calendar_today</span>
                            </div>
                        </div>

                        <DateTimePickerModal
                            isOpen={isDatePickerOpen}
                            onClose={() => setIsDatePickerOpen(false)}
                            onSave={setVestingStartDate}
                        />
                    </div>
                </section>

                {/* Cliff Configuration */}
                <section className="space-y-3">
                    <h3 className="text-sm font-semibold">Cliff configurações</h3>
                    <div className="bg-[#1C1C1E] rounded-2xl p-5 border border-white/5 space-y-4">
                        <p className="text-sm font-medium">Adicionar valor cliff</p>
                        <div className="space-y-2">
                            <p className="text-xs text-gray-400">Tipo</p>
                            <div className="bg-[#2C2C2E] p-1 rounded-xl grid grid-cols-2 text-center text-xs">
                                <div
                                    onClick={() => setCliffType("PERCENTAGEM")}
                                    className={`py-2 rounded-lg font-medium cursor-pointer transition-colors ${cliffType === "PERCENTAGEM" ? "bg-[#3A3A3C] text-white" : "text-gray-400 hover:text-white"}`}
                                >
                                    Percentagem
                                </div>
                                <div
                                    onClick={() => setCliffType("QUANTIDADE")}
                                    className={`py-2 rounded-lg font-medium cursor-pointer transition-colors ${cliffType === "QUANTIDADE" ? "bg-[#3A3A3C] text-white" : "text-gray-400 hover:text-white"}`}
                                >
                                    Quantidade
                                </div>
                            </div>
                        </div>

                        {cliffType === "QUANTIDADE" && (
                            <div className="bg-[#2C2C2E] p-4 rounded-xl border border-white/10 flex justify-between animate-in fade-in">
                                <input
                                    className="bg-transparent border-none p-0 focus:ring-0 w-full text-white outline-none"
                                    placeholder="0"
                                    name="cliffAmount"
                                    autoComplete="off"
                                    value={cliffAmount}
                                    onChange={(e) => setCliffAmount(e.target.value)}
                                />
                                <span className="text-gray-500">{selectedToken.symbol || "TOKEN"}</span>
                            </div>
                        )}

                        {cliffType === "PERCENTAGEM" && (
                            <div className="bg-[#2C2C2E] p-4 rounded-xl border border-white/10 flex justify-between animate-in fade-in">
                                <input
                                    className="bg-transparent border-none p-0 focus:ring-0 w-full text-white outline-none"
                                    placeholder="0"
                                    name="cliffAmount"
                                    autoComplete="off"
                                    value={cliffAmount}
                                    onChange={(e) => setCliffAmount(e.target.value)}
                                />
                                <span className="text-gray-500">%</span>
                            </div>
                        )}
                    </div>
                </section>

                {/* Recipient Role Section */}
                <section className="space-y-3">
                    <div className="flex items-center gap-1">
                        <label className="text-sm font-medium">Quem pode alterar o destinatário?</label>
                        <span className="material-icons-round text-sm text-gray-400">info</span>
                    </div>
                    <div className="relative">
                        <div
                            onClick={() => setIsRecipientDropdownOpen(!isRecipientDropdownOpen)}
                            className="bg-[#2C2C2E] p-4 rounded-xl flex items-center justify-between border border-white/10 cursor-pointer"
                        >
                            <span className="text-sm">{selectedRecipientOption}</span>
                            <span className="material-icons-round text-gray-400">expand_more</span>
                        </div>

                        <RecipientSelectionDropdown
                            isOpen={isRecipientDropdownOpen}
                            onClose={() => setIsRecipientDropdownOpen(false)}
                            selectedOption={selectedRecipientOption}
                            onSelect={setSelectedRecipientOption}
                        />
                    </div>
                </section>

                {/* Preferences Section */}
                <section className="space-y-3">
                    <h3 className="text-sm font-semibold">Preferências</h3>
                    <div className="bg-[#1C1C1E] rounded-2xl p-4 border border-white/5 space-y-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm font-semibold">Cancelável</p>
                                <p className="text-[10px] text-gray-500">Torne este contrato cancelável pelo seu criador.</p>
                            </div>
                            <label className="relative inline-flex items-center cursor-pointer">
                                <input
                                    type="checkbox"
                                    className="sr-only peer"
                                    checked={toggles.cancelable}
                                    onChange={() => handleToggle('cancelable')}
                                />
                                <div className="w-11 h-6 bg-gray-600 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#34c759]"></div>
                            </label>
                        </div>
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm font-semibold">Auto-reveidicação</p>
                                <p className="text-[10px] text-gray-500">Envie tokens automaticamente para as carteiras dos destinatários.</p>
                                <p className="text-[10px] text-[#D4AF37] font-bold">Taxas aplicáveis</p>
                            </div>
                            <label className="relative inline-flex items-center cursor-pointer">
                                <input
                                    type="checkbox"
                                    className="sr-only peer"
                                    checked={toggles.autoClaim}
                                    onChange={() => handleToggle('autoClaim')}
                                />
                                <div className="w-11 h-6 bg-gray-600 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#34c759]"></div>
                            </label>
                        </div>
                    </div>
                </section>
            </main>

            {/* Footer */}
            <footer className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-screen-md p-4 bg-[#000000]/95 backdrop-blur-sm border-t border-white/5 flex gap-4">
                <button
                    onClick={handleGoHome}
                    className="flex-1 bg-white/5 hover:bg-white/10 text-white border border-white/10 font-bold py-4 rounded-2xl active:scale-[0.98] transition-all text-center flex items-center justify-center cursor-pointer"
                >
                    Voltar
                </button>
                <button
                    onClick={handleContinue}
                    className="flex-1 bg-gradient-to-r from-[#EAB308] to-[#936A00] text-black font-bold py-4 rounded-2xl shadow-lg active:scale-[0.98] transition-transform text-center flex items-center justify-center cursor-pointer"
                >
                    Continuar
                </button>
            </footer>

            <ExitWarningModal
                isOpen={isWarningModalOpen}
                onClose={() => setIsWarningModalOpen(false)}
                onConfirm={confirmGoHome}
            />
        </div>
    );
}
