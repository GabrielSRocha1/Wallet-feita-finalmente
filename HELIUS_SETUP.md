# Configuração Helius API (Tempo Real)

Para habilitar o monitoramento em tempo real de tokens via WebSocket e RPC:

1. Obtenha sua API Key gratuita em [dev.helius.xyz](https://dev.helius.xyz/)
2. Crie ou edite o arquivo `.env.local` na raiz do projeto
3. Adicione a seguinte linha com sua chave:

```env
NEXT_PUBLIC_HELIUS_API_KEY=sua-chave-api-aqui-12345
```

## Funcionalidades Habilitadas

- **WebSocket**: Monitoramento de transações em tempo real (`wss://atlas-mainnet.helius-rpc.com`)
- **DAS API**: Busca de todos os tokens e saldos da carteira (`getAssetsByOwner`)
- **Jupiter API**: Preços atualizados em tempo real

## Webhooks (Envio de E-mail e Automação)

Para que o sistema envie e-mails e atualize o dashboard automaticamente quando um contrato é criado ou um token é enviado:

1. Vá para [Helius Webhooks](https://dashboard.helius.dev/webhooks)
2. Clique em **"New Webhook"**
3. **Webhook URL**: `https://seu-dominio.com/api/webhooks/helius`
   - *Nota: Se estiver testando localmente, use uma ferramenta como ngrok para criar um túnel para o seu localhost.*
4. **Transaction Type**: Selecione `Any` ou `Transfer` e `Program Instruction`.
5. **Account Addresses**: Adicione o endereço do seu Programa e a carteira Admin.
6. **Webhook Type**: Selecione `Enhanced` (para receber descrições legíveis).

## Uso no Código

O hook `useTokenMonitor` gerencia a parte visual, enquanto a rota `api/webhooks/helius` gerencia a lógica de backend.
