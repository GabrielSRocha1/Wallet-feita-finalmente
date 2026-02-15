import { createSolanaClient, devnet, mainnet } from 'gill';

// Configuração da rede
// Você pode definir isso no arquivo .env.local como NEXT_PUBLIC_SOLANA_NETWORK=mainnet
const NETWORK = process.env.NEXT_PUBLIC_SOLANA_NETWORK || 'devnet';

const rpcUrl = NETWORK === 'mainnet'
    ? 'https://api.mainnet-beta.solana.com'
    : 'https://api.devnet.solana.com';

// Cliente Solana (RPC + Subscriptions + Helper functions)
export const client = createSolanaClient({ urlOrMoniker: rpcUrl });
export const rpc = client.rpc;
export const sendAndConfirmTransaction = client.sendAndConfirmTransaction;

// Endereço do programa Verum Vesting (substitua pelo endereço real quando tiver)
export const VERUM_PROGRAM_ID = 'SeuProgramIdAqui111111111111111111111111111';

// Exporta configurações
export { devnet, mainnet, NETWORK };
