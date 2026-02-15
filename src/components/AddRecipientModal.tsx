"use client";

import React, { useState } from "react";

export interface RecipientData {
    id: string;
    contractTitle: string;
    amount: string;
    walletAddress: string;
    useConnectedWallet: boolean;
    email?: string;
}

interface AddRecipientModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (data: RecipientData) => void;
    tokenSymbol: string;
}

const AddRecipientModal: React.FC<AddRecipientModalProps> = ({
    isOpen,
    onClose,
    onSave,
    tokenSymbol,
}) => {
    const [walletAddress, setWalletAddress] = useState("");
    const [contractTitle, setContractTitle] = useState("");
    const [amount, setAmount] = useState("");
    const [email, setEmail] = useState("");

    const getCookie = (name: string) => {
        if (typeof document === 'undefined') return null;
        const value = `; ${document.cookie}`;
        const parts = value.split(`; ${name}=`);
        if (parts.length === 2) return parts.pop()?.split(';').shift();
        return null;
    };



    const handleSave = () => {
        onSave({
            id: Math.random().toString(36).substr(2, 9),
            contractTitle,
            amount,
            walletAddress,
            useConnectedWallet: false,
            email
        });
        // Reset fields after saving
        setContractTitle("");
        setAmount("");
        setWalletAddress("");
        setEmail("");
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-300">
            <div
                className="w-full max-w-md bg-[#1C1C1E] rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300 border border-white/10"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex items-center justify-between p-6 pb-4 border-b border-white/5">
                    <h1 className="text-xl font-bold text-white">Adicionar destinatário</h1>
                    <button
                        onClick={onClose}
                        className="text-gray-400 hover:text-white transition-colors cursor-pointer"
                    >
                        <span className="material-symbols-outlined text-3xl">cancel</span>
                    </button>
                </div>

                <div className="px-6 pb-6 space-y-5 pt-6">
                    <div className="space-y-1.5">
                        <label className="block text-sm font-semibold text-white">Título do Contrato</label>
                        <input
                            className="w-full bg-[#2C2C2E] border border-white/10 rounded-xl py-3 px-4 text-white placeholder-gray-500 focus:ring-1 focus:ring-[#FDE68A] outline-none transition-all"
                            placeholder="ex. Vesting João Automóveis"
                            type="text"
                            value={contractTitle}
                            onChange={(e) => setContractTitle(e.target.value)}
                        />
                        <div className="flex items-center space-x-1.5 text-xs text-gray-500">
                            <span className="material-symbols-outlined text-sm">info</span>
                            <span>Lembre-se que o título é público.</span>
                        </div>
                    </div>

                    <div className="space-y-1.5">
                        <label className="block text-sm font-semibold text-white">
                            Amount <span className="text-red-500">*</span>
                        </label>
                        <div className="relative flex items-center">
                            <div className="absolute left-3 w-6 h-6 bg-gray-500 rounded-full"></div>
                            <input
                                className="w-full bg-[#2C2C2E] border border-white/10 rounded-xl py-3 pl-12 pr-20 text-white placeholder-gray-500 focus:ring-1 focus:ring-[#FDE68A] outline-none transition-all"
                                placeholder="0.00"
                                type="text"
                                value={amount}
                                onChange={(e) => setAmount(e.target.value)}
                            />
                            <span className="absolute right-4 text-xs font-bold text-gray-500 uppercase tracking-wider">{tokenSymbol || "TOKEN"}</span>
                        </div>
                        <div className="text-xs text-gray-500">
                            Quantidade restante: <span className="font-bold">QTD DA CARTEIRA CONECTADA</span>
                        </div>
                    </div>

                    <div className="space-y-1.5">
                        <label className="block text-sm font-semibold text-white">
                            Endereço Wallet <span className="text-red-500">*</span>
                        </label>
                        <div className="relative">
                            <input
                                className="w-full bg-[#2C2C2E] border border-white/10 rounded-xl py-3 px-4 pr-12 text-white placeholder-gray-500 focus:ring-1 focus:ring-[#FDE68A] outline-none transition-all"
                                placeholder="Chave Pública"
                                type="text"
                                value={walletAddress}
                                onChange={(e) => setWalletAddress(e.target.value)}
                            />
                            <button className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white cursor-pointer">
                                <span className="material-symbols-outlined filled-icon">contact_page</span>
                            </button>
                        </div>
                    </div>



                    <div className="space-y-1.5">
                        <label className="block text-sm font-semibold text-gray-400">
                            E-mail do Destinatário <span className="text-xs font-normal">(Opcional)</span>
                        </label>
                        <input
                            className="w-full bg-[#2C2C2E] border border-white/10 rounded-xl py-3 px-4 text-white placeholder-gray-500 focus:ring-1 focus:ring-[#FDE68A] outline-none transition-all"
                            placeholder="email@exemplo.com"
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                        />
                    </div>

                    <div className="flex items-center justify-end space-x-3 pt-4">
                        <button
                            onClick={onClose}
                            className="bg-[#2C2C2E] hover:bg-white/10 text-white font-bold py-3 px-8 rounded-xl transition-all border border-white/10 cursor-pointer"
                        >
                            Cancelar
                        </button>
                        <button
                            onClick={handleSave}
                            className="bg-[#D4AF37] hover:bg-[#b08d2b] text-black font-bold py-3 px-10 rounded-xl transition-all shadow-lg cursor-pointer"
                        >
                            Salvar
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AddRecipientModal;
