"use client";

import React, { useState } from "react";

interface AddressVerificationModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: () => void;
    address?: string;
}

const AddressVerificationModal: React.FC<AddressVerificationModalProps> = ({
    isOpen,
    onClose,
    onConfirm,
    address = "Da51JLCnUfn3L3RDNeYkn7kxr"
}) => {
    const [agreedTerms, setAgreedTerms] = useState(false);
    const [usingLedger, setUsingLedger] = useState(false);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
            <div
                className="w-full max-w-[400px] bg-[#333333] rounded-[24px] overflow-hidden shadow-2xl animate-in zoom-in-95 duration-300 border border-white/5"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header with gold gradient */}
                <div className="relative h-[180px] flex flex-col items-center justify-center px-6 bg-gradient-to-br from-[#7b5b27] via-[#e2c07d] to-[#7b5b27]">
                    <button
                        onClick={onClose}
                        className="absolute top-4 right-4 text-white/80 hover:text-white transition-colors cursor-pointer"
                    >
                        <span className="material-symbols-outlined text-2xl">cancel</span>
                    </button>

                    <div className="bg-black/40 backdrop-blur-sm rounded-full py-2.5 px-4 flex items-center space-x-3 border border-white/10">
                        <div className="flex items-center">
                            <span className="material-symbols-outlined text-white text-[20px] scale-x-[-1]">edit_note</span>
                        </div>
                        <span className="text-white text-[13px] font-medium tracking-tight overflow-hidden text-ellipsis whitespace-nowrap max-w-[200px]">
                            {address}
                        </span>
                    </div>
                </div>

                {/* Content Body */}
                <div className="p-6 space-y-5">
                    <div className="space-y-2">
                        <h2 className="text-white text-lg font-bold">
                            Verifique seu endereço
                        </h2>
                        <p className="text-gray-300 text-[14px] leading-relaxed">
                            Para prosseguir, precisamos da sua assinatura — pense nisso como um aperto de mãos digital que confirma sua identidade. Esse aperto de mãos serve exclusivamente para autenticação.
                        </p>
                    </div>

                    <div className="space-y-4">
                        <label className="flex items-start space-x-3 cursor-pointer group">
                            <div className="mt-0.5">
                                <input
                                    checked={agreedTerms}
                                    onChange={(e) => setAgreedTerms(e.target.checked)}
                                    className="h-4 w-4 rounded border-gray-500 bg-transparent text-[#D4AF37] focus:ring-[#D4AF37] focus:ring-offset-0 transition-all cursor-pointer"
                                    type="checkbox"
                                />
                            </div>
                            <span className="text-[13px] text-gray-300 leading-tight">
                                Aceito os <a className="text-[#D4AF37] hover:underline" href="#">Termos de uso</a> e a <a className="text-[#D4AF37] hover:underline" href="#">Política de Privacidade</a> e confirmo que não sou residente nem estou localizado em nenhum <a className="text-[#D4AF37] hover:underline" href="#">país ou região com restrições</a>.
                            </span>
                        </label>

                        <label className="flex items-center space-x-3 cursor-pointer group">
                            <div>
                                <input
                                    checked={usingLedger}
                                    onChange={(e) => setUsingLedger(e.target.checked)}
                                    className="h-4 w-4 rounded border-gray-500 bg-transparent text-[#D4AF37] focus:ring-[#D4AF37] focus:ring-offset-0 transition-all cursor-pointer"
                                    type="checkbox"
                                />
                            </div>
                            <div className="flex items-center space-x-1.5 relative">
                                <span className="text-[13px] text-gray-300">
                                    Estou usando Ledger ou SquadsX
                                </span>
                                <div className="relative group flex items-center">
                                    <span className="material-symbols-outlined text-[16px] text-gray-400 cursor-pointer hover:text-white transition-colors">info</span>
                                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 p-2 bg-[#2C2C2E] border border-white/10 text-zinc-200 text-[10px] rounded-lg shadow-xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50 text-center font-medium leading-snug">
                                        Marque esta opção se estiver utilizando uma carteira de hardware (Ledger) ou uma conta multisig (SquadsX) para assinar a transação.
                                        <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-[#2C2C2E]"></div>
                                    </div>
                                </div>
                            </div>
                        </label>
                    </div>

                    {/* Footer Actions */}
                    <div className="flex space-x-3 pt-2">
                        <button
                            onClick={onClose}
                            className="flex-1 py-3 px-4 bg-[#F9E6B3] text-black font-extrabold rounded-xl transition-all active:scale-95 hover:opacity-90 cursor-pointer"
                        >
                            Cancelar
                        </button>
                        <button
                            disabled={!agreedTerms}
                            onClick={() => agreedTerms && onConfirm()}
                            className={`flex-1 py-3 px-4 font-extrabold rounded-xl transition-all active:scale-95 shadow-lg
                ${agreedTerms
                                    ? 'bg-gradient-to-r from-[#8B612E] to-[#5C401D] text-white hover:brightness-110 cursor-pointer'
                                    : 'bg-[#5C401D] text-gray-400 cursor-not-allowed opacity-80'
                                }`}
                        >
                            Continue
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AddressVerificationModal;
