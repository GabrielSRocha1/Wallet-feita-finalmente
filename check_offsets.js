const { Connection, PublicKey } = require('@solana/web3.js');
const conn = new Connection('https://api.mainnet-beta.solana.com');

async function dump() {
    const a = await conn.getProgramAccounts(new PublicKey('DE9UHAY6UhxYfMTGBwzCoDRHphV6Xrcee8z1L8xJqydy'));
    for (const x of a) {
        const buf = x.account.data;
        console.log("=====");
        console.log("ID:", x.pubkey.toBase58());
        console.log("Len:", buf.length);
        console.log("Hex:", buf.toString("hex"));
        // Check common offsets for is_cancelled
        for (let i = 155; i <= 170; i++) {
            console.log(`  Offset [${i}]: ${buf[i]}`);
        }
    }
}
dump();
