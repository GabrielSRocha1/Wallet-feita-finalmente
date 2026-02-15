import { useTokenMonitor } from '@/hooks/useTokenMonitor';
import { useWallet } from '@/contexts/WalletContext';

export default function TokenDashboard() {
    const { publicKey } = useWallet();
    const { tokens, loading, error, refresh } = useTokenMonitor(publicKey);

    return (
        <div className="bg-zinc-900 rounded-xl border border-zinc-800 p-6 shadow-lg">
            <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                    <span className="material-icons-round text-[#EAB308]">token</span>
                    Meus Tokens (Tempo Real)
                </h2>
                <button
                    onClick={refresh}
                    disabled={loading}
                    className="text-zinc-400 hover:text-white transition-colors"
                >
                    <span className={`material-icons-round ${loading ? 'animate-spin' : ''}`}>sync</span>
                </button>
            </div>

            {error && (
                <div className="bg-red-500/10 border border-red-500/20 text-red-500 px-4 py-3 rounded-lg mb-4 text-sm font-medium">
                    {error}
                </div>
            )}

            {!publicKey ? (
                <div className="text-center py-8 text-zinc-500">
                    Conecte sua carteira para ver seus tokens.
                </div>
            ) : loading && tokens.length === 0 ? (
                <div className="flex justify-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#EAB308]"></div>
                </div>
            ) : tokens.length === 0 ? (
                <div className="text-center py-8 text-zinc-500">
                    Nenhum token encontrado nesta carteira.
                </div>
            ) : (
                <div className="space-y-3">
                    {tokens.map((token) => (
                        <div
                            key={token.mint}
                            className="flex items-center justify-between p-3 bg-black/40 rounded-lg hover:bg-black/60 transition-colors border border-white/5"
                        >
                            <div className="flex items-center gap-3">
                                {token.image ? (
                                    <img src={token.image} alt={token.symbol} className="w-8 h-8 rounded-full" />
                                ) : (
                                    <div className="w-8 h-8 rounded-full bg-zinc-800 flex items-center justify-center text-xs font-bold text-zinc-400">
                                        {token.symbol?.slice(0, 2)}
                                    </div>
                                )}
                                <div>
                                    <div className="font-bold text-white">{token.symbol}</div>
                                    <div className="text-xs text-zinc-500 font-mono truncate max-w-[100px]">
                                        {token.mint.slice(0, 4)}...{token.mint.slice(-4)}
                                    </div>
                                </div>
                            </div>

                            <div className="text-right">
                                <div className="font-mono text-white font-medium">
                                    {(token.amount / Math.pow(10, token.decimals)).toLocaleString(undefined, { maximumFractionDigits: 4 })}
                                </div>
                                {token.price && (
                                    <div className="text-xs text-[#EAB308] font-medium">
                                        ${token.price.toFixed(2)} USD
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}

            <div className="mt-4 pt-4 border-t border-white/5 text-xs text-zinc-600 text-center">
                Powered by Helius WebSocket & Jupiter API
            </div>
        </div>
    );
}
