"use client";

import React, { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import EditRecipientModal from "@/components/EditRecipientModal";
import AddRecipientModal, { RecipientData } from "@/components/AddRecipientModal";
import ExitWarningModal from "@/components/ExitWarningModal";
import { useRouter } from "next/navigation";
import { useWallet } from "@/contexts/WalletContext";
import { useNetwork } from "@/contexts/NetworkContext";
import NetworkSelector from "@/components/NetworkSelector";
import { isAdmin } from "@/utils/rbac";

export default function RecipientsPage() {
    const router = useRouter();
    const { publicKey } = useWallet();
    const { network } = useNetwork();
    const isAdminUser = isAdmin(publicKey);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [recipients, setRecipients] = useState<RecipientData[]>([]);
    const [selectedRecipient, setSelectedRecipient] = useState<RecipientData | null>(null);
    const [isWarningModalOpen, setIsWarningModalOpen] = useState(false);
    const [tokenSymbol, setTokenSymbol] = useState("TOKEN");

    // Load recipients and config on mount
    React.useEffect(() => {
        const savedRecipients = localStorage.getItem("recipients_draft");
        const savedConfig = localStorage.getItem("contract_draft");

        if (savedRecipients) {
            try {
                setRecipients(JSON.parse(savedRecipients));
            } catch (e) {
                console.error("Erro ao carregar destinatários:", e);
            }
        }

        if (savedConfig) {
            try {
                const config = JSON.parse(savedConfig);
                if (config.selectedToken && config.selectedToken.symbol) {
                    setTokenSymbol(config.selectedToken.symbol);
                }
            } catch (e) {
                console.error("Erro ao carregar configuração:", e);
            }
        }
    }, []);

    // Save recipients whenever they change
    React.useEffect(() => {
        if (recipients.length > 0) {
            localStorage.setItem("recipients_draft", JSON.stringify(recipients));
        }
    }, [recipients]);

    const handleAddRecipient = (data: RecipientData) => {
        setRecipients([...recipients, data]);
        setIsAddModalOpen(false);
    };

    const handleEditRecipient = (data: RecipientData) => {
        setRecipients(recipients.map(r => r.id === data.id ? data : r));
        setIsEditModalOpen(false);
        setSelectedRecipient(null);
    };

    const handleDeleteRecipient = (id: string) => {
        const updated = recipients.filter(r => r.id !== id);
        setRecipients(updated);
        localStorage.setItem("recipients_draft", JSON.stringify(updated));
        setIsEditModalOpen(false);
        setSelectedRecipient(null);
    };

    const handleGoHome = () => {
        setIsWarningModalOpen(true);
    };

    const confirmGoHome = () => {
        localStorage.removeItem("contract_draft");
        localStorage.removeItem("recipients_draft");
        router.push("/home-cliente");
    };

    const openEditModal = (recipient: RecipientData) => {
        setSelectedRecipient(recipient);
        setIsEditModalOpen(true);
    };

    const formatAddress = (address: string) => {
        if (!address) return "";
        if (address.length <= 12) return address;
        return `${address.substring(0, 4)}...${address.substring(address.length - 8)}`;
    };

    return (
        <div className="bg-black text-white min-h-screen flex flex-col font-sans">
            {/* Navigation Header */}
            <nav className="bg-[#2A2A2A] px-4 py-3 flex items-center justify-between sticky top-0 z-50 shadow-lg">
                <div className="flex items-center space-x-2">
                    <button onClick={handleGoHome} className="hover:opacity-80 transition-opacity">
                        <span className="material-icons-outlined text-white text-xl">home</span>
                    </button>
                    <div className="flex items-center text-[13px] font-medium text-white opacity-90">
                        <span className="material-icons-outlined text-sm mx-1">chevron_right</span>
                        <Link href="/configuracao" className="hover:underline">Configuração</Link>
                        <span className="material-icons-outlined text-sm mx-1">chevron_right</span>
                        <span>Destinatários</span>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    {isAdminUser && <NetworkSelector />}
                    <button onClick={() => setIsWarningModalOpen(true)} className="flex items-center justify-center hover:text-red-500 transition-colors">
                        <span className="material-icons-outlined text-gray-400 text-2xl">cancel</span>
                    </button>
                </div>
            </nav>

            <main className="flex-grow px-5 py-8 space-y-12 w-full">
                {/* Section 1: Add Manual */}
                <section className="space-y-4">
                    <h2 className="text-2xl font-bold">Destinatário</h2>
                    <button
                        onClick={() => setIsAddModalOpen(true)}
                        className="w-full bg-[#845E20] hover:bg-opacity-90 active:scale-95 transition-all py-4 rounded-xl flex items-center justify-center space-x-2 font-bold shadow-lg"
                    >
                        <span className="text-xl">+</span>
                        <span>Add manualmente</span>
                    </button>
                </section>

                {/* Section 2: Recipient List */}
                <section className="space-y-4">
                    <h2 className="text-2xl font-bold">Destinatário</h2>

                    {recipients.length === 0 ? (
                        <p className="text-gray-500 text-center py-4 italic">Nenhum destinatário adicionado.</p>
                    ) : (
                        <div className="space-y-3">
                            {recipients.map((recipient) => (
                                <div
                                    key={recipient.id}
                                    onClick={() => openEditModal(recipient)}
                                    className="bg-[#262626] rounded-2xl p-4 flex items-center justify-between border border-white/5 shadow-inner cursor-pointer hover:bg-[#303030] transition-colors"
                                >
                                    <div className="flex items-center space-x-3">
                                        <div className="w-10 h-10 rounded-full bg-[#8B5E1D] flex items-center justify-center p-0.5 overflow-hidden ring-1 ring-white/10">
                                            <Image
                                                alt="Coin icon"
                                                className="w-full h-full rounded-full object-cover opacity-90"
                                                src="https://lh3.googleusercontent.com/aida-public/AB6AXuDNJvl2KDxUzPuncdKBktYxBkpK_XvDr5Nuj5HuDLFQ7kL0hvwtW12F2EIYpqWWBJ93OOEEjTuBL2CYWkQ-F_6ZlbzRKOD7lrPQQeCcTvIfkxoFtuhB4RN5Ldu_WnnkVRaGIWvKESQxXQXXJDfWjzUthmeKBo39OtopZLqfWTX23KAlCBkbG3AFGn8psx-4BxQh9OSovjC7g09WQFkM_r87wsX6OATw5RbDvvHVoRff9hqbAnNhqnI-z34cAx2ZZmNVVFzmSNG3NPA"
                                                width={40}
                                                height={40}
                                            />
                                        </div>
                                        <div className="flex items-center">
                                            <span className="font-bold text-lg mr-2 uppercase">{recipient.amount || '0'}</span>
                                            <span className="text-gray-400 text-sm tracking-tight font-medium">
                                                {formatAddress(recipient.walletAddress)}
                                            </span>
                                        </div>
                                    </div>
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            openEditModal(recipient);
                                        }}
                                        className="text-gray-400 hover:text-white transition-colors p-1"
                                    >
                                        <span className="material-icons-outlined">more_horiz</span>
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}

                    <div className="flex justify-end pr-1 pt-2">
                        <button
                            onClick={() => setIsAddModalOpen(true)}
                            className="text-sm font-bold flex items-center space-x-1 text-[#8B5E1D] hover:opacity-80 active:scale-95 transition-all"
                        >
                            <span className="text-lg">+</span>
                            <span className="uppercase tracking-wide">Add manualmente</span>
                        </button>
                    </div>
                </section>
            </main>

            <EditRecipientModal
                isOpen={isEditModalOpen}
                onClose={() => setIsEditModalOpen(false)}
                onSave={handleEditRecipient}
                onDelete={handleDeleteRecipient}
                recipient={selectedRecipient}
                tokenSymbol={tokenSymbol}
            />

            <AddRecipientModal
                isOpen={isAddModalOpen}
                onClose={() => setIsAddModalOpen(false)}
                onSave={handleAddRecipient}
                tokenSymbol={tokenSymbol}
            />

            {/* Footer Actions */}
            <footer className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-screen-md p-5 bg-black/90 backdrop-blur-md border-t border-white/5 flex gap-4 z-50">
                <Link
                    href="/configuracao"
                    className="flex-1 bg-[#FCE38A] text-black font-bold py-4 rounded-2xl text-[16px] shadow-lg active:scale-95 transition-all hover:opacity-90 text-center flex items-center justify-center"
                >
                    Voltar
                </Link>
                <Link
                    href="/revisar"
                    className="flex-1 bg-gradient-to-r from-[#8B612E] to-[#5C401D] text-white font-bold py-4 rounded-2xl text-[16px] shadow-lg active:scale-95 transition-all hover:opacity-90 text-center flex items-center justify-center"
                >
                    Continuar
                </Link>
            </footer>
            <ExitWarningModal
                isOpen={isWarningModalOpen}
                onClose={() => setIsWarningModalOpen(false)}
                onConfirm={confirmGoHome}
            />
        </div>
    );
}
