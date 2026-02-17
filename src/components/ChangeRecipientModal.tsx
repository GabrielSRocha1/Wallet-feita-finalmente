"use client";

import React, { useState } from "react";

interface ChangeRecipientModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: (newAddress: string) => void;
    currentAddress: string;
}

export default function ChangeRecipientModal({ isOpen, onClose, onConfirm, currentAddress }: ChangeRecipientModalProps) {
    const [newAddress, setNewAddress] = useState("");

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center px-4">
            <div
                className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                onClick={onClose}
            ></div>
            <div className="relative w-full max-w-[400px] bg-[#1A1A1A] rounded-[32px] border border-white/10 shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
                <div className="p-8">
                    <div className="flex justify-between items-start mb-6">
                        <div>
                            <h2 className="text-xl font-bold text-white mb-2">Alterar Destinatário</h2>
                            <p className="text-zinc-400 text-xs">Insira o novo endereço da carteira para este contrato.</p>
                        </div>
                        <button
                            onClick={onClose}
                            className="text-zinc-500 hover:text-white transition-colors cursor-pointer"
                        >
                            <span className="material-symbols-outlined">close</span>
                        </button>
                    </div>

                    <div className="space-y-4">
                        <div>
                            <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1.5 block">
                                Endereço Atual
                            </label>
                            <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl px-4 py-3 text-zinc-500 text-xs font-mono break-all opacity-60">
                                {currentAddress}
                            </div>
                        </div>

                        <div>
                            <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1.5 block">
                                Novo Endereço
                            </label>
                            <input
                                type="text"
                                name="newWalletAddress"
                                autoComplete="off"
                                value={newAddress}
                                onChange={(e) => setNewAddress(e.target.value)}
                                placeholder="Insira o novo endereço da carteira..."
                                className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 text-white text-xs font-mono placeholder:text-zinc-600 focus:outline-none focus:border-[#EAB308]/50 transition-colors"
                            />
                        </div>
                    </div>

                    <div className="mt-8 flex gap-3">
                        <button
                            onClick={onClose}
                            className="flex-1 bg-zinc-800 text-white font-bold py-3 rounded-xl text-xs hover:bg-zinc-700 transition-all active:scale-95 cursor-pointer"
                        >
                            Cancelar
                        </button>
                        <button
                            onClick={() => {
                                if (newAddress.trim()) {
                                    onConfirm(newAddress.trim());
                                    setNewAddress("");
                                }
                            }}
                            className="flex-1 bg-[#EAB308] text-black font-bold py-3 rounded-xl text-xs hover:opacity-90 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                            disabled={!newAddress.trim()}
                        >
                            Confirmar Alteração
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
