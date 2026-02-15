"use client";

import React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function SuccessPage() {
    const router = useRouter();

    const handleCreateNew = () => {
        localStorage.removeItem("contract_draft");
        localStorage.removeItem("recipients_draft");
        router.push("/configuracao");
    };

    return (
        <div className="flex items-center justify-center min-h-screen bg-black px-4">
            <div className="w-full max-w-[400px] bg-[#333333] rounded-[32px] overflow-hidden shadow-2xl animate-in zoom-in-95 duration-500 border border-white/5">
                <div className="pt-12 pb-10 px-8 flex flex-col items-center text-center">
                    <div className="w-16 h-16 bg-[#444444] rounded-[24px] flex items-center justify-center mb-6 shadow-glow border border-white/10">
                        <span className="material-symbols-outlined text-[#22C55E] text-[36px] font-bold">lock</span>
                    </div>
                    <h2 className="text-white text-2xl font-bold mb-3 tracking-tight">
                        Token bloqueado
                    </h2>
                    <p className="text-white text-opacity-90 text-[16px] font-medium leading-tight px-4 opacity-80">
                        Você bloqueou seus tokens com sucesso
                    </p>
                </div>

                <div className="bg-[#2B2B2B] p-6 flex gap-4 border-t border-white/5">
                    <button
                        onClick={handleCreateNew}
                        className="flex-1 bg-[#FDE68A] text-[#1A1A1A] font-extrabold py-4 rounded-xl text-[14px] hover:opacity-90 transition-all active:scale-95 text-center shadow-lg cursor-pointer"
                    >
                        Criar novo
                    </button>
                    <Link
                        href="/contrato-detalhes"
                        className="flex-1 bg-[#8B5E34] text-white font-bold py-4 rounded-xl text-[14px] hover:opacity-90 transition-all active:scale-95 text-center shadow-lg border border-white/5 cursor-pointer"
                    >
                        Acesse os Detalhes
                    </Link>
                </div>
            </div>
        </div>
    );
}
