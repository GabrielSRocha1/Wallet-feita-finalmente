import { createSolanaClient, devnet, mainnet } from 'gill';

// Configuração da rede
// Hierarchy: Environment Variable > Default 'devnet'
export const DEFAULT_NETWORK = (process.env.NEXT_PUBLIC_SOLANA_NETWORK || 'devnet') as 'mainnet' | 'devnet';

export const RPC_ENDPOINTS = {
    mainnet: 'https://api.mainnet-beta.solana.com',
    devnet: 'https://api.devnet.solana.com'
};

// Program IDs (Isolamento de Rede)
// Garante que o ID correto seja usado para cada rede
export const PROGRAM_IDS = {
    mainnet: 'SeuProgramIdMainnetAqui111111111111111111111',
    devnet: 'SeuProgramIdDevnetAqui111111111111111111111'
};

export const getRpcUrl = (network: 'mainnet' | 'devnet') => {
    const heliusKey = process.env.NEXT_PUBLIC_HELIUS_API_KEY;
    if (heliusKey) {
        return `https://${network === 'mainnet' ? 'mainnet' : 'devnet'}.helius-rpc.com/?api-key=${heliusKey}`;
    }
    return RPC_ENDPOINTS[network];
};

export const getProgramId = (network: 'mainnet' | 'devnet') => {
    return PROGRAM_IDS[network];
};

// Cliente Estático (Fallback/Server-side) e Helpers
// CUIDADO: O uso direto deste cliente ignora o contexto de rede selecionado pelo usuário na UI.
// Prefira usar o hook useNetwork() para obter o cliente correto.
export const staticClient = createSolanaClient({ urlOrMoniker: getRpcUrl(DEFAULT_NETWORK) });
export const rpc = staticClient.rpc;
export const sendAndConfirmTransaction = staticClient.sendAndConfirmTransaction;

// PREVENÇÃO DE ERROS COMUNS
// Valida se transações críticas estão sendo feitas na rede correta
export const validateNetworkContext = (currentNetwork: string, expectedNetwork: string) => {
    if (currentNetwork !== expectedNetwork) {
        throw new Error(`CRITICAL NETWORK MISMATCH: Attempting operation on ${currentNetwork} but expected ${expectedNetwork}. Transaction aborted.`);
    }
};

export { devnet, mainnet };
