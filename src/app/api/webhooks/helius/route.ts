
import { NextRequest, NextResponse } from 'next/server';

/**
 * Helius Webhook Receiver
 * Esta rota recebe notificações em tempo real da rede Solana via Helius.
 */
export async function POST(req: NextRequest) {
    try {
        // Validação de Segurança: Verifica se a requisição veio realmente da Helius
        const authHeader = req.headers.get('authorization');
        const webhookSecret = process.env.HELIUS_WEBHOOK_SECRET;

        if (webhookSecret && authHeader !== webhookSecret) {
            console.error('[Helius Webhook] Tentativa de acesso não autorizada');
            return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
        }

        const body = await req.json();

        // Helius envia um array de transações
        if (!Array.isArray(body)) {
            return NextResponse.json({ message: 'Invalid body' }, { status: 400 });
        }

        for (const tx of body) {
            console.log(`[Helius Webhook] Nova transação detectada: ${tx.signature}`);

            // 1. Identificar o tipo de transação
            // No caso de criação de Vesting ou transferência de tokens
            const type = tx.type; // ex: "TRANSFER", "UNKNOWN" (se for instrução customizada)
            const description = tx.description || "";

            // 2. Lógica para Envio de E-mail
            // Se a descrição contiver informações sobre o beneficiário ou se identificarmos a conta
            // Podemos disparar o serviço de e-mail existente
            if (tx.tokenTransfers && tx.tokenTransfers.length > 0) {
                for (const transfer of tx.tokenTransfers) {
                    const toUser = transfer.toUser;
                    const amount = transfer.tokenAmount;

                    console.log(`[Helius Webhook] Transferência de ${amount} tokens para ${toUser}`);

                    // Trigger e-mail (Exemplo simplificado)
                    // Aqui você buscaria no seu banco de dados o e-mail associado à carteira `toUser`
                    // await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/send-email`, {
                    //     method: 'POST',
                    //     body: JSON.stringify({ recipientEmail: '...", contractData: { ... } })
                    // });
                }
            }

            // 3. Atualização de Portfólio
            // Como a aplicação usa o hook `useTokenMonitor`, ela já refina os dados ao recarregar.
            // O Webhook serve para avisar o backend que algo mudou, podendo atualizar o Dashboard em tempo real via Socket.io ou mudando status no DB.
        }

        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error('Helius Webhook Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
