"use client";

import React, { useState } from 'react';
import { Connection, PublicKey } from '@solana/web3.js';
import { observeBlockchainRecord } from '@/utils/validation-observer';
import { useNetwork } from '@/contexts/NetworkContext';

interface ValidationRecord {
    status: string;
    owner: any;
    lamports: number;
    solBalance: string;
    executable: boolean;
    dataSize: number | string;
}

export default function ProofVerification() {
    const { connection, network } = useNetwork();

    // State
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState<ValidationRecord | null>(null);
    const [auditLog, setAuditLog] = useState<string[]>([]);
    const [error, setError] = useState<string | null>(null);

    const logStep = (msg: string) => setAuditLog(prev => [...prev, `[${new Date().toLocaleTimeString()}] ${msg}`]);

    const handleVerify = async () => {
        if (!input) return;
        setLoading(true);
        setError(null);
        setResult(null);
        setAuditLog([]);

        try {
            logStep(`Iniciando auditoria na rede: ${network.toUpperCase()}`);

            // 1. Identify Input Type
            let pubkey: PublicKey;
            try {
                pubkey = new PublicKey(input);
                logStep(`Alvo identificado: ${pubkey.toString()}`);
            } catch (e) {
                throw new Error("Formato de endereço inválido.");
            }

            // 2. Execute Observability Probe
            logStep("Executando sonda de observabilidade (Layer 3 Check)...");

            // Note: observeBlockchainRecord logs to console, but we modified it to return data too
            // Reuse the logic directly comfortably here for UI visualization since the import might be just for console side effects originally
            // But let's try to call it.

            const observation = await observeBlockchainRecord(pubkey.toString());

            if (observation?.record) {
                logStep("Registro on-chain localizado e validado.");
                setResult(observation.record);

                if (observation.record.owner === '11111111111111111111111111111111') {
                    logStep("Classificação: Carteira Nativa (System Program)");
                } else {
                    logStep(`Classificação: Contrato/PDA (Owner: ${observation.record.owner})`);
                }

                logStep("Auditoria concluída com SUCESSO.");
            } else {
                logStep("AVISO: Conta não inicializada ou não encontrada.");
                setError("Conta não encontrada ou sem saldo/histórico.");
            }

        } catch (err: any) {
            console.error(err);
            setError(err.message || "Falha na verificação");
            logStep(`ERRO CRÍTICO: ${err.message}`);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="w-full max-w-4xl mx-auto space-y-8">
            {/* Header Area */}
            <div className="text-center space-y-4">
                <h1 className="text-3xl font-black tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-white to-zinc-500 uppercase">
                    Dashboard de <span className="text-[#EAB308]">Prova</span>
                </h1>
                <p className="text-zinc-500 text-sm max-w-lg mx-auto">
                    Audite registros e valide a integridade de contas e contratos diretamente na blockchain.
                    Esta ferramenta executa uma verificação de 3 camadas em tempo real.
                </p>
            </div>

            {/* Input Section */}
            <div className="bg-zinc-900/50 border border-zinc-800 p-6 rounded-3xl backdrop-blur-sm shadow-xl">
                <div className="flex flex-col md:flex-row gap-4">
                    <div className="flex-1 relative">
                        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                            <span className="material-symbols-outlined text-zinc-500">search</span>
                        </div>
                        <input
                            type="text"
                            placeholder="Cole um endereço de carteira ou contrato (Public Key)"
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            className="w-full bg-black/50 border border-zinc-700 text-white pl-12 pr-4 py-4 rounded-xl focus:ring-2 focus:ring-[#EAB308] focus:border-transparent outline-none transition-all font-mono text-sm placeholder:text-zinc-600"
                        />
                    </div>
                    <button
                        onClick={handleVerify}
                        disabled={loading || !input}
                        className="bg-[#EAB308] hover:bg-[#CA8A04] disabled:opacity-50 disabled:cursor-not-allowed text-black font-bold px-8 py-4 rounded-xl transition-all active:scale-95 flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(234,179,8,0.2)]"
                    >
                        {loading ? (
                            <span className="w-5 h-5 border-2 border-black/30 border-t-black rounded-full animate-spin"></span>
                        ) : (
                            <>
                                <span className="material-symbols-outlined">verified_user</span>
                                <span>AUDITAR</span>
                            </>
                        )}
                    </button>
                </div>
            </div>

            {/* Results Area */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

                {/* Visual Logs (Terminal Style) */}
                <div className="bg-black border border-zinc-800 rounded-3xl p-6 h-[400px] overflow-hidden flex flex-col font-mono text-xs">
                    <div className="flex items-center gap-2 mb-4 border-b border-zinc-800 pb-2">
                        <div className="flex gap-1.5">
                            <div className="w-2.5 h-2.5 rounded-full bg-red-500"></div>
                            <div className="w-2.5 h-2.5 rounded-full bg-yellow-500"></div>
                            <div className="w-2.5 h-2.5 rounded-full bg-green-500"></div>
                        </div>
                        <span className="text-zinc-500 ml-2">Console de Auditoria</span>
                    </div>
                    <div className="flex-1 overflow-y-auto space-y-2 pr-2 custom-scrollbar text-zinc-300">
                        {auditLog.length === 0 && (
                            <div className="h-full flex items-center justify-center text-zinc-700 italic">
                                Aguardando início da auditoria...
                            </div>
                        )}
                        {auditLog.map((log, i) => (
                            <div key={i} className="border-l-2 border-zinc-800 pl-3 py-1 animate-in fade-in slide-in-from-left-2 duration-300">
                                <span className="text-zinc-500 mr-2">{log.substring(0, 10)}</span>
                                <span className={log.includes('ERRO') ? 'text-red-500' : log.includes('SUCESSO') ? 'text-green-500 font-bold' : log.includes('AVISO') ? 'text-yellow-500' : ''}>
                                    {log.substring(11)}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Proof Certificate */}
                <div className="relative group">
                    <div className="absolute -inset-0.5 bg-gradient-to-br from-[#EAB308] to-transparent rounded-3xl blur opacity-20 group-hover:opacity-40 transition duration-1000"></div>
                    <div className="relative bg-zinc-900 border border-zinc-800 rounded-3xl p-8 h-full flex flex-col">
                        <div className="flex items-center justify-between mb-8">
                            <div>
                                <h3 className="text-lg font-bold text-white">Certificado de Prova</h3>
                                <p className="text-xs text-zinc-500 uppercase tracking-widest">Validado via RPC Node</p>
                            </div>
                            <div className={`w-12 h-12 rounded-full flex items-center justify-center ${result ? 'bg-green-500/10 text-green-500' : 'bg-zinc-800 text-zinc-600'}`}>
                                <span className="material-symbols-outlined text-2xl">
                                    {result ? 'verified' : 'hourglass_empty'}
                                </span>
                            </div>
                        </div>

                        {result ? (
                            <div className="space-y-6 flex-1 animate-in zoom-in-95 duration-500">
                                <div className="space-y-1">
                                    <div className="text-zinc-500 text-[10px] uppercase font-bold tracking-wider">Status da Conta</div>
                                    <div className="text-2xl font-mono text-white flex items-center gap-2">
                                        <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
                                        {result.status}
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div className="p-3 bg-black/40 rounded-xl border border-zinc-800/50">
                                        <div className="text-zinc-500 text-[9px] uppercase font-bold mb-1">Saldo (SOL)</div>
                                        <div className="font-mono text-sm text-[#EAB308]">{result.solBalance}</div>
                                    </div>
                                    <div className="p-3 bg-black/40 rounded-xl border border-zinc-800/50">
                                        <div className="text-zinc-500 text-[9px] uppercase font-bold mb-1">Tamanho de Dados</div>
                                        <div className="font-mono text-sm">{result.dataSize} bytes</div>
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <div className="text-zinc-500 text-[10px] uppercase font-bold tracking-wider">Owner (Program ID)</div>
                                    <div className="font-mono text-xs text-zinc-400 break-all bg-black/40 p-3 rounded-xl border border-zinc-800">
                                        {result.owner}
                                    </div>
                                </div>

                                <div className="mt-auto pt-4 border-t border-dashed border-zinc-800 flex justify-between items-center">
                                    <span className="text-[10px] text-zinc-600">Timestamp: {new Date().toISOString()}</span>
                                    <span className="text-[10px] font-bold text-green-500 uppercase tracking-widest flex items-center gap-1">
                                        <span className="material-symbols-outlined text-sm">lock</span>
                                        SECURE
                                    </span>
                                </div>
                            </div>
                        ) : (
                            <div className="flex-1 flex flex-col items-center justify-center text-zinc-600 space-y-4">
                                <span className="material-symbols-outlined text-4xl opacity-20">fingerprint</span>
                                <p className="text-sm text-center max-w-[200px]">
                                    Insira um endereço e execute a auditoria para gerar o certificado.
                                </p>
                            </div>
                        )}
                    </div>
                </div>

            </div>
        </div>
    );
}
