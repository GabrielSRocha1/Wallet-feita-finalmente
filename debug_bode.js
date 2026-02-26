const { Connection, PublicKey } = require('@solana/web3.js');

const PROGRAM_ID = "DE9UHAY6UhxYfMTGBwzCoDRHphV6Xrcee8z1L8xJqydy";
const BDC_MINT = "AeAQdgjGqtHErysb56M8vstq7XnJmKq9F2y8qV2Upump";

async function find() {
    const conn = new Connection("https://api.mainnet-beta.solana.com");
    const accounts = await conn.getProgramAccounts(new PublicKey(PROGRAM_ID));
    for (const acc of accounts) {
        const data = acc.account.data;
        if (data.length >= 144) {
            const mint = new PublicKey(data.slice(80, 112));
            if (mint.toBase58() === BDC_MINT) {
                const start = data.readBigInt64LE(128);
                const end = data.readBigInt64LE(136);
                console.log(`CONTRACT: ${acc.pubkey.toBase58()}`);
                console.log(`START: ${start}`);
                console.log(`END: ${end}`);
                console.log(`DURATION: ${end - start}`);
            }
        }
    }
}

find();
