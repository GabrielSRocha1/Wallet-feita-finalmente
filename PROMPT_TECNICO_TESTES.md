
# 4. TESTES AUTOMATIZADOS: Cobertura de Regressão

Este documento descreve as suítes de teste de regressão implantadas para validar o fluxo de ponta a ponta do sistema de vesting, cobrindo desde o isolamento de rede até a confirmação de recebimento final.

## 1. Suíte de Testes Implementada (`src/utils/tests/vesting-flow.test.ts`)

O arquivo de teste recém-criado valida 5 pilares críticos:

### A. Isolamento de Rede
- **Objetivo**: Garantir que os Program IDs de Devnet e Mainnet nunca sejam misturados.
- **Teste**: Verifica se `PROGRAM_IDS.devnet` é diferente de `PROGRAM_IDS.mainnet` e se a resolução dinâmica está operante.

### B. Observabilidade (Validation Observer)
- **Objetivo**: Confirmar que o sistema de logs estruturados (console.table) é acionado sem quebrar a execução.
- **Teste**: Spy no `console.log` para verificar se as mensagens de "Validation Probe" são emitidas.

### C. Validação de 3 Camadas
- **Objetivo**: Simular o fluxo de Submissão -> Confirmação -> Verificação de Estado.
- **Teste**: Mock da função `executeTransactionWith3LayerValidation` garantindo que ela retorna uma assinatura válida e flag `verified: true`.

### D. Liberação Automática (Automatic Release)
- **Objetivo**: Validar a lógica de detecção de saldo (delta).
- **Teste**: Simula um cenário onde o saldo prévio era 100 e o pós-liberação é 150, garantindo que o validador marque como sucesso com delta exato de 50.

### E. Prevenção de Erros (Ambiente)
- **Objetivo**: Check de segurança de Produção.
- **Teste**: Simula hostname de produção (`verum.com`) com configuração de rede `devnet`, assertando que a flag de segurança falha corretamente (identificando o risco).

## Como Executar

Se o projeto já possui Jest configurado:
```bash
npm test src/utils/tests/vesting-flow.test.ts
```

Alternativamente, para validação manual rápida via Node (se adaptado):
```bash
npx ts-node src/utils/tests/vesting-flow.test.ts
```

> **Nota**: Estes testes utilizam Mocks para as chamadas de rede reais (RPC), focando na validação da **lógica de negócio** e fluxos de decisão. Testes de integração reais requerem um Local Validator rodando.

## Arquivos Criados
- `src/utils/tests/vesting-flow.test.ts`: Suíte de testes completa.
