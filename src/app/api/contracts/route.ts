import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';

// Configuração do cliente Supabase
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY || '';

const supabase = createClient(supabaseUrl, supabaseKey);

// Ler contratos
export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const wallet = searchParams.get('wallet');

        let query = supabase.from('contracts').select('*');

        if (wallet) {
            // Verifica o "sender_address" ou o "recipient_address" (requer colunas criadas)
            query = query.or(`sender_address.eq.${wallet},recipient_address.eq.${wallet}`);
        }

        // Traz os dados ordenados do mais recente para o mais antigo (requer coluna created_at)
        const { data, error } = await query.order('created_at', { ascending: false });

        if (error) {
            console.error('Erro no Supabase GET:', error);
            throw error;
        }

        // Reconstrói o formato original mapeando a coluna "data" (onde salvamos o JSON original inteiro)
        const contracts = data ? data.map(row => row.data) : [];

        return NextResponse.json({ success: true, contracts });
    } catch (error: any) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}

// Salvar um novo contrato
export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { newContracts } = body;

        if (!newContracts || !Array.isArray(newContracts)) {
            return NextResponse.json(
                { success: false, error: 'Parâmetro newContracts inválido' },
                { status: 400 }
            );
        }

        // Prepara os dados para o Supabase
        const rowsToInsert = newContracts.map(c => ({
            id: c.id,
            sender_address: c.senderAddress || '',
            recipient_address: c.recipients?.[0]?.walletAddress || c.recipientAddress || '',
            data: c
        }));

        // Upsert no Supabase insere novos ou atualiza caso o id já exista na tabela de contratos
        const { error } = await supabase
            .from('contracts')
            .upsert(rowsToInsert, { onConflict: 'id' });

        if (error) {
            console.error('Erro no Supabase Upsert:', error);
            throw error;
        }

        return NextResponse.json({ success: true, count: newContracts.length });
    } catch (error: any) {
        console.error('Erro ao salvar contratos:', error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
