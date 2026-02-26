const { Connection, PublicKey } = require('@solana/web3.js');
const fs = require('fs');

const PROGRAM_ID = "DE9UHAY6UhxYfMTGBwzCoDRHphV6Xrcee8z1L8xJqydy";

async function find() {
    const conn = new Connection("https://api.mainnet-beta.solana.com");
    const accounts = await conn.getProgramAccounts(new PublicKey(PROGRAM_ID));
    let s = "";
    for (const acc of accounts) {
        const data = acc.account.data;
        if (data.length >= 144) {
            const owner = new PublicKey(data.slice(16, 48));
            const beneficiary = new PublicKey(data.slice(48, 80));
            const mint = new PublicKey(data.slice(80, 112));
            const start = data.readBigInt64LE(128);
            const end = data.readBigInt64LE(136);

            s += `${acc.pubkey.toBase58()} | ${mint.toBase58().substring(0, 4)}... | Start: ${start} | End: ${end} | Diff: ${end - start}\n`;
        }
    }
    fs.writeFileSync('times.txt', s);
}

find();
