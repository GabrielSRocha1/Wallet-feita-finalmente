"use client";

import React, { useState, useRef, useEffect } from "react";
import { useNetwork } from "@/contexts/NetworkContext";
import { useWallet } from "@/contexts/WalletContext";

export default function NetworkSelector() {
    const { network, setNetwork } = useNetwork();
    const { isAdmin } = useWallet();
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    // Se não for admin, não renderiza o seletor (ou renderiza apenas como label desabilitado)
    if (!isAdmin) return null;

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        if (isOpen) {
            document.addEventListener("mousedown", handleClickOutside);
        } else {
            document.removeEventListener("mousedown", handleClickOutside);
        }
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [isOpen]);

    const networks = [
        { id: "mainnet" as const, name: "Mainnet", color: "#22C55E" },
        { id: "devnet" as const, name: "Devnet", color: "#EAB308" }
    ];

    const currentNetwork = networks.find(n => n.id === network);

    return (
        <div className="relative" ref={dropdownRef}>
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="flex items-center gap-2 bg-zinc-900/50 border border-white/10 px-3 py-1.5 rounded-xl hover:bg-zinc-800 transition-all cursor-pointer"
            >
                <div
                    className="w-1.5 h-1.5 rounded-full animate-pulse"
                    style={{ backgroundColor: currentNetwork?.color }}
                ></div>
                <span className="text-[10px] font-bold text-zinc-300 uppercase tracking-widest">
                    {currentNetwork?.name}
                </span>
                <span className="material-icons-round text-sm text-zinc-500">expand_more</span>
            </button>

            {isOpen && (
                <div className="absolute top-full right-0 mt-2 w-32 bg-zinc-900 border border-white/10 rounded-xl shadow-2xl overflow-hidden z-[110] animate-in fade-in zoom-in-95 duration-200">
                    {networks.map((n) => (
                        <button
                            key={n.id}
                            onClick={() => {
                                setNetwork(n.id);
                                setIsOpen(false);
                            }}
                            className={`w-full px-4 py-2.5 text-left text-[10px] font-bold uppercase tracking-widest flex items-center gap-2 transition-colors ${network === n.id ? 'bg-white/10 text-white' : 'text-zinc-500 hover:bg-white/5 hover:text-zinc-300'
                                }`}
                        >
                            <div
                                className="w-1.5 h-1.5 rounded-full"
                                style={{ backgroundColor: n.color }}
                            ></div>
                            {n.name}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}
