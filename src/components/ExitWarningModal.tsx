"use client";

import React from "react";

interface ExitWarningModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: () => void;
}

const ExitWarningModal: React.FC<ExitWarningModalProps> = ({
    isOpen,
    onClose,
    onConfirm,
}) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-300">
            <div
                className="w-full max-w-[340px] bg-[#2C2C2E] rounded-[24px] p-8 shadow-2xl animate-in zoom-in-95 duration-300 border border-white/5 text-center"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="mb-6">
                    <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
                        <span className="material-icons-outlined text-red-500 text-3xl">warning_amber</span>
                    </div>
                    <p className="text-white text-lg font-medium leading-relaxed">
                        As informações não ficarão salvas se fechar a tela ou voltar a home.
                    </p>
                </div>

                <div className="flex flex-col gap-3">
                    <button
                        onClick={onConfirm}
                        className="w-full bg-[#EE4444] hover:bg-[#CC3333] text-white font-bold py-4 rounded-2xl transition-all active:scale-95 shadow-lg"
                    >
                        Fechar
                    </button>
                    <button
                        onClick={onClose}
                        className="w-full bg-white/5 hover:bg-white/10 text-white font-bold py-4 rounded-2xl transition-all active:scale-95 border border-white/10"
                    >
                        Continuar
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ExitWarningModal;
