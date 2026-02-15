"use client";

import React from "react";

interface CancelContractModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: () => void;
}

export default function CancelContractModal({ isOpen, onClose, onConfirm }: CancelContractModalProps) {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center px-4">
            <div
                className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                onClick={onClose}
            ></div>
            <div className="relative w-full max-w-[400px] bg-[#1A1A1A] rounded-[32px] border border-red-500/20 shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
                <div className="p-8 text-center">
                    <div className="w-16 h-16 bg-red-500/10 rounded-2xl flex items-center justify-center mb-6 mx-auto border border-red-500/20">
                        <span className="material-symbols-outlined text-red-500 text-3xl">warning</span>
                    </div>

                    <h2 className="text-xl font-bold text-white mb-2">Cancelar Contrato?</h2>
                    <p className="text-zinc-400 text-sm leading-relaxed px-2">
                        Esta ação é <span className="text-red-500 font-bold uppercase underline">irreversível</span>. Ao cancelar, o fluxo de vesting será interrompido permanentemente.
                    </p>

                    <div className="mt-8 flex flex-col gap-3">
                        <button
                            onClick={onConfirm}
                            className="w-full bg-red-500 hover:bg-red-600 text-white font-bold py-4 rounded-xl text-sm transition-all active:scale-95 cursor-pointer shadow-lg shadow-red-500/20"
                        >
                            Confirmar Cancelamento
                        </button>
                        <button
                            onClick={onClose}
                            className="w-full bg-zinc-800 text-zinc-400 font-bold py-4 rounded-xl text-sm hover:bg-zinc-700 hover:text-white transition-all active:scale-95 cursor-pointer"
                        >
                            Manter Contrato
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
