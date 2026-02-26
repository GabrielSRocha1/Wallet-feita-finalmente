const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://aqpiiqstgdboqyhpgper.supabase.co';
const supabaseKey = 'sb_publishable_f_uBC1UlIrT9hMhq1cHthQ_1v7pS6Jz';

const supabase = createClient(supabaseUrl, supabaseKey);

async function test() {
    const { data, error } = await supabase.from('contracts').select('*').limit(3);
    if (error) {
        console.error("Error:", error);
    } else {
        console.log("Returned rows:", data.length);
        if (data.length > 0) {
            console.log("Sample Data Network:", data[0].data?.network);
            console.log("Sample ID:", data[0].id);
            console.log("Sample sender:", data[0].sender_address);
            console.log("Sample recipient:", data[0].recipient_address);
        }
    }
}
test();
