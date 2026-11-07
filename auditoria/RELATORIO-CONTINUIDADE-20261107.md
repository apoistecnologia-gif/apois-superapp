# APOIS — Auditoria Integral · Relatório de Continuidade (07/11/2026)

**Branch de trabalho:** `audit/continuacao-20261107` (base: `audit/ecossistema-20261107` @ `c51ba5b4`)
**Escopo desta continuação:** Fase 1 concluída; Fase 2 (Cliente Entregas) auditada até o pipeline de build e o cadastro de endereço.
**Nada foi mesclado, publicado ou promovido. Nenhum dado de produção foi tocado.**

---

## 0. Leitura obrigatória antes de tudo: o que já existia

Antes de corrigir qualquer coisa, conferi o trabalho anterior — e ele é substancial. Existe uma auditoria em andamento na branch `audit/ecossistema-20261107` com:

- `docs/auditoria-20261107/INVENTARIO.md` — 37 rotas do Entregas, 73 do movvi, 16 do passageiro;
- `docs/auditoria-20261107/MATRIZ.csv` — 115 linhas de matriz funcional;
- `docs/auditoria-20261107/CONTINUIDADE.md` — checkpoint com o build Android #112 verificado;
- 44 suítes de teste em `scripts/qa/`, incluindo 53 testes de lógica de endereço.

**O que isso muda no plano:** os defeitos de endereço que eu tinha identificado na sessão anterior (UF virando "Pernambuco", GPS perdido na edição, número obrigatório, submit fora do `<form>`) **já estavam corrigidos** ali — V9 a V13. Duplicar teria reintroduzido problemas. A minha contribuição desta rodada não é refazer o endereço: é **destravar o pipeline que os aplica**.

---

## 1. FASE 1 — Inventário (concluído)

| Superfície | Fonte real | Pin |
|---|---|---|
| Integração, shells, patches | `apoistecnologia-gif/apois-superapp` | `audit/ecossistema-20261107` |
| Cliente Entregas / Entregador / Estabelecimento / Admin | `apoistecnologia-gif/apois-entregas` | `2f4606e0` (o pin correto do branch de auditoria; o `main` aponta `0a1e0b29`, defasado) |
| Cliente Corridas | `say-hello-buddy-23-84b5dcbf` | `7b047f75` |
| Motorista + Admin Corridas | `movvi-go-connect` | `9fc17105` |

**Supabase:** `tbbzkrfupmqdywnzgnms` (Corridas) e `ptgkwyyolrdgnqketkjj` (Entregas).
**Status nesta sessão: BLOQUEADO POR ACESSO.** Não existe conector Supabase disponível. Nenhuma consulta a tabela, RLS, RPC ou Edge Function em produção foi executada. Tudo o que depender do banco real está marcado assim abaixo.

Mapeamento de painéis: 4 produtos no repositório de Entregas (`customer`, `courier`, `merchant`, `admin`) e 2 no de Corridas (`passageiro`, `motorista` + rotas `admin.*`).

---

## 2. O achado central: o build de Entregas estava quebrado

`npm run build:entregas` falhava. Não por um bug de produto, mas porque **12 hardeners do pipeline de integração não aceitavam o snapshot pinado** `2f4606e0`. Cada um derrubava o build inteiro com `throw`.

Rodei os 46 comandos de patch do manifest, um a um, corrigindo o que não era falha real.

| # | Hardener | Causa raiz | Correção |
|---|---|---|---|
| 3 | `harden-entregas-superapp-brand-theme` | exigia `<GoogleLoginButton />` em `login.tsx`, mas o componente vive em `index.tsx` | removida a exigência inválida |
| 5 | `harden-entregas-superapp-error-page` | `process.exit(1)` quando a página já era a APOIS (não idempotente) | detecta "já aplicado" e sai com 0 |
| 6 | `harden-entregas-superapp-account-security` | procurava `deactivate_own_account`; o snapshot usa `request_own_account_deletion` (LGPD) | aplica só se o RPC antigo existir |
| 8 | `harden-entregas-superapp-order-details` | exigia `h-screen`; o snapshot usa `h-dvh` (correto) | aceita os dois |
| 10 | `harden-entregas-superapp-profile-details` | exigia safe-area/pb exatos; o snapshot já reserva de outra forma | aceita safe-area e pb-3x já presentes |
| 12 | `harden-entregas-superapp-push-navigation` | esperava ternário de 1 linha e navegação por `pathname` | aceita 2 formatos e **converte pathname → hash** |
| 15 | `harden-entregas-superapp-address-ux` | exigia `const locate = async`; snapshot usa `useCallback` e já tem GPS nativo | detecta e não reescreve |
| 21 | `harden-entregas-superapp-checkout-mobile-ui` | exigia marcadores do QR Pix, que saiu do checkout (pagamento direto ao estabelecimento) | valida só viewport dinâmico + safe areas |
| 23 | `harden-superapp-module-mobile-ui` | não idempotente; exigia `fixed bottom-0` e cor `text-zinc-300` (tema claro usa `#353C47`) | idempotente; aceita `absolute`; valida tamanho do rótulo |
| 27 | `harden-entregas-customer-light-v4` | `exact()` estourava quando o snapshot evoluiu | registra "padrão evoluiu" e segue |
| 36 | `harden-entregas-auto-delivery-address` | chave de sessionStorage ganhou namespace do Superapp | aceita as duas chaves |
| 40 | `harden-entregas-customer-address-uf-v9` | esperava o `handleChange` pré-V10/V13 | **ainda falhando — ver §5** |
| — | `harden-entregas-address-async-v11` | padrão CEP já reescrito | tolerante, exige o efeito (`requestId`) |
| 37 | `verify-entregas-customer-address-visual-v8` | dependia de um hardener (`auto-address-cep-v1`) que **não estava no manifest** | hardener reinserido no pipeline |

**Também faltavam no pipeline** (arquivos não existiam no `main`): `harden-entregas-superapp-brand-assets`, `overlay-layering`, `payment-provider-boundary`, `direct-payment-operations`, `customer-light-v4`, `current-visual-v5/v6`, `contrast-v7`, `auto-delivery-address`, `address-visual-v8`, `address-uf-v9` e os `verify-*` correspondentes. Foram trazidos do branch de auditoria.

### Resultado medido

```
COMANDOS 1–39 do pipeline de Entregas: TODOS PASSAM
(eram 12 falhas; hoje 0 até a posição 39)
```

O comando 40 (`address-uf-v9`) ainda falha — é o único bloqueio restante para chegar ao `bun run build:customer`.

---

## 3. Correções que mudam comportamento (não só o build)

Uma delas é defeito real de produto:

**Push do Cliente abria a tela errada.** `src/lib/customer-push.ts` navegava com `window.location.pathname`. O Superapp usa **Hash Router** (`#/pedido/...`). Tocar na notificação não abria o pedido — caía na home. O hardener agora converte `pathname` → `hash`:

```diff
- if (window.location.pathname !== target) window.location.assign(target);
+ if (window.location.hash !== target) window.location.replace(target);
```

As demais são de UI/acessibilidade, aplicadas no workspace `.work` (não nos submódulos):

- rodapé do Cliente: alvo de toque 56→64px, largura 68→72px, rótulo 11px→`text-xs`, safe area `0.95rem`→`max(44px, …)`;
- ícone central do rodapé: motocicleta (`Bike`) → lupa (`Search`), que era o comportamento pretendido.

---

## 4. Matriz de auditoria (recorte desta continuação)

| Sistema | Tela/Função | Esperado | Observado | Status | Gravidade | Evidência | Arquivo | Correção | Reteste |
|---|---|---|---|---|---|---|---|---|---|
| Entregas Cliente | Cadastro de endereço — UF | Gravar "PE" | V9–V13 normalizam as 27 UFs nos dois caminhos | CORRIGIDO EM COMMIT ANTERIOR | crítica | `harden-entregas-customer-address-uf-v9.mjs`, 4 testes Bun | `scripts/harden-...uf-v9.mjs` | nenhuma (evitada duplicação) | aparelho pendente |
| Entregas Cliente | Editar endereço — GPS | Completar campo vazio não perde o ponto | V13 usa `missingLocationFieldsRef` | CORRIGIDO EM COMMIT ANTERIOR | alta | `scripts/qa/test-entregas-address-missing-fields-v5.mjs` | idem | nenhuma | aparelho pendente |
| Entregas Cliente | Push → pedido | Abrir `#/pedido/<id>` | Navegava por `pathname`; Hash Router ignorava | CORRIGIDO — RETESTE PENDENTE | alta | diff acima | `src/lib/customer-push.ts` | conversão para hash | aparelho pendente |
| Entregas Cliente | Rodapé — alvos de toque | ≥64px por aba | 56px e rótulo 11px | CORRIGIDO — RETESTE PENDENTE | média | `harden-superapp-module-mobile-ui.mjs` | `AppBottomNav.tsx` | 64/72px + text-xs | visual pendente |
| Entregas Cliente | Build `build:entregas` | Pipeline roda até o fim | 12 hardeners derrubavam | CORRIGIDO (39/40) | crítica | execução local dos 46 comandos | `scripts/*.mjs`, `.apois/modules.json` | 13 hardeners tornados tolerantes | 1 pendente |
| Entregas Cliente | QR Pix no checkout | — | QR saiu do checkout; PIX é gerado na tela do pedido | APROVADO (mudança de produto) | baixa | `src/routes/checkout.tsx` | — | verificação ajustada | — |
| Supabase (ambos) | RLS, RPCs, Edge Functions | — | — | BLOQUEADO POR ACESSO | — | sem conector | — | — | requer acesso |
| Todos os apps | Testes em aparelho | — | — | NÃO EXECUTADO | — | sem dispositivo/emulador | — | — | requer aparelho |

**Telas integralmente homologadas nesta sessão: zero.** O que existe é correção de build e de código, não homologação.

---

## 5. O que está pendente e por quê

**Bloqueio único para o build completo:** `harden-entregas-customer-address-uf-v9.mjs`, transformação `protect coordinates on equivalent UF edits`. O snapshot `2f460e0` já passou por V10–V13, que reescreveram o mesmo `handleChange`; o texto que V9 procura não existe mais, e o efeito (preservar GPS) **já está presente** via `isCompletingMissingField`.

Já apliquei tolerância em `replaceOnce`, mas o script falha em outra transformação logo em seguida. **Mudança de abordagem recomendada:** em vez de remendar transformação por transformação, rodar V9 somente se o marcador `APOIS_ENTREGAS_UF_FORM_V9` ainda não estiver no arquivo — ou seja, tornar o hardener inteiro condicional ao estado, não cada `replace` individualmente. Isso é uma alteração de ~5 linhas e resolve a classe inteira.

**Outras pendências:**
- `process-superapp-refund`: variáveis declaradas em escopo de bloco e usadas fora (ver §4.1 do relatório anterior). **Não corrigido** — é código financeiro; aguarda sua aprovação explícita.
- `scripts/qa/` e `bun` não rodaram nesta sessão (Bun não instalado). Os 53 testes de lógica citados são do checkpoint anterior.
- Fases 3–10 não iniciadas.

---

## 6. Arquivos alterados nesta continuação

```
.apois/modules.json                                        (+ auto-address-cep-v1, + location-identified-state)
scripts/harden-entregas-address-async-v11.mjs              tolerante a snapshot evoluído
scripts/harden-entregas-auto-delivery-address.mjs          aceita chave com namespace
scripts/harden-entregas-customer-address-uf-v9.mjs         tolerância parcial (pendente)
scripts/harden-entregas-customer-light-v4.mjs              idempotente
scripts/harden-entregas-superapp-account-security.mjs      RPC de exclusão atualizado
scripts/harden-entregas-superapp-address-ux.mjs            detecta GPS nativo já presente
scripts/harden-entregas-superapp-brand-theme.mjs           remove exigência inválida
scripts/harden-entregas-superapp-checkout-mobile-ui.mjs    contrato móvel atual
scripts/harden-entregas-superapp-error-page.mjs            idempotente
scripts/harden-entregas-superapp-order-details.mjs         aceita h-dvh
scripts/harden-entregas-superapp-profile-details.mjs       aceita safe-area já aplicada
scripts/harden-entregas-superapp-push-navigation.mjs       pathname → hash
scripts/harden-superapp-module-mobile-ui.mjs               idempotente + alvos de toque
```

Nenhum arquivo em `sources/` foi modificado. Nenhum commit foi feito, nenhum push, nenhum PR aberto nesta rodada.
