import { Connection, PublicKey } from '@solana/web3.js';
import { getProgramId, getRpcUrl } from './solana-config';
import { formatVestingDate } from './date-utils';

/**
 * Interface que representa o contrato conforme esperado pelo front-end
 */
export interface ContractData {
    id: string;
    senderAddress: string;
    recipientAddress?: string;
    recipients: Array<{
        walletAddress: string;
        amount: string;
        contractTitle: string;
    }>;
    totalAmount: number;
    claimedAmount: number;
    vestingStartDate: string;
    vestingEndDate: string;
    vestingDuration: number; // em segundos
    status: string;
    revoked: boolean;
    selectedSchedule?: string;
    cliffAmount?: string;
    network: 'mainnet' | 'devnet';
    selectedToken?: {
        mint: string;
        symbol: string;
        decimals: number;
        name?: string;
        icon?: string;
        isToken2022?: boolean;
    };
    onChain: boolean;
}

/**
 * Converte timestamp BigInt para String ISO
 */
const formatDate = (timestamp: bigint | number) => {
    return formatVestingDate(new Date(Number(timestamp) * 1000));
};

/**
 * Faz o parse da conta VestingContract baseada no binário do Anchor
 */
export const parseVestingAccount = (pubkey: PublicKey, buffer: Buffer, network: 'mainnet' | 'devnet'): ContractData => {
    // Offset 0-8: Discriminator
    // Offset 8-40: Creator (32 bytes)
    const creator = new PublicKey(buffer.subarray(8, 40)).toBase58();

    // Offset 40-72: Beneficiary (32 bytes)
    const beneficiary = new PublicKey(buffer.subarray(40, 72)).toBase58();

    // Offset 72-104: Mint (32 bytes)
    const mint = new PublicKey(buffer.subarray(72, 104)).toBase58();

    // Offset 104-112: total_amount (u64)
    const totalAmount = buffer.readBigUInt64LE(104);

    // Offset 112-120: released_amount (u64)
    const releasedAmount = buffer.readBigUInt64LE(112);

    // Offset 120-128: start_time (i64)
    const startTime = buffer.readBigInt64LE(120);

    // Offset 128-136: end_time (i64)
    const endTime = buffer.readBigInt64LE(128);

    // Offset 136-144: contract_id (u64)
    const contractId = buffer.readBigUInt64LE(136);

    // Offset 144-161: VestingType (Enum - 17 bytes)
    const vestingTypeTag = buffer[144];
    let selectedSchedule = "Linear";
    let cliffAmount = "0";

    if (vestingTypeTag === 1) { // Cliff
        selectedSchedule = "Cliff";
        const percentage = buffer.readUInt16LE(145);
        cliffAmount = (percentage / 100).toString();
    }

    // Offset 162: is_cancelled (bool)
    const isCancelled = buffer[162] === 1;

    // Offset 163: is_token_2022 (bool)
    const isToken2022 = buffer[163] === 1;

    const duration = Number(endTime - startTime);

    return {
        id: pubkey.toBase58(),
        senderAddress: creator,
        recipients: [{
            walletAddress: beneficiary,
            amount: totalAmount.toString(),
            contractTitle: `Vesting #${contractId.toString()}`
        }],
        totalAmount: Number(totalAmount),
        claimedAmount: Number(releasedAmount),
        vestingStartDate: formatDate(startTime),
        vestingEndDate: formatDate(endTime),
        vestingDuration: duration,
        status: isCancelled ? 'cancelado' : 'em-andamento',
        revoked: isCancelled,
        selectedSchedule,
        cliffAmount,
        network,
        selectedToken: {
            mint: mint,
            symbol: 'UNK',
            decimals: 9, // Default temporário
            isToken2022
        },
        onChain: true
    };
};

/**
 * Busca metadados básicos (decimais e símbolo) para uma lista de mints
 */
async function resolveTokenMetadata(connection: Connection, mints: string[]): Promise<Map<string, { decimals: number, symbol: string, name?: string, icon?: string }>> {
    const metadataMap = new Map<string, { decimals: number, symbol: string, name?: string, icon?: string }>();
    if (mints.length === 0) return metadataMap;

    const uniqueMints = Array.from(new Set(mints));
    const heliusKey = process.env.NEXT_PUBLIC_HELIUS_API_KEY;

    // 1. Tentar via Helius (Metadata Completa: Símbolo, Nome, Decimais, Ícone)
    if (heliusKey && heliusKey !== '') {
        try {
            console.log(`[Scanner] Resolvendo metadados de ${uniqueMints.length} tokens via Helius...`);
            const response = await fetch(`https://mainnet.helius-rpc.com/?api-key=${heliusKey}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    jsonrpc: '2.0',
                    id: 'token-metadata',
                    method: 'getAssetBatch',
                    params: { ids: uniqueMints }
                })
            });
            const data = await response.json();

            if (data.result && Array.isArray(data.result)) {
                data.result.forEach((asset: any) => {
                    if (asset && asset.id) {
                        metadataMap.set(asset.id, {
                            decimals: asset.token_info?.decimals ?? 9,
                            symbol: asset.token_info?.symbol ?? asset.content?.metadata?.symbol ?? 'TKN',
                            name: asset.content?.metadata?.name ?? 'Unknown Token',
                            icon: asset.content?.links?.image ?? asset.content?.files?.[0]?.uri
                        });
                    }
                });
            }
        } catch (e) {
            console.warn("[Scanner] Erro na resolução via Helius:", e);
        }
    }

    // 2. Fallback via RPC para os que faltarem (Garante decimais corretos para as quantidades)
    const missingMints = uniqueMints.filter(m => !metadataMap.has(m));
    if (missingMints.length > 0) {
        try {
            console.log(`[Scanner] Fallback RPC para ${missingMints.length} tokens...`);
            const accountInfos = await connection.getMultipleAccountsInfo(missingMints.map(m => new PublicKey(m)));

            accountInfos.forEach((info, index) => {
                const mintAddr = missingMints[index];
                if (info) {
                    const decimals = info.data[44]; // SPL Token Layout: offset 44
                    metadataMap.set(mintAddr, { decimals, symbol: 'TKN' });
                }
            });
        } catch (e) {
            console.error("[Scanner] Erro no fallback RPC:", e);
        }
    }

    return metadataMap;
}

/**
 * Escaneia a blockchain em busca de contratos do usuário (ou todos se for admin)
 */
export const scanBlockchainContracts = async (walletAddress: string, network: 'mainnet' | 'devnet', isAdmin: boolean = false): Promise<ContractData[]> => {
    try {
        const rpcUrl = getRpcUrl(network);
        const connection = new Connection(rpcUrl, 'confirmed');
        const programId = new PublicKey(getProgramId(network));
        const userPubkey = new PublicKey(walletAddress);

        console.log(`[Scanner] Buscando contratos para ${walletAddress} em ${network}...`);

        let allAccounts: any[] = [];

        if (isAdmin) {
            console.log(`[Scanner] Admin detectado. Buscando TODOS os contratos do programa...`);
            const accounts = await connection.getProgramAccounts(programId);
            allAccounts = [...accounts];
        } else {
            const [creatorAccounts, beneficiaryAccounts] = await Promise.all([
                connection.getProgramAccounts(programId, {
                    filters: [{ memcmp: { offset: 8, bytes: userPubkey.toBase58() } }]
                }),
                connection.getProgramAccounts(programId, {
                    filters: [{ memcmp: { offset: 40, bytes: userPubkey.toBase58() } }]
                }),
            ]);
            allAccounts = [...creatorAccounts, ...beneficiaryAccounts];
        }

        const uniqueAccountsMap = new Map();
        allAccounts.forEach(acc => uniqueAccountsMap.set(acc.pubkey.toBase58(), acc));

        // 1. Parse inicial
        const rawContracts = Array.from(uniqueAccountsMap.values()).map(acc =>
            parseVestingAccount(acc.pubkey, acc.account.data as Buffer, network)
        );

        // 2. Resolver metadados dos tokens
        const mintsToResolve = rawContracts.map(c => c.selectedToken?.mint || "").filter(m => m !== "");
        const tokenMetadata = await resolveTokenMetadata(connection, mintsToResolve);

        // 3. Aplicar decimais e corrigir valores (O QUE RESOLVE O BUG DE BILHÕES)
        const finalContracts = rawContracts.map(contract => {
            const mint = contract.selectedToken?.mint || "";
            const metadata = tokenMetadata.get(mint);

            if (metadata) {
                const decimals = metadata.decimals;
                const divisor = Math.pow(10, decimals);

                contract.totalAmount = contract.totalAmount / divisor;
                contract.claimedAmount = contract.claimedAmount / divisor;

                if (contract.selectedToken) {
                    contract.selectedToken.decimals = decimals;
                    contract.selectedToken.symbol = metadata.symbol;
                    contract.selectedToken.name = metadata.name;
                    contract.selectedToken.icon = metadata.icon;
                }

                if (contract.recipients[0]) {
                    contract.recipients[0].amount = contract.totalAmount.toString();
                }
            }
            return contract;
        });

        console.log(`[Scanner] Encontrados ${finalContracts.length} contratos on-chain com metadados resolvidos.`);
        return finalContracts;

    } catch (error) {
        console.error('[Scanner] Erro ao escanear blockchain:', error);
        return [];
    }
};

/**
 * Busca um único contrato pelo ID (PublicKey) e resolve seus metadados.
 */
export const fetchContractById = async (contractId: string, network: 'mainnet' | 'devnet'): Promise<ContractData | null> => {
    try {
        const rpcUrl = getRpcUrl(network);
        const connection = new Connection(rpcUrl, 'confirmed');
        const pubkey = new PublicKey(contractId);

        const accountInfo = await connection.getAccountInfo(pubkey);
        if (!accountInfo) return null;

        const rawContract = parseVestingAccount(pubkey, accountInfo.data as Buffer, network);

        // Resolve metadata for the single token
        const mint = rawContract.selectedToken?.mint || "";
        const metadataMap = await resolveTokenMetadata(connection, [mint]);
        const metadata = metadataMap.get(mint);

        if (metadata) {
            const divisor = Math.pow(10, metadata.decimals);
            rawContract.totalAmount = rawContract.totalAmount / divisor;
            rawContract.claimedAmount = rawContract.claimedAmount / divisor;

            if (rawContract.selectedToken) {
                rawContract.selectedToken.decimals = metadata.decimals;
                rawContract.selectedToken.symbol = metadata.symbol;
                rawContract.selectedToken.name = metadata.name;
                rawContract.selectedToken.icon = metadata.icon;
            }
            if (rawContract.recipients[0]) {
                rawContract.recipients[0].amount = rawContract.totalAmount.toString();
            }
        }

        return rawContract;
    } catch (error) {
        console.error('[Scanner] Erro ao buscar contrato individual:', error);
        return null;
    }
};
