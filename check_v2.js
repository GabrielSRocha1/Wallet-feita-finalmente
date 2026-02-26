const { Connection, PublicKey } = require('@solana/web3.js');
const conn = new Connection('https://api.mainnet-beta.solana.com');

async function check() {
    const addresses = [
        '7WP8nGL5Vs8vRS3P8NsJRfgsvHbsrg7Hxxu',
        'gxLRHQGgpzrk2x3ku7JSBpsp4oJ11f6jLpjY',
        'DJYRkvP1mXUat91K72Uu2Lq8uhtxs4hC9AAbP8unp3Yj'
    ];
    for (const addr of addresses) {
        const info = await conn.getAccountInfo(new PublicKey(addr));
        if (info) {
            console.log(`ADDR: ${addr}`);
            console.log(`Len: ${info.data.length}`);
            console.log(`Revoke(161): ${info.data[161]}`);
            console.log(`Revoke(162): ${info.data[162]}`);
            console.log(`T2022(162): ${info.data[162]}`);
            console.log(`T2022(163): ${info.data[163]}`);
        } else {
            console.log(`NOT FOUND: ${addr}`);
        }
    }
}
check();
