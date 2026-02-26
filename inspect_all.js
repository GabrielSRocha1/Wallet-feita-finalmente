const { Connection, PublicKey } = require('@solana/web3.js');
const conn = new Connection('https://api.mainnet-beta.solana.com');

async function dump() {
    const accounts = await conn.getProgramAccounts(new PublicKey('DE9UHAY6UhxYfMTGBwzCoDRHphV6Xrcee8z1L8xJqydy'));
    console.log("Total accounts:", accounts.length);

    for (const x of accounts) {
        const buf = x.account.data;
        const hexStr = buf.toString("hex");
        console.log("=====");
        console.log("ID:", x.pubkey.toBase58());
        console.log("Buffer length:", buf.length);

        if (buf.length < 164) {
            console.log("Buffer too short!");
            console.log("All bytes:", Array.from(buf).join(","));
            continue;
        }

        // VestingType tag at 144
        const vestingTypeTag = buf[144];
        console.log("VestingType tag [144]:", vestingTypeTag);

        // If Linear (tag=0): 17 bytes -> offset 145..161 unused
        // If Cliff (tag=1): 17 bytes -> offset 145..161 used
        // -> is_cancelled @ 162, is_token2022 @ 163
        console.log("Offset [161]:", buf[161]);
        console.log("Offset [162]:", buf[162], "<-- is_cancelled?");
        console.log("Offset [163]:", buf[163], "<-- is_token2022?");

        const startTime = buf.readBigInt64LE(120);
        const endTime = buf.readBigInt64LE(128);
        console.log("startTime:", Number(startTime), "->", new Date(Number(startTime) * 1000).toISOString());
        console.log("endTime:", Number(endTime), "->", new Date(Number(endTime) * 1000).toISOString());
    }
}
dump().catch(console.error);
