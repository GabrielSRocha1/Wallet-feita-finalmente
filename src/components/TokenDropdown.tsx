"use client";

import React, { useState } from "react";
import Image from "next/image";

interface Token {
    name: string;
    symbol: string;
    icon: string;
    balance: string;
    price: string;
    address: string;
}

interface TokenDropdownProps {
    isOpen: boolean;
    onClose: () => void;
    onSelect: (token: { name: string; symbol: string; icon: string; mint: string; decimals: number }) => void;
    customTokens?: any[];
    loading?: boolean;
}

const TokenDropdown: React.FC<TokenDropdownProps> = ({ isOpen, onClose, onSelect, customTokens, loading }) => {
    const [searchTerm, setSearchTerm] = useState("");
    const [imageErrors, setImageErrors] = useState<Record<string, boolean>>({});

    // Use empty array instead of static mocks if no tokens provided
    const activeTokens = customTokens || [];

    if (!isOpen) return null;

    const filteredTokens = activeTokens.filter(t =>
        (t.name || t.symbol || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
        (t.symbol || "").toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <>
            <div className="fixed inset-0 z-[60]" onClick={onClose}></div>
            <div className="absolute top-full left-0 right-0 mt-2 z-[70] bg-[#2C2C2E] border border-white/20 rounded-xl overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-200">
                <div className="p-3 border-b border-white/10 flex items-center gap-2 bg-[#1C1C1E]">
                    <span className="material-icons-round text-gray-400 text-sm">search</span>
                    <input
                        className="bg-transparent border-none focus:ring-0 text-sm w-full p-0 text-white placeholder-gray-500"
                        placeholder="Procurar token..."
                        type="text"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        autoFocus
                    />
                </div>
                <div className="max-h-60 overflow-y-auto custom-scrollbar">
                    {loading && (
                        <div className="p-4 flex items-center justify-center gap-2 text-[#EAB308] border-b border-white/5 bg-white/5">
                            <span className="material-icons-round text-sm animate-spin">sync</span>
                            <span className="text-[10px] font-bold uppercase tracking-widest">Sincronizando Carteira...</span>
                        </div>
                    )}
                    {filteredTokens.map((token: any, index: number) => (
                        <div
                            key={token.symbol + index}
                            onClick={() => {
                                onSelect({
                                    name: token.name || token.symbol,
                                    symbol: token.symbol,
                                    icon: token.icon,
                                    mint: token.mint || token.address, // Prefer full mint
                                    decimals: token.decimals || 0
                                });
                                onClose();
                            }}
                            className={`p-3 flex items-center justify-between hover:bg-white/5 cursor-pointer transition-colors ${index !== filteredTokens.length - 1 ? 'border-b border-white/5' : ''
                                }`}
                        >
                            <div className="flex items-center gap-3">
                                {token.icon && !imageErrors[token.symbol + index] ? (
                                    <div className="w-10 h-10 rounded-full bg-[#D4AF37] flex items-center justify-center overflow-hidden shadow-inner shrink-0">
                                        <img
                                            src={token.icon}
                                            alt={token.name}
                                            className="w-full h-full object-cover"
                                            onError={() => setImageErrors(prev => ({ ...prev, [token.symbol + index]: true }))}
                                        />
                                    </div>
                                ) : (
                                    <div className="w-10 h-10 rounded-full bg-zinc-800 border border-white/10 flex items-center justify-center shadow-inner shrink-0">
                                        <span className="font-bold text-xs text-zinc-400">{token.symbol?.slice(0, 2).toUpperCase() || "??"}</span>
                                    </div>
                                )}
                                <div className="min-w-0">
                                    <p className="text-sm font-bold text-white tracking-tight truncate">{token.name || token.symbol} ({token.symbol})</p>
                                    <p className="text-[10px] text-gray-500 font-medium truncate max-w-[120px]">{token.address || token.mint}</p>
                                </div>
                            </div>
                            <div className="text-right flex flex-col items-end shrink-0 min-w-[100px]">
                                <div className="flex items-center gap-1.5">
                                    {token.price && (
                                        <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" title="Preço em tempo real"></div>
                                    )}
                                    <p className="text-sm font-black text-white">{token.totalValue || token.price}</p>
                                </div>
                                <p className="text-[#EAB308] text-[11px] font-black tracking-tight">{token.balance}</p>
                                {token.price && token.price !== "N/A" && (
                                    <p className="text-[9px] text-zinc-500 font-bold uppercase tracking-tighter mt-0.5">
                                        Unit: {token.price}
                                    </p>
                                )}
                            </div>
                        </div>
                    ))}
                    {filteredTokens.length === 0 && !loading && (
                        <div className="p-8 text-center">
                            <span className="material-icons-round text-3xl text-zinc-700 block mb-2">account_balance_wallet</span>
                            <p className="text-zinc-500 text-xs font-bold uppercase tracking-widest">Nenhum saldo detectado</p>
                        </div>
                    )}
                </div>
            </div >
        </>
    );
};

export default TokenDropdown;
