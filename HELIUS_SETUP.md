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

## Uso no Código

O hook `useTokenMonitor` gerencia tudo automaticamente:

```typescript
import { useTokenMonitor } from '@/hooks/useTokenMonitor';

const { tokens, loading } = useTokenMonitor(walletAddress);
```
