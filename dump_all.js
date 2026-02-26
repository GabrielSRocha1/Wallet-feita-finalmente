const { Connection, PublicKey } = require('@solana/web3.js');
const conn = new Connection('https://api.mainnet-beta.solana.com');
const fs = require('fs');
async function find() {
    const a = await conn.getProgramAccounts(new PublicKey('DE9UHAY6UhxYfMTGBwzCoDRHphV6Xrcee8z1L8xJqydy'));
    let out = "";
    for (const x of a) {
        out += `ID: ${x.pubkey.toBase58()}\n`;
        out += `HEX: ${x.account.data.toString('hex')}\n\n`;
    }
    fs.writeFileSync('hex_dump.txt', out);
}
find();
