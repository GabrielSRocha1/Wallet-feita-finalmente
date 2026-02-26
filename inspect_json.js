const { Connection, PublicKey } = require('@solana/web3.js');
const conn = new Connection('https://api.mainnet-beta.solana.com');
const fs = require('fs');

async function dump() {
    const accounts = await conn.getProgramAccounts(new PublicKey('DE9UHAY6UhxYfMTGBwzCoDRHphV6Xrcee8z1L8xJqydy'));

    const results = [];
    for (const x of accounts) {
        const buf = x.account.data;
        if (buf.length < 164) {
            results.push({ id: x.pubkey.toBase58(), error: 'too short', len: buf.length });
            continue;
        }

        const vestingTypeTag = buf[144];
        const startTime = Number(buf.readBigInt64LE(120));
        const endTime = Number(buf.readBigInt64LE(128));
        const contractId = Number(buf.readBigUInt64LE(136));

        // Check ALL potential cancel offsets
        results.push({
            id: x.pubkey.toBase58(),
            len: buf.length,
            vestingTypeTag,
            contractId,
            startTime: new Date(startTime * 1000).toISOString(),
            endTime: new Date(endTime * 1000).toISOString(),
            b160: buf[160],
            b161: buf[161],
            b162: buf[162],
            b163: buf[163],
        });
    }

    fs.writeFileSync('results.json', JSON.stringify(results, null, 2));
    console.log('Done! See results.json');
}
dump().catch(e => fs.writeFileSync('results.json', JSON.stringify({ error: e.message })));
