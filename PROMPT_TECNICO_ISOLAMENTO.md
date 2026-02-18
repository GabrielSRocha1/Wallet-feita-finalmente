# Prompt Técnico - Isolamento de Rede e Prevenção de Erros

Este documento descreve a implementação das seções "1. ISOLAMENTO DE REDE" e "6. PREVENÇÃO DE ERROS COMUNS", garantindo que dados de teste (Devnet) nunca poluam o ambiente de produção (Mainnet) e vice-versa.

## 1. Isolamento de Rede (`src/utils/solana-config.ts` & `src/utils/verum-contract.ts`)

### Separação Rígida de Contexto
- **Program IDs Dedicados**: Criado mapa `PROGRAM_IDS` que retorna o ID do contrato correto baseado unicamente na rede selecionada.
  - *Benefício*: Impede que uma transação criada para Devnet seja sequer válida na Mainnet (pois o ID do programa não existirá ou será diferente).
- **RPC Endpoints Claros**: Funções `getRpcUrl(network)` garantem que o cliente RPC seja instanciado apontando explicitamente para a rede desejada.

### Validação em Execução (`verum-contract.ts`)
A função `getUserVestingInfo` agora realiza uma verificação de **Integridade de Propriedade**:
```typescript
if (accountInfo.owner !== expectedProgramId) {
    console.warn("[Network Isolation] Conta não pertence ao programa nesta rede!");
}
```
Isso previne que contas criadas em uma rede (que podem existir com mesmo endereço na outra por coincidência de seed, embora raro, ou por erro de cadastro) sejam lidas incorretamente.

## 6. Prevenção de Erros Comuns (`src/contexts/NetworkContext.tsx`)

### Guardas de Ambiente
Adicionados checks no `NetworkContext` para identificar desalinhamento entre o ambiente de hospedagem e a rede blockchain:
- **Detecção de Produção**: Se o hostname for `verum.com` (produção) e a rede estiver configurada para `devnet`, um alerta de segurança é emitido (`⚠️ [SECURITY]`).
- **Log de Troca de Rede**: Toda mudança de rede é logada explicitamente (`[Network Switch]`) para auditoria durante debugging.

### Como Verificar
1. **Teste de Isolamento**:
   - Tente usar uma função do contrato (ex: `getUserVestingInfo`) passando `network='devnet'`.
   - Observe no console que o Program ID utilizado será o de Devnet.
   - Tente passar `network='mainnet'`. O Program ID mudará. Se a conta não existir na Mainnet com aquele ID, o erro será tratado e isolado.

2. **Teste de Ambiente**:
   - Simule estar em produção alterando a verificação de hostname localmente ou deploy em staging.
   - Abra o console e verifique se o aviso de segurança aparece ao selecionar Devnet.

## Arquivos Modificados
- `src/utils/solana-config.ts`: Centralização de constantes e validação.
- `src/utils/verum-contract.ts`: Injeção de dependência de rede nas chamadas de contrato.
- `src/contexts/NetworkContext.tsx`: Guardas de estado global e UX de segurança.
