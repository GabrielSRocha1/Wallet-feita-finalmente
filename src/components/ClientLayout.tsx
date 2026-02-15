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

    return (
        <WalletProvider>
            <div className="bg-zinc-950 min-h-screen">
                {showSplash && <SplashScreen onFinish={() => setShowSplash(false)} />}
                <div className={`${showSplash ? "hidden" : "block"} max-w-screen-md mx-auto bg-black min-h-screen relative shadow-2xl`}>
                    {children}
                </div>
            </div>
        </WalletProvider>
    );
}
