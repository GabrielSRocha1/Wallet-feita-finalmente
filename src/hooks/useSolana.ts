import { useState, useEffect, useCallback } from 'react';
import { connectWalletAdapter, disconnectWalletAdapter, detectWallets } from '@/utils/wallet-adapter';
// import { getUserVestingInfo } from '@/utils/verum-contract'; // Descomente quando a função estiver implementada
import { isAdmin as checkIsAdmin } from '@/utils/rbac';

interface SolanaState {
    connected: boolean;
    publicKey: string | null;
    wallet: any | null;
    loading: boolean;
    error: string | null;
    vestingInfo: any | null;
    isAdmin: boolean;
}

export const useSolana = () => {
    const [state, setState] = useState<SolanaState>({
        connected: false,
        publicKey: null,
        wallet: null,
        loading: false,
        error: null,
        vestingInfo: null,
        isAdmin: false
    });

    const connect = useCallback(async (walletName: string) => {
        setState(prev => ({ ...prev, loading: true, error: null }));

        try {
            const result = await connectWalletAdapter(walletName);

            if (!result || !result.publicKey) {
                throw new Error("Falha ao obter chave pública");
            }

            // Simulação de busca de dados de vesting (substitua pela chamada real)
            // const vestingInfo = await getUserVestingInfo(result.publicKey);
            const vestingInfo = { totalLocked: 0, totalUnlocked: 0, tokens: [] };

            const isAdmin = checkIsAdmin(result.publicKey);

            // Salva sessão
            localStorage.setItem('verum_wallet_session', JSON.stringify({
                walletName,
                publicKey: result.publicKey,
                isAdmin,
                connectedAt: Date.now()
            }));

            // Define cookie para middleware
            document.cookie = `wallet_address=${result.publicKey}; path=/; max-age=86400`;

            setState({
                connected: true,
                publicKey: result.publicKey,
                wallet: result.wallet,
                loading: false,
                error: null,
                vestingInfo,
                isAdmin
            });

            return result;

        } catch (error: any) {
            console.error("Erro ao conectar:", error);
            setState(prev => ({
                ...prev,
                loading: false,
                error: error.message || "Erro desconhecido ao conectar"
            }));
            throw error;
        }
    }, []);

    const disconnect = useCallback(async () => {
        try {
            // 1. Tentar desconectar pelo adapter salvo no estado
            if (state.wallet) {
                await disconnectWalletAdapter(state.wallet);
            }

            // 2. Fallback: Tentar desconectar diretamente via window.solana (Phantom) para garantir
            // Isso ajuda a forçar o estado 'disconnected' na extensão
            if (typeof window !== 'undefined') {
                const w = window as any;
                if (w.solana && w.solana.disconnect) {
                    await w.solana.disconnect();
                }
                if (w.phantom?.solana?.disconnect) {
                    await w.phantom.solana.disconnect();
                }
                if (w.solflare?.disconnect) {
                    await w.solflare.disconnect();
                }
            }
        } catch (e) {
            console.error("Erro ao desconectar adapter:", e);
        }

        // 3. Limpar sessão local
        localStorage.removeItem('verum_wallet_session');
        document.cookie = "wallet_address=; Max-Age=0; path=/";

        setState({
            connected: false,
            publicKey: null,
            wallet: null,
            loading: false,
            error: null,
            vestingInfo: null,
            isAdmin: false
        });
    }, [state.wallet]);

    // Auto-connect ao montar o componente
    useEffect(() => {
        const init = async () => {
            const saved = localStorage.getItem('verum_wallet_session');
            if (saved) {
                try {
                    const { walletName, publicKey } = JSON.parse(saved);

                    // Tenta reconectar silenciosamente se possível
                    // Nota: A maioria das wallets requer interação do usuário para conectar na primeira vez,
                    // mas se já estiver autorizada, pode conectar direto.
                    // Aqui estamos apenas restaurando o estado se a wallet injetada já estiver conectada
                    // ou forçando uma conexão (pode abrir popup)

                    // Para evitar popup indesejado no load, verificamos se já está conectado na extensão
                    // Isso depende da implementação específica de cada adapter.
                    // Como simplificação, chamamos connect() que deve lidar com isso.

                    await connect(walletName);

                } catch (e) {
                    console.warn("Falha ao restaurar sessão:", e);
                    localStorage.removeItem('verum_wallet_session');
                }
            }
        };

        init();
    }, [connect]);

    return {
        ...state,
        connect,
        disconnect,
        availableWallets: detectWallets()
    };
};
