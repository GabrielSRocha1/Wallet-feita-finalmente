"use client";

import React, { useEffect, useState } from "react";
import Image from "next/image";

interface SplashScreenProps {
    onFinish?: () => void;
}

const SplashScreen: React.FC<SplashScreenProps> = ({ onFinish }) => {
    const [isVisible, setIsVisible] = useState(true);

    useEffect(() => {
        const timer = setTimeout(() => {
            setIsVisible(false);
            if (onFinish) onFinish();
        }, 3000); // 3 seconds splash screen

        return () => clearTimeout(timer);
    }, [onFinish]);

    if (!isVisible) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black overflow-hidden h-screen w-full">
            <div className="flex flex-col items-center justify-center space-y-8 select-none">
                <div className="coin-container">
                    <div className="coin-inner">
                        {/* Edge thickness layers */}
                        <div className="coin-layer" style={{ "--z": "5px" } as React.CSSProperties}></div>
                        <div className="coin-layer" style={{ "--z": "4px" } as React.CSSProperties}></div>
                        <div className="coin-layer" style={{ "--z": "3px" } as React.CSSProperties}></div>
                        <div className="coin-layer" style={{ "--z": "2px" } as React.CSSProperties}></div>
                        <div className="coin-layer" style={{ "--z": "1px" } as React.CSSProperties}></div>
                        <div className="coin-layer" style={{ "--z": "0px" } as React.CSSProperties}></div>
                        <div className="coin-layer" style={{ "--z": "-1px" } as React.CSSProperties}></div>
                        <div className="coin-layer" style={{ "--z": "-2px" } as React.CSSProperties}></div>
                        <div className="coin-layer" style={{ "--z": "-3px" } as React.CSSProperties}></div>
                        <div className="coin-layer" style={{ "--z": "-4px" } as React.CSSProperties}></div>
                        <div className="coin-layer" style={{ "--z": "-5px" } as React.CSSProperties}></div>

                        <div className="coin-face coin-front">
                            <Image
                                alt="Verum Gold Coin Front"
                                className="w-full h-full object-contain p-1"
                                src="/icon.png"
                                width={160}
                                height={160}
                                priority
                            />
                        </div>
                        <div className="coin-face coin-back">
                            <Image
                                alt="Verum Gold Coin Back"
                                className="w-full h-full object-contain p-1"
                                src="/icon.png"
                                width={160}
                                height={160}
                                priority
                            />
                        </div>
                    </div>
                </div>
                <div className="flex items-baseline space-x-0.5">
                    <span className="font-display text-4xl font-bold gold-text-gradient leading-none">
                        V
                    </span>
                    <span className="font-display text-2xl font-bold gold-text-gradient leading-none tracking-wide">
                        erum Vesting
                    </span>
                </div>
            </div>
            <div className="fixed top-0 w-full h-12"></div>
            <div className="fixed bottom-0 w-full h-8 flex items-center justify-center">
                <div className="w-32 h-1 bg-white/20 rounded-full"></div>
            </div>
        </div>
    );
};

export default SplashScreen;
