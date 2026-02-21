"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useNetwork } from "@/contexts/NetworkContext";
import { parseVestingDate } from "@/utils/date-utils";
import { PublicKey } from "@solana/web3.js";
import { BN } from "@project-serum/anchor";

export default function ConfirmationPage() {
    const router = useRouter();
    const { network: currentNetwork } = useNetwork();
    const [showToast, setShowToast] = useState(false);

    useEffect(() => {
        // Save the contract to the persistent list and clear drafts
        const saveContract = async () => {
            try {
                const savedConfig = localStorage.getItem("contract_draft");
                const savedRecipients = localStorage.getItem("recipients_draft");

                if (savedConfig && savedRecipients) {
                    const config = JSON.parse(savedConfig);
                    const recipients = JSON.parse(savedRecipients);

                    // Comparison logic for status
                    const now = new Date();

                    // Helper to parse "dd/mm/yyyy, hh:mm"
                    const parseDate = (s: string) => {
                        const d = parseVestingDate(s);
                        return d || new Date(); // Fallback
                    };

                    const startDate = parseDate(config.vestingStartDate || "");
                    const isStarted = startDate.getTime() <= now.getTime();

                    // Get sender address from cookie
                    const getCookie = (name: string) => {
                        const value = `; ${document.cookie}`;
                        const parts = value.split(`; ${name}=`);
                        if (parts.length === 2) return parts.pop()?.split(';').shift();
                    };
                    const senderAddress = getCookie('wallet_address') || "";

                    const status = isStarted ? "em-andamento" : "agendado";
                    const createdIdsStr = localStorage.getItem("created_contract_ids");
                    const createdIds = createdIdsStr ? JSON.parse(createdIdsStr) : [];

                    // Get existing contracts or init empty list
                    const existingStr = localStorage.getItem("created_contracts");
                    const existing = existingStr ? JSON.parse(existingStr) : [];

                    const newContracts = [];

                    // Create separate entries for each recipient
                    for (let i = 0; i < recipients.length; i++) {
                        const recipient = recipients[i];
                        const contractIdValue = createdIds[i] || `ct-${Date.now()}-${i}`;

                        // Derivar o PDA real para usar como ID único
                        let pdaAddress = contractIdValue;
                        try {
                            const mintPubkey = new PublicKey(config.selectedToken?.address || config.selectedToken?.mint);
                            const creatorPubkey = new PublicKey(senderAddress);
                            const [pda] = PublicKey.findProgramAddressSync(
                                [
                                    Buffer.from("vesting"),
                                    creatorPubkey.toBuffer(),
                                    mintPubkey.toBuffer(),
                                    new BN(contractIdValue).toArrayLike(Buffer, "le", 8)
                                ],
                                new PublicKey("HMqYLNw1ABgVeFcP2PmwDv6bibcm9y318aTo2g25xQMm")
                            );
                            pdaAddress = pda.toBase58();
                        } catch (e) {
                            console.error("Erro ao derivar PDA no confirma:", e);
                        }

                        const contractEntry = {
                            ...config,
                            recipients: [recipient], // Apenas este destinatário nesta entrada
                            senderAddress,
                            id: pdaAddress,
                            blockchainId: contractIdValue,
                            createdAt: new Date().toISOString(),
                            status,
                            network: currentNetwork,
                            progress: 0,
                            unlockedAmount: 0,
                            totalAmount: parseFloat(recipient.amount) || 0,
                            claimedAmount: 0
                        };
                        newContracts.push(contractEntry);
                    }

                    // Save all new contracts
                    localStorage.setItem("created_contracts", JSON.stringify([...newContracts, ...existing]));

                    // Set the first one as selected contract for immediate viewing
                    if (newContracts.length > 0) {
                        localStorage.setItem("selected_contract", JSON.stringify(newContracts[0]));
                    }

                    // SEND EMAILS
                    recipients.forEach((recipient: any) => {
                        if (recipient.email) {
                            const contractDataForEmail = {
                                tokenName: config.selectedToken?.name || "Token",
                                tokenSymbol: config.selectedToken?.symbol || "TKN",
                                totalAmount: recipient.amount,
                                status: status,
                                vestingStartDate: config.vestingStartDate,
                                vestingDuration: config.vestingDuration,
                                selectedTimeUnit: config.selectedTimeUnit,
                                selectedSchedule: config.selectedSchedule
                            };

                            fetch('/api/send-email', {
                                method: 'POST',
                                headers: {
                                    'Content-Type': 'application/json',
                                },
                                body: JSON.stringify({
                                    recipientEmail: recipient.email,
                                    contractData: contractDataForEmail
                                }),
                            }).catch(err => console.error("Error sending email:", err));
                        }
                    });

                    // Clear drafts
                    localStorage.removeItem("contract_draft");
                    localStorage.removeItem("recipients_draft");
                }
            } catch (e) {
                console.error("Error saving contract:", e);
            }
        };

        saveContract();

        // Auto-trigger toast after 2 seconds
        const timer = setTimeout(() => {
            setShowToast(true);
            // Navigate to success page after 4 more seconds
            setTimeout(() => {
                router.push("/sucesso");
            }, 4000);
        }, 2000);

        return () => clearTimeout(timer);
    }, [router]);

    return (
        <div className="bg-black text-white min-h-screen font-sans">
            {/* Toast Notification */}
            {showToast && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
                    <div className="w-full max-w-md bg-[#2D2D2D] flex items-center justify-between p-4 rounded-[14px] shadow-2xl border border-white/10 animate-in zoom-in-95 duration-300">
                        <div className="flex-1 pr-4">
                            <p className="text-white font-bold text-[15px] leading-tight tracking-tight">
                                Transação enviada! Aguarde alguns segundos para finalizar.
                            </p>
                        </div>
                        <button
                            onClick={() => setShowToast(false)}
                            className="flex items-center justify-center text-gray-400 hover:text-white transition-colors cursor-pointer"
                        >
                            <div className="w-7 h-7 rounded-full border-[1.5px] border-gray-500 flex items-center justify-center">
                                <svg fill="none" height="12" viewBox="0 0 12 12" width="12" xmlns="http://www.w3.org/2000/svg">
                                    <path d="M1 1L11 11M1 11L11 1" stroke="currentColor" strokeLinecap="round" strokeWidth="2"></path>
                                </svg>
                            </div>
                        </button>
                    </div>
                </div>
            )}
            {/* Header */}
            <header className="bg-[#262626] px-4 py-3 border-b border-white/10 sticky top-0 z-50">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3 overflow-x-auto scrollbar-hide">
                        <Link href="/">
                            <span className="material-symbols-outlined text-xl text-white">home</span>
                        </Link>
                        <div className="flex items-center gap-1.5 whitespace-nowrap">
                            <span className="material-symbols-outlined text-green-500 text-[18px]">check_circle</span>
                            <span className="text-[11px] font-medium text-white">Configuração</span>
                        </div>
                        <div className="flex items-center gap-1.5 whitespace-nowrap">
                            <span className="material-symbols-outlined text-green-500 text-[18px]">check_circle</span>
                            <span className="text-[11px] font-medium text-white">Destinatários</span>
                        </div>
                        <div className="flex items-center gap-1.5 whitespace-nowrap">
                            <span className="material-symbols-outlined text-green-500 text-[18px]">check_circle</span>
                            <span className="text-[11px] font-medium text-white">Revisar</span>
                        </div>
                    </div>
                    <Link href="/">
                        <span className="material-symbols-outlined text-gray-400 text-2xl">cancel</span>
                    </Link>
                </div>
            </header>

            <main className="p-5 pb-20">
                <h1 className="text-[22px] font-bold mb-6 text-white">Revisar Contrato</h1>

                {/* Tabs */}
                <div className="flex items-center gap-8 mb-8 border-b border-white/5">
                    <div className="flex flex-col pb-1">
                        <span className="text-[15px] font-semibold text-gray-500">Falha (0)</span>
                    </div>
                    <div className="flex flex-col border-b-2 border-[#EAB308] pb-1">
                        <span className="text-[15px] font-semibold text-[#EAB308]">Sucesso (1)</span>
                    </div>
                </div>

                {/* Content */}
                <div className="space-y-8">
                    <div>
                        <h2 className="text-[15px] text-white font-bold mb-5 tracking-wide">Destinatário 1</h2>

                        <div className="space-y-6 bg-[#1A1A1A] p-5 rounded-2xl border border-white/5 shadow-inner">
                            {/* Total Amount */}
                            <div className="space-y-2">
                                <p className="text-[14px] text-gray-400 font-medium tracking-tight">Quantidade Total</p>
                                <div className="flex items-center gap-3 bg-black/40 p-3 rounded-xl border border-white/5">
                                    <div className="w-6 h-6 rounded-full bg-[#EAB308] flex items-center justify-center overflow-hidden shadow-lg shrink-0">
                                        <Image
                                            alt="Token icon"
                                            className="w-full h-full object-cover"
                                            src="https://lh3.googleusercontent.com/aida-public/AB6AXuDELC6datmaXBtzPcglHQvij3C2uLarSwYfXazFnMbIez92A7-NvXV2X_NxWgAoLHVftJFDtEDcrRiJziKR3-u-etDFvhVxJ0ZWxPFihObSXPEYbTMDRrGQWQXR7l8FjYa6Jlhe_zigt0Je3Uc6JmU8hkdPacIspEg1P5vWHwk2B-VQQbcSnEID5mnokuGf7ma_gGeqe-A9Nu1MUBOJI7xnxJAjKfWTB1ZcOhqASWGfnzxmEU59p77RN13h3f0rZ9Wdb4Mm7qfmmOg"
                                            width={24}
                                            height={24}
                                        />
                                    </div>
                                    <div className="flex items-baseline gap-2">
                                        <span className="text-[16px] font-extrabold text-white">8 BDC</span>
                                        <span className="text-[13px] text-gray-500 font-medium">($ 0)</span>
                                    </div>
                                </div>
                            </div>

                            {/* Recipient Address */}
                            <div className="space-y-2">
                                <p className="text-[14px] font-bold text-white tracking-tight">Endereço Destinatários</p>
                                <div className="flex items-center gap-3 bg-black/40 p-3 rounded-xl border border-white/5 group active:scale-[0.99] transition-all">
                                    <div className="w-6 h-6 rounded-full bg-[#EAB308] flex items-center justify-center overflow-hidden shadow-lg shrink-0">
                                        <Image
                                            alt="Wallet icon"
                                            className="w-full h-full object-cover"
                                            src="https://lh3.googleusercontent.com/aida-public/AB6AXuCeVlKLfaMkZi1LOCPkjlscauHReitOAiqDKBDwA5W_VRHj8XCXhxvXLNO04CJghxgO7hXqpJ5twsvJrzY6ARkTmpMZn8B8beSDgk65lsQleKPMdL9hfvYcrfZawPMF-yl9B8oTVTxOZyFXhjkbPRoo3ALt2HsrhoKOfRLTBMO6TOe3MRfcy5LGYmWs-QfTkaKmD-NfcqEkADFp1-eQ62e5guLCzRV4U7rsSV5nJuYSR0r3GNI-6Ga7HR86gsDxe81dWBu-1Mvv9QQ"
                                            width={24}
                                            height={24}
                                        />
                                    </div>
                                    <span className="text-[15px] text-gray-300 font-mono tracking-tight">Ctauy54N...5jppZt</span>
                                    <span className="material-symbols-outlined text-gray-500 text-sm ml-auto">content_copy</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
}
