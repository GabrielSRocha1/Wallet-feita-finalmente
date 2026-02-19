"use client";

import React, { useState } from "react";

interface ReceiveTokenModalProps {
    isOpen: boolean;
    onClose: () => void;
    publicKey: string | null;
}

const ReceiveTokenModal: React.FC<ReceiveTokenModalProps> = ({ isOpen, onClose, publicKey }) => {
    const [copied, setCopied] = useState(false);

    if (!isOpen || !publicKey) return null;

    const handleCopy = async () => {
        try {
            await navigator.clipboard.writeText(publicKey);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch (err) {
            console.error("Failed to copy:", err);
        }
    };

    // Use a reliable QR code generator API
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${publicKey}&color=EAB308&bgcolor=18181b&margin=20`;

    return (
        <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-black/80 backdrop-blur-xl animate-in fade-in duration-300">
            <div className="w-full max-w-sm bg-zinc-900 border border-white/10 rounded-[40px] shadow-2xl overflow-hidden relative animate-in zoom-in-95 duration-300">
                {/* Close Button */}
                <button
                    onClick={onClose}
                    className="absolute top-6 right-6 text-zinc-500 hover:text-white transition-colors cursor-pointer z-10"
                >
                    <span className="material-icons-round">close</span>
                </button>

                <div className="p-8 flex flex-col items-center">
                    <h2 className="text-xl font-bold text-white mb-2 flex items-center gap-2">
                        <span className="material-icons-round text-[#EAB308]">qr_code_2</span>
                        Receber fundos
                    </h2>
                    <p className="text-zinc-500 text-xs font-medium uppercase tracking-widest mb-8">Endereço Solana</p>

                    {/* QR Code Container */}
                    <div className="relative group mb-8">
                        <div className="absolute -inset-4 bg-[#EAB308]/20 rounded-[48px] blur-2xl group-hover:bg-[#EAB308]/30 transition-all duration-500 overflow-hidden outline-none"></div>
                        <div className="relative bg-[#18181b] p-4 rounded-[40px] border border-[#EAB308]/20 shadow-2xl">
                            <img
                                src={qrUrl}
                                alt="Solana Address QR Code"
                                className="w-56 h-56 rounded-3xl"
                                loading="eager"
                            />
                        </div>
                    </div>

                    {/* Address Box */}
                    <div
                        onClick={handleCopy}
                        className="w-full bg-black/40 border border-white/5 rounded-2xl p-4 flex flex-col items-center gap-2 cursor-pointer hover:bg-black/60 transition-all group active:scale-95"
                    >
                        <p className="text-zinc-500 text-[10px] font-black uppercase tracking-tighter">Sua Chave Pública</p>
                        <div className="flex items-center gap-2">
                            <p className="text-white font-mono text-xs break-all text-center">
                                {publicKey.slice(0, 12)}...{publicKey.slice(-12)}
                            </p>
                            <span className={`material-icons-round text-sm transition-colors ${copied ? 'text-green-500' : 'text-zinc-600 group-hover:text-[#EAB308]'}`}>
                                {copied ? 'check_circle' : 'content_copy'}
                            </span>
                        </div>
                        {copied && (
                            <span className="text-[9px] text-green-500 font-bold uppercase animate-in fade-in slide-in-from-top-1">Copiado com sucesso!</span>
                        )}
                    </div>

                    <p className="mt-8 text-zinc-600 text-[10px] font-medium text-center leading-relaxed px-4">
                        Envie apenas <span className="text-zinc-400">ativos da rede Solana (SOL, SPL)</span> para este endereço. Outros ativos podem ser perdidos permanentemente.
                    </p>
                </div>
            </div>
        </div>
    );
};

export default ReceiveTokenModal;
