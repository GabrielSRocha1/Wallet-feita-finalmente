"use client";

import React from "react";
import { useWallet, isWalletInstalled } from "@/contexts/WalletContext";

interface ConnectWalletModalProps {
    isOpen: boolean;
    onClose: () => void;
}

const ConnectWalletModal: React.FC<ConnectWalletModalProps> = ({ isOpen, onClose }) => {
    const { connectWallet, loading: connecting, error, clearError } = useWallet();
    const [selectedWallet, setSelectedWallet] = React.useState<{ name: string; url: string; id: string } | null>(null);
    const [isMobile, setIsMobile] = React.useState(false);

    React.useEffect(() => {
        setIsMobile(/iPhone|iPad|iPod|Android/i.test(navigator.userAgent));
    }, []);

    // Wallet options configuration
    const WALLET_OPTIONS = [
        {
            id: 'verum' as const,
            name: 'Verum',
            url: '#',
            icon: (
                <div className="w-8 h-8 flex items-center justify-center bg-black rounded-lg shadow-sm">
                    <span className="text-[#D4AF37] font-black text-xl italic">V</span>
                </div>
            )
        },
        {
            id: 'phantom' as const,
            name: 'Phantom',
            url: 'https://phantom.app/',
            icon: (
                <div className="w-8 h-8 flex items-center justify-center bg-[#AB9FF2] rounded-lg shadow-sm">
                    <span className="material-icons-round text-white text-xl">ghost</span>
                </div>
            )
        },
        {
            id: 'solflare' as const,
            name: 'Solflare',
            url: 'https://solflare.com/',
            icon: (
                <div className="w-8 h-8 flex items-center justify-center bg-[#F8DF1D] rounded-lg shadow-sm overflow-hidden">
                    <span className="font-black text-black text-xl italic leading-none">S</span>
                </div>
            )
        },
        {
            id: 'okx' as const,
            name: 'OKX',
            url: 'https://www.okx.com/web3',
            icon: (
                <div className="w-8 h-8 flex items-center justify-center bg-white rounded-lg overflow-hidden p-1">
                    <div className="grid grid-cols-3 gap-0.5 w-full h-full">
                        <div className="bg-black"></div><div className="bg-[#00FF42]"></div><div className="bg-black"></div>
                        <div className="bg-[#00FF42]"></div><div className="bg-black"></div><div className="bg-[#00FF42]"></div>
                        <div className="bg-black"></div><div className="bg-[#00FF42]"></div><div className="bg-black"></div>
                    </div>
                </div>
            )
        }
    ];

    const [wallets, setWallets] = React.useState(WALLET_OPTIONS.map(w => ({ ...w, isInstalled: false })));

    React.useEffect(() => {
        if (typeof window === 'undefined') return;

        const checkWallets = () => {
            const updatedWallets = WALLET_OPTIONS.map(wallet => ({
                ...wallet,
                isInstalled: isWalletInstalled(wallet.id)
            }));
            setWallets(updatedWallets);
        };

        checkWallets();

        // Recheck after a delay (some wallets inject later)
        const timer = setTimeout(checkWallets, 500);
        window.addEventListener('load', checkWallets);

        return () => {
            clearTimeout(timer);
            window.removeEventListener('load', checkWallets);
        };
    }, []);

    if (!isOpen) return null;

    const handleWalletClick = async (wallet: typeof wallets[0]) => {
        if (wallet.isInstalled) {
            clearError();
            setSelectedWallet(null);

            try {
                await connectWallet(wallet.id);
                onClose();

                // Pequeno delay para garantir que o estado foi atualizado
                setTimeout(() => {
                    window.location.reload();
                }, 100);
            } catch (err) {
                // Erro já tratado no contexto
                console.error('Erro ao conectar:', err);
            }
        } else if (isMobile) {
            // No mobile, se não estiver instalada (não detectada no browser atual),
            // tentamos abrir via Deep Link para o browser interno da wallet
            const currentUrl = encodeURIComponent(window.location.href);
            const ref = encodeURIComponent(window.location.origin);

            let deepLink = '';
            if (wallet.id === 'phantom') {
                deepLink = `https://phantom.app/ul/browse/${currentUrl}?ref=${ref}`;
            } else if (wallet.id === 'solflare') {
                deepLink = `https://solflare.com/ul/v1/browse/${currentUrl}?ref=${ref}`;
            } else if (wallet.id === 'okx') {
                deepLink = `okx://wallet/dapp/details?dappUrl=${currentUrl}`;
            }

            if (deepLink) {
                window.location.href = deepLink;
            } else {
                setSelectedWallet({ name: wallet.name, url: wallet.url, id: wallet.id });
            }
        } else {
            setSelectedWallet({ name: wallet.name, url: wallet.url, id: wallet.id });
        }
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
            <div
                className="w-full max-w-[360px] bg-[#121212] rounded-[20px] shadow-[0_0_30px_rgba(0,0,0,0.5)] overflow-hidden border border-white/5 animate-in zoom-in-95 duration-300"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex items-center justify-between p-5 sm:p-6 pb-4">
                    <h2 className="text-lg sm:text-xl font-bold text-white">Conectar Wallet</h2>
                    <button
                        onClick={onClose}
                        className="text-gray-500 hover:text-white transition-colors p-1"
                        disabled={connecting}
                    >
                        <span className="material-icons-round text-2xl">close</span>
                    </button>
                </div>

                <div className="px-5 sm:px-6 pb-6 space-y-4 sm:space-y-6">
                    {/* Error Alert */}
                    {error && (
                        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 relative animate-in slide-in-from-top-2 duration-200">
                            <div className="flex items-start gap-3">
                                <span className="material-icons-round text-red-500 mt-0.5 text-xl">error</span>
                                <div className="flex-1 pr-6">
                                    <p className="text-sm font-semibold text-red-500 leading-tight">
                                        {error}
                                    </p>
                                </div>
                                <button
                                    className="absolute top-4 right-4 text-red-500/50 hover:text-red-500"
                                    onClick={clearError}
                                >
                                    <span className="material-icons-round text-lg">cancel</span>
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Not Installed Alert */}
                    {selectedWallet && (
                        <div className="bg-[#2A2A2A] rounded-xl p-4 relative border border-white/5 animate-in slide-in-from-top-2 duration-200">
                            <div className="flex items-start gap-3">
                                <span className="material-icons-round text-white/90 mt-0.5 text-xl">info</span>
                                <div className="flex-1 pr-6">
                                    <p className="text-sm font-semibold text-white leading-tight">
                                        {isMobile
                                            ? `Abra o app da ${selectedWallet.name} para conectar sua carteira.`
                                            : `A carteira "${selectedWallet.name}" não está instalada. Instale a extensão para continuar.`
                                        }
                                    </p>
                                    <a
                                        href={selectedWallet.url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="mt-3 inline-block text-[#D4AF37] font-bold text-sm tracking-wide uppercase hover:underline"
                                    >
                                        {isMobile ? 'Ir para App Store' : 'Instalar Extensão'}
                                    </a>
                                </div>
                                <button
                                    className="absolute top-4 right-4 text-gray-500 hover:text-white"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setSelectedWallet(null);
                                    }}
                                >
                                    <span className="material-icons-round text-lg">cancel</span>
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Wallet Buttons */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {wallets.map((wallet) => (
                            <button
                                key={wallet.id}
                                onClick={() => handleWalletClick(wallet)}
                                disabled={connecting}
                                className={`flex items-center gap-3 bg-[#2A2A2A] p-3 sm:p-4 rounded-xl hover:bg-white/10 transition-all border ${selectedWallet?.id === wallet.id ? 'border-[#D4AF37]/50 bg-white/5' : 'border-white/5'
                                    } ${connecting ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer active:scale-95'} ${!wallet.isInstalled && !isMobile ? 'opacity-60' : ''
                                    }`}
                            >
                                <div className="shrink-0 scale-90 sm:scale-100">
                                    {wallet.icon}
                                </div>
                                <div className="flex flex-col items-start overflow-hidden">
                                    <span className="font-bold text-white text-sm sm:text-base truncate w-full">{wallet.name}</span>
                                    {!wallet.isInstalled && (
                                        <span className="text-[10px] text-zinc-500 uppercase tracking-wider">
                                            {isMobile ? 'Abrir no App' : 'Não instalada'}
                                        </span>
                                    )}
                                </div>
                            </button>
                        ))}
                    </div>

                    {/* Connecting State */}
                    {connecting && (
                        <div className="flex items-center justify-center gap-2 text-[#D4AF37] animate-pulse">
                            <span className="material-icons-round animate-spin">sync</span>
                            <span className="text-sm font-bold">Conectando...</span>
                        </div>
                    )}

                    {/* Terms */}
                    <p className="text-[11px] leading-relaxed text-center text-gray-400 px-2">
                        Ao conectar sua carteira, você confirma que leu e concorda com os
                        <span className="font-bold text-white ml-1">Termos e Condições</span>
                        <span className="mx-1">e a</span>
                        <span className="font-bold text-white">Política de Privacidade</span>
                        <span className="ml-1">da Verum Vesting.</span>
                    </p>
                </div>
            </div>
        </div>
    );
};

export default ConnectWalletModal;
