const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://aqpiiqstgdboqyhpgper.supabase.co';
const supabaseKey = 'sb_publishable_f_uBC1UlIrT9hMhq1cHthQ_1v7pS6Jz';

const supabase = createClient(supabaseUrl, supabaseKey);

async function test() {
    const newContracts = [{
        id: "test-id-123",
        senderAddress: "A123",
        recipientAddress: "B123",
        network: "devnet"
    }];

    const rowsToInsert = newContracts.map(c => ({
        id: c.id,
        sender_address: c.senderAddress || '',
        recipient_address: c.recipients?.[0]?.walletAddress || c.recipientAddress || '',
        data: c
    }));
    console.log("Upserting:", rowsToInsert);

    const { error, data } = await supabase
        .from('contracts')
        .upsert(rowsToInsert, { onConflict: 'id' });

    if (error) {
        console.error("Error saving:", error);
    } else {
        console.log("Success:", data);
    }
}
test();
