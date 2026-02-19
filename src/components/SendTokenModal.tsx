"use client";

import React, { useState } from "react";
import Image from "next/image";
import { useVestingActions } from "@/hooks/useVestingActions";

interface TokenData {
    mint: string;
    displayAmount: number;
    decimals: number;
    symbol: string;
    image?: string;
    price?: number;
}

interface SendTokenModalProps {
    isOpen: boolean;
    onClose: () => void;
    token: TokenData | null;
}

const SendTokenModal: React.FC<SendTokenModalProps> = ({ isOpen, onClose, token }) => {
    const { sendTokens } = useVestingActions();
    const [destination, setDestination] = useState("");
    const [amount, setAmount] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);

    if (!isOpen || !token) return null;

    const handleSend = async () => {
        setLoading(true);
        setError(null);
        try {
            const signature = await sendTokens(
                token.mint,
                destination,
                parseFloat(amount),
                token.decimals
            );
            console.log("Transfer successful:", signature);
            setSuccess(true);
            setTimeout(() => {
                onClose();
                setSuccess(false);
                setDestination("");
                setAmount("");
            }, 3000);
        } catch (err: any) {
            console.error("Transfer failed:", err);
            setError(err.message || "Erro ao processar transferência");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-black/80 backdrop-blur-xl animate-in fade-in duration-300">
            <div className="w-full max-w-md bg-zinc-900 border border-white/10 rounded-[32px] shadow-2xl overflow-hidden relative animate-in zoom-in-95 duration-300">
                {/* Close Button */}
                <button
                    onClick={onClose}
                    className="absolute top-6 right-6 text-zinc-500 hover:text-white transition-colors cursor-pointer z-10"
                >
                    <span className="material-icons-round">close</span>
                </button>

                <div className="p-8">
                    <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
                        <span className="material-icons-round text-[#EAB308]">send</span>
                        Enviar {token.symbol}
                    </h2>

                    {success ? (
                        <div className="flex flex-col items-center justify-center py-10 space-y-4 animate-in zoom-in duration-500">
                            <div className="w-20 h-20 bg-green-500/10 rounded-full flex items-center justify-center border border-green-500/20">
                                <span className="material-icons-round text-green-500 text-4xl">check_circle</span>
                            </div>
                            <p className="text-white font-bold text-lg">Transferência realizada!</p>
                            <p className="text-zinc-500 text-sm">Aguarde a confirmação na rede.</p>
                        </div>
                    ) : (
                        <div className="space-y-6">
                            {/* Token Info */}
                            <div className="bg-black/40 border border-white/5 rounded-2xl p-4 flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    {token.image ? (
                                        <img src={token.image} alt={token.symbol} className="w-10 h-10 rounded-full border border-[#EAB308]/20" />
                                    ) : (
                                        <div className="w-10 h-10 rounded-full bg-zinc-800 flex items-center justify-center font-bold text-[#EAB308]">
                                            {token.symbol[0]}
                                        </div>
                                    )}
                                    <div>
                                        <p className="text-white font-bold text-sm">{token.symbol}</p>
                                        <p className="text-zinc-500 text-[10px] font-mono">{token.mint.slice(0, 4)}...{token.mint.slice(-4)}</p>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <p className="text-zinc-400 text-xs font-bold uppercase tracking-widest text-[10px] mb-0.5">Disponível</p>
                                    <p className="text-white font-mono text-sm">{token.displayAmount.toLocaleString()} {token.symbol}</p>
                                </div>
                            </div>

                            {/* Destination Input */}
                            <div className="space-y-2">
                                <label className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest ml-1">Para</label>
                                <div className="relative">
                                    <input
                                        type="text"
                                        placeholder="Endereço Solana (Base58)"
                                        value={destination}
                                        onChange={(e) => setDestination(e.target.value)}
                                        className="w-full bg-black/40 border border-white/5 rounded-2xl px-4 py-4 text-white text-sm focus:outline-none focus:border-[#EAB308]/50 transition-all font-mono placeholder:font-sans"
                                    />
                                    <span className="absolute right-4 top-1/2 -translate-y-1/2 material-icons-round text-zinc-600">contact_page</span>
                                </div>
                            </div>

                            {/* Amount Input */}
                            <div className="space-y-2">
                                <div className="flex justify-between items-end ml-1">
                                    <label className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">Quantidade</label>
                                    <button
                                        onClick={() => setAmount(token.displayAmount.toString())}
                                        className="text-[10px] text-[#EAB308] font-bold uppercase hover:underline cursor-pointer"
                                    >
                                        Máximo
                                    </button>
                                </div>
                                <div className="relative">
                                    <input
                                        type="number"
                                        placeholder="0.00"
                                        value={amount}
                                        onChange={(e) => setAmount(e.target.value)}
                                        className="w-full bg-black/40 border border-white/5 rounded-2xl px-4 py-4 text-white text-lg font-bold focus:outline-none focus:border-[#EAB308]/50 transition-all"
                                    />
                                    <div className="absolute right-4 top-1/2 -translate-y-1/2">
                                        <span className="text-zinc-500 font-bold text-sm">{token.symbol}</span>
                                    </div>
                                </div>
                                {token.price && (
                                    <p className="text-right text-[10px] text-zinc-600 font-bold">
                                        ≈ ${(parseFloat(amount || "0") * token.price).toLocaleString()} USD
                                    </p>
                                )}
                            </div>

                            {error && (
                                <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3 flex items-center gap-3 animate-in shake-in duration-300">
                                    <span className="material-icons-round text-red-500 text-lg">error_outline</span>
                                    <p className="text-red-500 text-xs font-medium">{error}</p>
                                </div>
                            )}

                            <button
                                onClick={handleSend}
                                disabled={loading || !destination || !amount || parseFloat(amount) <= 0}
                                className={`w-full py-4 rounded-2xl font-black uppercase tracking-widest text-sm flex items-center justify-center gap-2 transition-all active:scale-95 shadow-xl
                                    ${loading || !destination || !amount || parseFloat(amount) <= 0
                                        ? 'bg-zinc-800 text-zinc-600 cursor-not-allowed'
                                        : 'bg-[#EAB308] hover:bg-[#CA8A04] text-black cursor-pointer'}`}
                            >
                                {loading ? (
                                    <div className="w-5 h-5 border-2 border-black/20 border-t-black rounded-full animate-spin"></div>
                                ) : (
                                    <>
                                        <span className="material-icons-round text-lg">send</span>
                                        Enviar agora
                                    </>
                                )}
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default SendTokenModal;
