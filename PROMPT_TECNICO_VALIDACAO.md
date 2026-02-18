# Prompt Técnico - Validação de Registro Blockchain (READ-ONLY)

Este documento descreve a implementação de observabilidade e validação de registros blockchain em tempo real, sem mutação de estado e sem alteração na interface do usuário.

## Objetivo
Instrumentar o cliente para validar e registrar (log) o estado da conta blockchain conectada, garantindo integridade e fornecendo dados de debug (observabilidade) no momento da conexão.

## Implementação

### 1. Utilitário de Observabilidade (`src/utils/validation-observer.ts`)
Criada função `observeBlockchainRecord(publicKey)` que realiza uma consulta READ-ONLY (RPC `getAccountInfo`) para verificar:
- **Existência da conta**: Se a conta existe no ledger.
- **Saldo (Lamports/SOL)**: Conversão e exibição precisa.
- **Proprietário (Owner)**: Se é System Program (Carteira Nativa) ou Program Derived Address (PDA).
- **Executable**: Se é um contrato executável.
- **Tamanho dos Dados**: Tamanho do buffer de dados da conta.

A saída é estruturada utilizando `console.group` e `console.table` para fácil visualização no DevTools do navegador.

### 2. Integração (`src/hooks/useSolana.ts`)
A função de observabilidade é chamada automaticamente em dois momentos críticos:
1. **Conexão Inicial**: Logo após o usuário conectar a carteira.
2. **Restauração de Sessão**: Ao recarregar a página, se houver uma sessão salva.

### 3. Segurança e Performance
- **Non-blocking**: A chamada é assíncrona e não bloqueia a interface ou o fluxo de autenticação.
- **Fail-safe**: Erros na validação (ex: falha de rede RPC) são capturados e logados, sem impedir o uso do app.
- **Read-Only**: Nenhuma transação é assinada ou enviada; apenas leitura de estado público.

## Como Verificar
1. Abra o Console do Navegador (F12 > Console).
2. Conecte sua carteira ou recarregue a página se já estiver conectado.
3. Procure pelo grupo `🔍 Blockchain Validation Probe`.
4. Verifique a tabela com `Status`, `Owner`, `Lamports`, etc.

## Exemplo de Saída (Console)
```
🔍 Blockchain Validation Probe [obs_1700000000000]
  Timestamp: 2024-02-18T00:00:00.000Z
  Target Public Key: 7Xw...
  📡 Probing account state...
  ✅ [SUCCESS] Account Found on Ledger
  (index)      Value
  Status       'Active'
  Owner        '11111111111111111111111111111111'
  Lamports     1500000000
  SOL Balance  '1.500000000'
  Executable   false
  Data Size    0
  🏁 Validation Probe Completed
```
