"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function VerificarPage() {
    const router = useRouter();

    const handleSimulateConnection = () => {
        // Set a dummy wallet address in cookie for simulation
        document.cookie = "wallet_address=0x742d35Cc6634C0532925a3b844Bc454e4438f44e; path=/; max-age=3600";
        router.push('/home-cliente');
    };

    return (
        <div className="bg-black min-h-screen flex flex-col items-center justify-center p-6 text-center">
            <h1 className="text-[#EAB308] text-2xl font-bold mb-4 uppercase tracking-tighter">Conectar Carteira</h1>
            <p className="text-zinc-500 text-sm mb-8 max-w-xs">Esta é uma página de simulação para conexão de carteira.</p>
            <button
                onClick={handleSimulateConnection}
                className="bg-[#EAB308] text-black font-bold py-3 px-8 rounded-xl active:scale-95 transition-all shadow-lg cursor-pointer"
            >
                Simular Conexão
            </button>
        </div>
    );
}
