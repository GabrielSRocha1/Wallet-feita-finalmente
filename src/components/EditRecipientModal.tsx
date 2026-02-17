"use client";

import React, { useState } from "react";

import { RecipientData } from "./AddRecipientModal";

interface EditRecipientModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (data: RecipientData) => void;
    onDelete: (id: string) => void;
    recipient: RecipientData | null;
    tokenSymbol: string;
}

const EditRecipientModal: React.FC<EditRecipientModalProps> = ({
    isOpen,
    onClose,
    onSave,
    onDelete,
    recipient,
    tokenSymbol,
}) => {

    const [contractTitle, setContractTitle] = useState(recipient?.contractTitle || "");
    const [amount, setAmount] = useState(recipient?.amount || "");
    const [walletAddress, setWalletAddress] = useState(recipient?.walletAddress || "");
    const [email, setEmail] = useState(recipient?.email || "");

    // Update state when recipient prop changes
    React.useEffect(() => {
        if (recipient) {

            setContractTitle(recipient.contractTitle);
            setAmount(recipient.amount);
            setWalletAddress(recipient.walletAddress);
            setEmail(recipient.email || "");
        }
    }, [recipient]);

    const getCookie = (name: string) => {
        if (typeof document === 'undefined') return null;
        const value = `; ${document.cookie}`;
        const parts = value.split(`; ${name}=`);
        if (parts.length === 2) return parts.pop()?.split(';').shift();
        return null;
    };



    const handleSave = () => {
        if (recipient) {
            onSave({
                ...recipient,
                contractTitle,
                amount,
                walletAddress,
                useConnectedWallet: false,
                email
            });
        }
    };

    const handleDelete = () => {
        if (recipient) {
            onDelete(recipient.id);
        }
    };

    if (!isOpen || !recipient) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-300">
            <div
                className="w-full max-w-md bg-[#333331] rounded-[24px] p-6 shadow-2xl animate-in zoom-in-95 duration-300"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex items-center justify-between mb-6">
                    <h1 className="text-white text-[22px] font-bold tracking-tight">Editar destinatário</h1>
                    <button
                        onClick={onClose}
                        className="text-[#8e8e93] hover:text-white transition-colors cursor-pointer"
                    >
                        <span className="material-icons-outlined text-3xl">cancel</span>
                    </button>
                </div>

                <div className="space-y-5">
                    <div className="space-y-1.5">
                        <label className="block text-white text-[15px] font-semibold">Título do Contrato</label>
                        <div className="relative">
                            <input
                                className="w-full bg-[#4d4d4d] border-none rounded-xl py-3.5 px-4 text-[#d1d1d6] text-[16px] focus:ring-1 focus:ring-[#f3d88a] outline-none placeholder-gray-400"
                                type="text"
                                name="contractTitle"
                                autoComplete="one-time-code"
                                value={contractTitle}
                                onChange={(e) => setContractTitle(e.target.value)}
                            />
                        </div>
                        <div className="flex items-center gap-2 text-[#98989f] text-[13px] pt-1">
                            <span className="material-icons-outlined text-[16px]">info</span>
                            <span>Lembre-se que o título é público.</span>
                        </div>
                    </div>

                    <div className="space-y-1.5">
                        <label className="block text-white text-[15px] font-semibold">
                            Amount <span className="text-red-500">*</span>
                        </label>
                        <div className="relative flex items-center">
                            <div className="absolute left-3.5">
                                <div className="w-6 h-6 rounded-full bg-[#f3d88a] flex items-center justify-center border border-[#8b6121]">
                                    <span className="text-[10px] font-bold text-[#8b6121]">{tokenSymbol ? tokenSymbol.substring(0, 3).toUpperCase() : "TKN"}</span>
                                </div>
                            </div>
                            <input
                                className="w-full bg-[#4d4d4d] border-none rounded-xl py-3.5 pl-11 pr-14 text-white text-[16px] font-medium focus:ring-1 focus:ring-[#f3d88a] outline-none"
                                type="number"
                                step="any"
                                name="recipientAmount"
                                autoComplete="new-password"
                                value={amount}
                                onChange={(e) => setAmount(e.target.value)}
                            />
                            <span className="absolute right-4 text-[#98989f] text-[14px] font-medium">{tokenSymbol || "TOKEN"}</span>
                        </div>
                        <p className="text-[#98989f] text-[13px] pt-0.5">
                            Quantidade restante: <span className="text-white font-semibold">92 {tokenSymbol || "TOKEN"}</span>
                        </p>
                    </div>

                    <div className="space-y-1.5">
                        <label className="block text-white text-[15px] font-semibold">
                            Endereço Wallet <span className="text-red-500">*</span>
                        </label>
                        <div className="relative flex items-center">
                            <input
                                className="w-full bg-[#4d4d4d] border-none rounded-xl py-3.5 pl-4 pr-12 text-[#d1d1d6] text-[15px] focus:ring-1 focus:ring-[#f3d88a] outline-none truncate"
                                type="text"
                                name="walletAddress"
                                autoComplete="one-time-code"
                                value={walletAddress}
                                onChange={(e) => setWalletAddress(e.target.value)}
                            />
                            <button className="absolute right-3 text-[#98989f] hover:text-white cursor-pointer">
                                <span className="material-icons-outlined">account_box</span>
                            </button>
                        </div>
                    </div>



                    <div className="space-y-1.5">
                        <label className="block text-white text-[15px] font-semibold">
                            E-mail do Destinatário <span className="text-[#98989f] font-normal">(Opcional)</span>
                        </label>
                        <input
                            className="w-full bg-[#4d4d4d] border-none rounded-xl py-3.5 px-4 text-[#d1d1d6] text-[16px] focus:ring-1 focus:ring-[#f3d88a] outline-none"
                            type="email"
                            name="recipientEmail"
                            autoComplete="off"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                        />

                    </div>

                    <div className="flex gap-3 pt-6">
                        <button
                            onClick={handleDelete}
                            className="flex-1 bg-[#EE4444] text-white font-bold py-4 rounded-2xl text-[16px] hover:bg-[#CC3333] transition-colors cursor-pointer"
                        >
                            Excluir
                        </button>
                        <button
                            onClick={handleSave}
                            className="flex-1 bg-[#8b6121] text-white font-bold py-4 rounded-2xl text-[16px] hover:opacity-90 transition-opacity shadow-lg cursor-pointer"
                        >
                            Salvar alterações
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default EditRecipientModal;
