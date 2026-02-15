"use client";

import React, { useState, useEffect } from "react";
import SplashScreen from "./SplashScreen";
import { WalletProvider } from "@/contexts/WalletContext";

export default function ClientLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const [showSplash, setShowSplash] = useState(true);

    useEffect(() => {
        // Garantia de segurança: Forçar saída do splash após 3.5s caso o callback falhe
        const timer = setTimeout(() => {
            setShowSplash(false);
        }, 3500);
        return () => clearTimeout(timer);
    }, []);

    return (
        <WalletProvider>
            <div className="bg-zinc-950 min-h-screen selection:bg-[#EAB308]/30">
                {showSplash && <SplashScreen onFinish={() => setShowSplash(false)} />}

                {/* Só renderiza o conteúdo principal quando o splash terminar para evitar saltos de layout */}
                {!showSplash && (
                    <div className="max-w-screen-md mx-auto bg-black min-h-screen relative shadow-2xl animate-in fade-in duration-700">
                        {children}
                    </div>
                )}
            </div>
        </WalletProvider>
    );
}
