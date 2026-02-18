# Prompt Técnico - Validação de Registro On-Chain (3 Camadas)

Este documento descreve a implementação do sistema de validação de transações em 3 camadas, garantindo integridade total dos dados registrados na blockchain.

## Objetivo
Garantir que cada transação crítica gere uma prova imutável e verificada, mitigando riscos de "falsos positivos" (transações que parecem ter sucesso mas falham silenciosamente ou sofrem rollback).

## As 3 Camadas de Validação

Implementadas na função `executeTransactionWith3LayerValidation` em `src/utils/verum-contract.ts`:

### 1. Submissão (Submission)
- **Ação**: Assinatura e envio da transação ao mempool.
- **Validação**: Verifica se a assinatura foi gerada corretamente e se o nó aceitou a transação.
- **Log**: `🔒 Layer 1: Transaction Submission`

### 2. Confirmação (Confirmation)
- **Ação**: Polling ativo de status da transação na rede.
- **Estratégia**: Uso de `confirmTransaction` com commitment configurável (padrão: `confirmed`).
- **Validação**: Garante que a transação foi incluída em um bloco válido e não sofreu drop.
- **Log**: `⏳ Layer 2: Network Confirmation`

### 3. Verificação de Estado (State Verification)
- **Ação**: Leitura pós-confirmação do estado da conta afetada.
- **Lógica**: Executa uma função validadora (`validatorFn`) personalizada sobre os dados retornados.
- **Resiliência**: Utiliza *Exponential Backoff* (retentativas com delay crescente) para lidar com latência de propagação nos nós RPC.
- **Erro**: Se após 5 tentativas o estado não for confirmado, lança erro de Timeout de Validação, alertando sobre possível inconsistência.
- **Log**: `🔎 Layer 3: State Verification (Proof)`

## Como Utilizar

Exemplo de uso no frontend (`confirmar/page.tsx` ou hooks):

```typescript
import { executeTransactionWith3LayerValidation } from '@/utils/verum-contract';

const result = await executeTransactionWith3LayerValidation(
    connection,
    wallet,
    transaction,
    {
        targetAccount: recipientPublicKey,
        validatorFn: (accountInfo) => {
            // Exemplo: Verifica se a conta foi inicializada (não é nula)
            return accountInfo !== null && accountInfo.owner.equals(PROGRAM_ID);
        }
    }
);

if (result.success && result.verified) {
    console.log("Transação 100% segura e validada!");
}
```

## Arquivos Modificados
- `src/utils/verum-contract.ts`: Adição da lógica principal de validação e imports necessários.
