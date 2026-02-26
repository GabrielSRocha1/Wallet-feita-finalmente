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
    // tag (byte 144), cliff_percentage (u16 at 145), cliff_time (i64 at 147)
    const vestingTypeTag = buffer[144];
    let selectedSchedule = "Linear";
    let cliffAmount = "0";
    let cliffTime = 0;

    if (vestingTypeTag === 1) { // Cliff
        selectedSchedule = "Cliff";
        const percentage = buffer.readUInt16LE(145);
        cliffAmount = (percentage / 100).toString(); // percentage is in basis points or direct? usually direct if u16 handles 0-10000
        // No IDL em lib.rs o cliff_percentage é u16. Se for 10% = 1000? 
        // Vamos assumir que é porcentagem direta 0-100 para simplificar se o código original usava string "10"
        cliffTime = Number(buffer.readBigInt64LE(147));
    }

    // Offset 161: bump (u8)
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
            decimals: 9,
            isToken2022
        },
        onChain: true
    };
};

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
            // Filtro para Creator (offset 8)
            const creatorFilter = {
                memcmp: {
                    offset: 8,
                    bytes: userPubkey.toBase58(),
                },
            };

            // Filtro para Beneficiary (offset 40)
            const beneficiaryFilter = {
                memcmp: {
                    offset: 40,
                    bytes: userPubkey.toBase58(),
                },
            };

            const [creatorAccounts, beneficiaryAccounts] = await Promise.all([
                connection.getProgramAccounts(programId, { filters: [creatorFilter] }),
                connection.getProgramAccounts(programId, { filters: [beneficiaryFilter] }),
            ]);

            allAccounts = [...creatorAccounts, ...beneficiaryAccounts];
        }

        // Remover duplicatas por pubkey
        const uniqueAccountsMap = new Map();
        allAccounts.forEach(acc => {
            uniqueAccountsMap.set(acc.pubkey.toBase58(), acc);
        });

        const contracts = Array.from(uniqueAccountsMap.values()).map(acc =>
            parseVestingAccount(acc.pubkey, acc.account.data as Buffer, network)
        );

        console.log(`[Scanner] Encontrados ${contracts.length} contratos on-chain.`);
        return contracts;

    } catch (error) {
        console.error('[Scanner] Erro ao escanear blockchain:', error);
        return [];
    }
};
