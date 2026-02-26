const { Connection, PublicKey } = require('@solana/web3.js');
const fs = require('fs');

const PROGRAM_ID = "DE9UHAY6UhxYfMTGBwzCoDRHphV6Xrcee8z1L8xJqydy";

async function dump() {
    const conn = new Connection("https://api.mainnet-beta.solana.com");
    const accounts = await conn.getProgramAccounts(new PublicKey(PROGRAM_ID));
    let out = "";
    for (const acc of accounts) {
        out += `ACC: ${acc.pubkey.toBase58()}\n`;
        out += `DATA: ${acc.account.data.toString('hex')}\n\n`;
    }
    fs.writeFileSync('raw_dump.txt', out);
}
dump();
