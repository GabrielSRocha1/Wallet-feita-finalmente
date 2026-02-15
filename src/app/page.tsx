"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function RootPage() {
    const router = useRouter();

    useEffect(() => {
        // Redirecionamento instantâneo via client-side como fallback garantido
        router.replace("/home-cliente");
    }, [router]);

    return (
        <div className="bg-black min-h-screen flex items-center justify-center">
            <div className="flex flex-col items-center gap-4">
                <div className="w-8 h-8 border-4 border-[#EAB308]/20 border-t-[#EAB308] rounded-full animate-spin"></div>
                <p className="text-zinc-500 text-xs font-bold uppercase tracking-widest">Iniciando...</p>
            </div>
        </div>
    );
}
