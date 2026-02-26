const { Connection, PublicKey } = require('@solana/web3.js');

const PROGRAM_ID = "DE9UHAY6UhxYfMTGBwzCoDRHphV6Xrcee8z1L8xJqydy";

async function find() {
    const conn = new Connection("https://api.mainnet-beta.solana.com");
    const accounts = await conn.getProgramAccounts(new PublicKey(PROGRAM_ID));
    console.log(`Found ${accounts.length} accounts`);
    for (const acc of accounts) {
        console.log(`--- ACCOUNT: ${acc.pubkey.toBase58()} ---`);
        console.log(`Data (Hex): ${acc.account.data.toString('hex')}`);
    }
}

find();
