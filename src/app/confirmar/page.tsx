"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useNetwork } from "@/contexts/NetworkContext";
import { useWallet } from "@/contexts/WalletContext";
import { parseVestingDate } from "@/utils/date-utils";
import { Connection } from "@solana/web3.js";
import { getRpcUrl } from "@/utils/solana-config";
import { createVestingTransaction } from "@/utils/verum-contract";

export default function ConfirmationPage() {
    const router = useRouter();
    const { network: currentNetwork } = useNetwork();
    const { wallet, connected } = useWallet();
    const [showToast, setShowToast] = useState(false);

    useEffect(() => {
        // Save the contract to the persistent list and clear drafts
        const saveContract = async () => {
            try {
                const savedConfig = localStorage.getItem("contract_draft");
                const savedRecipients = localStorage.getItem("recipients_draft");

                if (savedConfig && savedRecipients) {
                    const config = JSON.parse(savedConfig);
                    const recipients = JSON.parse(savedRecipients); // Start with saved recipients

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

                    // ---------------------------------------------------------
                    // ON-CHAIN INTEGRATION: Create Vesting Contracts
                    // ---------------------------------------------------------
                    if (connected && wallet) {
                        const connection = new Connection(getRpcUrl(currentNetwork), 'confirmed');

                        // Process each recipient sequentially to ensure signatures
                        // Note: Mapping over array with async/await requires Promise.all or for...of
                        const processedRecipients = [];

                        for (const recipient of recipients) {
                            if (!config.selectedToken?.mint) {
                                console.error("Token Mint not found in config");
                                continue;
                            }

                            try {
                                console.log(`Creating vesting for ${recipient.walletAddress}...`);

                                // Calculate seconds parameters
                                const startSeconds = Math.floor(startDate.getTime() / 1000);
                                const durationSeconds = parseInt(config.vestingDuration) || 0; // Config usually in seconds or needs conversion based on unit?
                                // Assuming config.vestingDuration is already normalized or we need to normalize based on unit
                                // Let's check config.selectedTimeUnit. 
                                // If the previous pages handled conversion, great. If not, we might need logic.
                                // Usually 'vestingDuration' input is just a number. 'selectedTimeUnit' is 'seconds', 'minutes', 'days'.

                                let durationMult = 1;
                                switch (config.selectedTimeUnit) {
                                    case 'minutos': durationMult = 60; break;
                                    case 'horas': durationMult = 3600; break;
                                    case 'dias': durationMult = 86400; break;
                                    case 'semanas': durationMult = 604800; break;
                                    case 'meses': durationMult = 2592000; break; // approx
                                    case 'anos': durationMult = 31536000; break;
                                }

                                const finalDuration = (parseInt(config.vestingDuration) || 0) * durationMult;

                                // Cliff check? 'selectedSchedule' might imply patterns. 
                                // MVP: Cliff = 0 for linear/standard.
                                const cliffSeconds = 0;

                                // Amount logic. Recipient amount is usually in UI units (e.g., 10 Tokens).
                                // Need to convert to Raw Amount based on decimals.
                                const decimals = config.selectedToken.decimals || 9;
                                const rawAmount = Math.floor(parseFloat(recipient.amount) * (10 ** decimals));

                                const txResult = await createVestingTransaction({
                                    wallet,
                                    connection,
                                    recipientAddress: recipient.walletAddress,
                                    mintAddress: config.selectedToken.mint,
                                    startTime: startSeconds,
                                    durationSeconds: finalDuration,
                                    cliffSeconds: cliffSeconds,
                                    amount: rawAmount,
                                    decimals: decimals,
                                    revocable: true, // Configurable? Default true for now.
                                    network: currentNetwork
                                });

                                if (txResult.success) {
                                    processedRecipients.push({
                                        ...recipient,
                                        vestingAccount: txResult.vestingAccount,
                                        vault: txResult.vault,
                                        txSignature: txResult.signature
                                    });
                                } else {
                                    processedRecipients.push(recipient); // Keep original if failed? Or handle error.
                                }

                            } catch (err) {
                                console.error("Failed to create on-chain vesting:", err);
                                // Don't crash the whole flow, but maybe mark as draft/failed?
                                // For now, push recipient without vesting data so UI still shows it (as pending/simulated)
                                processedRecipients.push(recipient);
                            }
                        }

                        // Update recipients list with on-chain data
                        recipients.length = 0;
                        recipients.push(...processedRecipients);
                    }

                    // Create a unique ID and set initial status
                    const newContract = {
                        ...config,
                        recipients,
                        senderAddress, // Store who created it
                        id: `ct-${Date.now()}`,
                        createdAt: new Date().toISOString(),
                        status,
                        network: currentNetwork,
                        progress: 0,
                        unlockedAmount: 0,
                        totalAmount: recipients.reduce((sum: number, r: any) => sum + (parseFloat(r.amount) || 0), 0)
                    };

                    // Get existing contracts or init empty list
                    const existingStr = localStorage.getItem("created_contracts");
                    const existing = existingStr ? JSON.parse(existingStr) : [];

                    // Add new contract
                    localStorage.setItem("created_contracts", JSON.stringify([newContract, ...existing]));

                    // Set as selected contract for immediate viewing
                    localStorage.setItem("selected_contract", JSON.stringify(newContract));

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
