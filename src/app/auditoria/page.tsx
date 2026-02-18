"use client";

import React from "react";
import Image from "next/image";
import Link from "next/link";
import ProofVerification from "@/components/ProofVerification";
import { useNetwork } from "@/contexts/NetworkContext";

export default function AuditoriaPage() {
    const { network } = useNetwork();

    return (
        <div className="bg-black text-white min-h-screen pb-10">
            {/* Header / Navigation */}
            <header className="bg-black/80 backdrop-blur-md border-b border-zinc-800 px-6 py-4 sticky top-0 z-50">
                <div className="flex items-center justify-between max-w-7xl mx-auto">
                    <Link href="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
                        <div className="w-8 h-8 flex items-center justify-center">
                            <svg className="w-6 h-6 fill-[#EAB308]" viewBox="0 0 100 100">
                                <path d="M20 10 L50 90 L80 10 L65 10 L50 55 L35 10 Z"></path>
                            </svg>
                        </div>
                        <span className="font-bold text-lg tracking-tighter hidden sm:block">VERUM</span>
                    </Link>

                    <nav className="flex items-center gap-6 text-xs font-bold uppercase tracking-wider text-zinc-500">
                        <Link href="/home-cliente" className="hover:text-white transition-colors">App</Link>
                        <span className="text-[#EAB308]">Audit</span>
                        <div className="px-3 py-1 bg-zinc-900 border border-zinc-800 rounded-lg flex items-center gap-2">
                            <div className={`w-2 h-2 rounded-full ${network === 'mainnet' ? 'bg-green-500' : 'bg-yellow-500'} animate-pulse`}></div>
                            <span>{network}</span>
                        </div>
                    </nav>
                </div>
            </header>

            <main className="px-4 py-12 max-w-7xl mx-auto">
                <ProofVerification />

                {/* Additional Info Section */}
                <section className="mt-24 max-w-4xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-8 text-center md:text-left">
                    <div className="space-y-3">
                        <div className="w-10 h-10 bg-[#EAB308]/10 rounded-full flex items-center justify-center mx-auto md:mx-0">
                            <span className="material-symbols-outlined text-[#EAB308]">lock_clock</span>
                        </div>
                        <h3 className="text-sm font-bold text-white uppercase tracking-wider">Imutabilidade</h3>
                        <p className="text-xs text-zinc-500 leading-relaxed">
                            Todos os registros auditados são verificados diretamente no ledger da Solana através de nós RPC isolados.
                        </p>
                    </div>

                    <div className="space-y-3">
                        <div className="w-10 h-10 bg-[#EAB308]/10 rounded-full flex items-center justify-center mx-auto md:mx-0">
                            <span className="material-symbols-outlined text-[#EAB308]">deployed_code</span>
                        </div>
                        <h3 className="text-sm font-bold text-white uppercase tracking-wider">Proof of Reserves</h3>
                        <p className="text-xs text-zinc-500 leading-relaxed">
                            Valide saldos e propriedade de contas em tempo real com precisão de 9 casas decimais (Lamports).
                        </p>
                    </div>

                    <div className="space-y-3">
                        <div className="w-10 h-10 bg-[#EAB308]/10 rounded-full flex items-center justify-center mx-auto md:mx-0">
                            <span className="material-symbols-outlined text-[#EAB308]">security</span>
                        </div>
                        <h3 className="text-sm font-bold text-white uppercase tracking-wider">3-Layer Security</h3>
                        <p className="text-xs text-zinc-500 leading-relaxed">
                            O sistema valida submissão, confirmação de bloco e estado final antes de emitir o certificado.
                        </p>
                    </div>
                </section>
            </main>
        </div>
    );
}
