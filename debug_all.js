const { Connection, PublicKey } = require('@solana/web3.js');
const fs = require('fs');

const PROGRAM_ID = "DE9UHAY6UhxYfMTGBwzCoDRHphV6Xrcee8z1L8xJqydy";

async function find() {
    const conn = new Connection("https://api.mainnet-beta.solana.com");
    const accounts = await conn.getProgramAccounts(new PublicKey(PROGRAM_ID));
    let output = "";
    for (const acc of accounts) {
        output += `\n--- ${acc.pubkey.toBase58()} ---\n`;
        const data = acc.account.data;
        output += `Hex: ${data.toString('hex')}\n`;
        if (data.length >= 144) {
            const id = data.readBigUInt64LE(8);
            const owner = new PublicKey(data.slice(16, 48));
            const beneficiary = new PublicKey(data.slice(48, 80));
            const mint = new PublicKey(data.slice(80, 112));
            const amount = data.readBigUInt64LE(112);
            const claimed = data.readBigUInt64LE(120);
            const start = data.readBigInt64LE(128);
            const end = data.readBigInt64LE(136);
            output += `ID: ${id}\nOwner: ${owner}\nBeneficiary: ${beneficiary}\nMint: ${mint}\nAmount: ${amount}\nClaimed: ${claimed}\nStart: ${start}\nEnd: ${end}\n`;
        }
    }
    fs.writeFileSync('accounts_dump.txt', output);
}

find();
