# Logging runtime seguro — APOIS

## Escopo

Esta política separa **runtime** de **tooling**.

Runtime inclui código executado em cliente/webview, SSR e Edge Functions dos módulos Corridas, Entregas e Motorista/Admin. Tooling inclui `scripts/`, testes, auditorias, migrações, documentação e arquivos de build/configuração.

Logs de tooling não são removidos indiscriminadamente: mensagens `[OK]`, `[WARN]`, `[FAIL]`, progresso de build e diagnósticos de CI continuam permitidos.

## Nunca registrar em runtime

- `Authorization` ou bearer tokens;
- JWT, access token, refresh token e ID token;
- OAuth authorization code;
- PKCE verifier;
- Mercado Pago access token;
- Firebase/private key;
- `service_role` ou chave equivalente;
- webhook secrets / client secrets;
- corpo HTTP bruto de gateways ou payload financeiro completo;
- dados pessoais sem necessidade operacional;
- latitude/longitude ou localização precisa sem necessidade explícita.

## Observabilidade permitida e recomendada

Preservar IDs técnicos e metadados mínimos, por exemplo:

```js
safeLogger.error('payment.reconcile_failed', {
  correlationId,
  orderId,
  paymentId,
  provider: 'mercadopago',
  providerStatus: response.status,
  retryable: true,
});
```

IDs de pedido, corrida, payout/refund e correlation IDs são preferíveis a nomes, telefone, e-mail, endereço ou payloads inteiros.

## Redaction central

`scripts/runtime-log-redaction.mjs` fornece:

- `redactRuntimeLogValue()`;
- `safeRuntimeContext()`;
- `createSafeRuntimeLogger()`.

O helper mascara automaticamente chaves de autenticação/segredo, JWT/Bearer, tokens Mercado Pago, localização precisa e dados pessoais comuns. Strings muito grandes são truncadas.

O helper é puro e pode ser reutilizado por runtime JavaScript compatível com ESM quando houver um ponto de logging compartilhado. Não é imposto artificialmente a todos os módulos enquanto os snapshots continuarem isolados; por isso há também auditoria estática no pipeline.

## Hardening no Superapp

Os repositórios em `sources/` permanecem read-only. `prepare-workspace.mjs` copia cada módulo para `.work/`, aplica `hardenRuntimeLogging()` somente na cópia de trabalho e depois executa `auditRuntimeLogging()`.

Correções atuais na cópia de trabalho incluem:

- não registrar `response.text()` em falhas de push de Corridas;
- não registrar prefixo/comprimento de chave Google Maps;
- remover `userId` de erro de listagem quando o ID não é necessário para diagnosticar a falha.

A auditoria classifica contagens de `console.log/warn/error` em runtime versus tooling e falha para referências diretas a credenciais, segredos, localização precisa e corpos HTTP crus. Casos menos determinísticos — payload genérico, Error cru e campos pessoais — aparecem como `LOG-WARN` para revisão humana.

## Testes

```bash
node scripts/test-runtime-log-redaction.mjs
node scripts/test-runtime-logging-policy.mjs
```

Os testes validam redaction de Authorization/JWT/tokens/PKCE/private key/service_role/webhook secret, localização e dados pessoais; preservam IDs de correlação/status; verificam classificação runtime/tooling e comprovam que um log inseguro faz a auditoria falhar.
