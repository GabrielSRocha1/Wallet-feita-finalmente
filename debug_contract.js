const { Connection, PublicKey } = require('@solana/web3.js');

const PROGRAM_ID = "DE9UHAY6UhxYfMTGBwzCoDRHphV6Xrcee8z1L8xJqydy";
const MINT_BDC = "AeAQdgjGqtHErysb56M8vstq7XnJmKq9F2y8qV2Upump";

async function find() {
    const conn = new Connection("https://api.mainnet-beta.solana.com");
    const accounts = await conn.getProgramAccounts(new PublicKey(PROGRAM_ID), {
        filters: [
            {
                memcmp: {
                    offset: 8 + 8 + 32 + 32, // disc (8) + id (8) + owner (32) + ben (32) = 80
                    bytes: MINT_BDC
                }
            }
        ]
    });
    console.log(`Found ${accounts.length} contracts for BDC`);
    for (const acc of accounts) {
        console.log(`Address: ${acc.pubkey.toBase58()}`);
        const data = acc.account.data;
        // Layout: disc(8) id(8) owner(32) ben(32) mint(32) total(8) claimed(8) start(8) end(8)
        const id = data.readBigUInt64LE(8);
        const owner = new PublicKey(data.slice(16, 48));
        const beneficiary = new PublicKey(data.slice(48, 80));
        const mint = new PublicKey(data.slice(80, 112));
        const amount = data.readBigUInt64LE(112);
        const claimed = data.readBigUInt64LE(120);
        const start = data.readBigInt64LE(128);
        const end = data.readBigInt64LE(136);

        console.log(`ID: ${id.toString()}`);
        console.log(`Owner: ${owner.toBase58()}`);
        console.log(`Beneficiary: ${beneficiary.toBase58()}`);
        console.log(`Amount: ${amount.toString()}`);
        console.log(`Claimed: ${claimed.toString()}`);
        console.log(`Start: ${start.toString()}`);
        console.log(`End: ${end.toString()}`);
        console.log(`Start Date: ${new Date(Number(start) * 1000).toISOString()}`);
        console.log(`End Date: ${new Date(Number(end) * 1000).toISOString()}`);
    }
}

find();
