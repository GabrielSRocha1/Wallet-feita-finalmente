import { rpc } from './solana-config';

/**
 * Technical Prompt - Blockchain Record Validation (READ-ONLY)
 * Utility to validate and observe blockchain records without mutation.
 */
export const observeBlockchainRecord = async (publicKey: string) => {
    // Unique ID for this observation session
    const observationId = `obs_${Date.now()}`;

    console.group(`🔍 Blockchain Validation Probe [${observationId}]`);
    console.log(`Timestamp: ${new Date().toISOString()}`);
    console.log(`Target Public Key: ${publicKey}`);

    try {
        // 1. Account Existence and Basic Metadata Probing
        console.log('📡 Probing account state...');

        // Using safe read-only RPC call
        // @ts-ignore - Gill typing might vary
        const response = await rpc.getAccountInfo(publicKey).send();

        const safeResponse = response as any;
        let accountInfo = safeResponse?.value;
        if (!accountInfo && safeResponse && typeof safeResponse === 'object' && 'lamports' in safeResponse) {
            accountInfo = safeResponse;
        }

        if (accountInfo) {
            console.log('✅ [SUCCESS] Account Found on Ledger');

            const record = {
                status: 'Active',
                owner: accountInfo.owner,
                lamports: accountInfo.lamports,
                solBalance: (Number(accountInfo.lamports) / 1_000_000_000).toFixed(9),
                executable: accountInfo.executable,
                dataSize: Array.isArray(accountInfo.data) ? accountInfo.data.length : 'Unknown'
            };

            // Log details as structured observability data
            console.table(record);

            // 2. Data Integrity Observation (Content Type Check)
            if (accountInfo.owner === '11111111111111111111111111111111') {
                console.log('ℹ️ Account Type: System Account (Native Wallet)');
            } else {
                console.log(`ℹ️ Account Type: Program Owned Account (Owner: ${accountInfo.owner})`);
            }

            return { success: true, record };

        } else {
            console.warn('⚠️ [NOTICE] Account not initialized on-chain (0 balance/history)');
            return { success: false, error: 'Account not initialized' };
        }

    } catch (error: any) {
        console.error('❌ [FAILURE] Observability Probe Failed', error);
        console.log('Context: Network connection or RPC endpoint might be unreachable.');
        return { success: false, error: error.message };
    } finally {
        console.log('🏁 Validation Probe Completed');
        console.groupEnd();
    }
};
