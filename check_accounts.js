const { Connection, PublicKey } = require('@solana/web3.js');

const MAINNET_PROGRAM_ID = "DE9UHAY6UhxYfMTGBwzCoDRHphV6Xrcee8z1L8xJqydy";

async function check() {
    const mainnetConn = new Connection("https://api.mainnet-beta.solana.com");

    try {
        const mainnetAccs = await mainnetConn.getProgramAccounts(new PublicKey(MAINNET_PROGRAM_ID));
        for (const acc of mainnetAccs) {
            const data = acc.account.data;
            const c = new PublicKey(data.subarray(8, 40)).toBase58();
            const b = new PublicKey(data.subarray(40, 72)).toBase58();
            console.log(`B:${b}`);
        }
    } catch (e) {
        console.log(`Error: ${e.message}`);
    }
}

check();
