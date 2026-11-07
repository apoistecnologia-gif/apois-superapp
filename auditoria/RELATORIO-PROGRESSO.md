# APOIS — Auditoria Integral · Relatório de Progresso (Fase 1 e 2)

**Data:** 07/11/2026 · **Repositório:** `apoistecnologia-gif/apois-superapp` (branch de trabalho `fix/entregas-endereco-uf-gps`)
**Escopo deste documento:** Fase 1 (inventário) concluída e Fase 2 (Cliente Entregas) em andamento, com defeitos confirmados no código e correções já implementadas.

---

## 0. Aviso de escopo e honestidade sobre o que foi executado

Esta auditoria foi feita **lendo o código real do snapshot fixado** e **executando os gates de build** que o repositório possui. Não houve acesso a aparelho físico, nem a um projeto Supabase conectado (não existe conector Supabase nesta sessão — os projetos `tbbzkrfupmqdywnzgnms` e `ptgkwyyolrdgnqketkjj` não foram consultados).

Por isso, cada item abaixo carrega um status explícito:

| Status | Significado |
|---|---|
| **DEFEITO CONFIRMADO** | Causa raiz identificada no código, com arquivo e linha |
| **CORRIGIDO — RETESTE PENDENTE** | Correção escrita e aplicada no pipeline de build; falta validação em aparelho |
| **NÃO EXECUTADO** | Depende de aparelho, credencial ou ambiente que esta sessão não tem |

Nada aqui está marcado como "validado" sem execução real.

---

## 1. FASE 1 — Inventário real da arquitetura

### 1.1 Estrutura do repositório principal

```
apois-superapp/                     (camada de integração — NUNCA altera os submódulos)
├── sources/                        snapshots protegidos (submódulos, commits pinados)
│   ├── apois-entregas                        → franciel046631/apois-entregas @ 0a1e0b29
│   ├── apois-corridas-passageiro             → say-hello-buddy-23-84b5dcbf @ 7b047f75
│   └── apois-corridas-motorista-admin        → movvi-go-connect @ 9fc17105
├── .work/                          cópia descartável, adaptada e compilada no build
├── superapp/
│   ├── shell/                      APOIS Superapp (br.com.apois.app) — Corridas + Entregas
│   └── partner-shell/              APOIS Parceiro (br.com.apois.parceiro) — Motorista + Entregador
├── supabase/functions/             14 Edge Functions próprias do Superapp
├── scripts/                        ~200 hardeners/auditores (o "build" é código)
└── codemagic.yaml                  2 workflows oficiais de release
```

**Regra arquitetural central:** os três repositórios de origem são somente leitura. Todo ajuste de integração é feito por *hardeners* (scripts que reescrevem a cópia em `.work/`). Isso significa que **a correção de qualquer bug de produto tem dois caminhos**: corrigir no hardener, ou corrigir no submódulo. Cada defeito abaixo indica qual foi usado e por quê.

### 1.2 Aplicativos e painéis efetivamente existentes

| Sistema | Onde está | Tecnologia | Status de inventário |
|---|---|---|---|
| Cliente Entregas | `sources/apois-entregas` → `build:customer` | React 19 + TanStack Router + Capacitor 8 | **Inventariado** |
| Entregador | mesmo repo → `build:courier` | idem | Pendente (Fase 5) |
| Estabelecimento | mesmo repo → `build:merchant` | idem | Pendente (Fase 6) |
| Admin Entregas | mesmo repo → `build:admin` | idem | Pendente (Fase 7) |
| Cliente Corridas | `sources/apois-corridas-passageiro` | React + Vite | Pendente (Fase 3) |
| Motorista | `sources/apois-corridas-motorista-admin` | React + Vite + Android nativo | Pendente (Fase 4) |
| Admin Corridas | mesmo repo (rotas admin) | idem | Pendente (Fase 7) |

### 1.3 Rotas do Cliente Entregas (39 telas)

```
/                     /inicio               /buscar              /sacola
/checkout             /pedidos              /pedido/$orderId     /pedido/$orderId/avaliar
/pedido/confirmado    /favoritos            /notificacoes        /perfil
/perfil/dados-pessoais /perfil/pagamentos   /perfil/ajuda        /perfil/ajuda/chamado/$ticketId
/perfil/notificacoes  /perfil/legal         /enderecos           /enderecos/novo
/enderecos/editar/$addressId
/estabelecimento/$merchantId
/login                /register             /redefinir-senha     /auth/callback
/termos               /privacidade          /apois-plus          /configuracoes-estabelecimento
/merchant             /courier              /admin               /chamado-suporte/$ticketId
```

### 1.4 Edge Functions do Superapp (14)

`account-deletion`, `cancellation-fee-webhook`, `create-cancellation-fee-charge`, `dispatch-push-outbox`, `driver-membership-checkout`, `google-maps-address`, `mercadopago-create-ride-pix`, `mercadopago-driver-status`, `mercadopago-oauth-callback`, `mercadopago-oauth-start`, `merchant-mercadopago-callback`, `merchant-mercadopago-oauth`, `privacy-policy`, `public-ride-tracker`.

O snapshot de Entregas traz outras 37 functions próprias (PIX, refunds, assinaturas, push, suporte), incluindo três artefatos de homologação que **precisam de decisão de negócio** (ver §4.3).

---

## 2. FASE 2 — Cliente Entregas: cadastro de endereço (teste crítico do pedido)

Este é o fluxo que você relatou como defeituoso no celular. Ele foi rastreado ponta a ponta:

```
Login Google → Entregas → GPS → reverse_geocode → preenche campos →
número/complemento → salvar → customer_addresses → lista → selecionar → reabrir app
```

### 2.1 Defeito crítico — UF vira "Pernambuco" e o salvamento é recusado

**Causa raiz confirmada.** Existem **dois caminhos** de preenchimento de endereço, e eles liam a UF de formas diferentes:

| Caminho | Arquivo | Como lia a UF | Resultado |
|---|---|---|---|
| GPS | `CustomerLocationAddressSelector.tsx` | `short_name` de `administrative_area_level_1` | ✅ "PE" |
| Busca / mapa | `GoogleMapsAddressSelector.tsx` | **apenas `long_name`** | ❌ "Pernambuco" |

O Google devolve `long_name: "Pernambuco"` e `short_name: "PE"`. O fallback Nominatim da Edge Function `google-maps-address` devolve **só `long_name`**. Então toda busca de endereço enchia o campo com o nome por extenso, e `handleSubmit` recusava:

```
"O estado (UF) deve ter exatamente 2 letras"
```

Isso explica exatamente o sintoma que você viu: **o GPS funciona, a busca não.** Não era o Google — era o app escolhendo o campo errado em um dos dois caminhos.

**Impacto:** crítico. Sem UF válida não se salva endereço, e sem endereço não há checkout.

**Correção aplicada:** novo módulo `src/lib/brazilian-uf.ts` com as **27 UFs oficiais** e um `normalizeBrazilianUf()` que aceita sigla, nome por extenso e nome com acento (`Pará`, `Ceará`, `São Paulo`). Os **dois** seletores passam a usar o mesmo normalizador. Valor fora das 27 UFs retorna `""`, forçando preenchimento manual em vez de gravar lixo.

### 2.2 Defeito alto — editar endereço descartava o GPS a cada tecla

**Arquivo:** `src/routes/enderecos/editar/$addressId.tsx`, função `handleChange`.

Qualquer caractere digitado em CEP, rua, número, bairro, cidade ou UF zerava `latitude`/`longitude`. O cliente era obrigado a reconfirmar o mapa mesmo tendo só completado um campo que o GPS não identificou. O cadastro (`novo.tsx`) já tinha essa proteção; a edição não.

**Correção aplicada:** completar um campo **vazio** preserva as coordenadas; alterar um campo **preenchido** continua exigindo reconfirmação do ponto (que é o comportamento correto, porque aí o endereço realmente mudou).

### 2.3 Defeito alto — número obrigatório contradizia a própria mensagem

**Arquivo:** `src/routes/enderecos/novo.tsx`, `handleSubmit`.

A tela diz *"Preencha apenas os dados obrigatórios que a localização não conseguiu identificar"* e o aviso de GPS diz *"complete somente o que estiver vazio"*. Mas `number` estava na lista de campos obrigatórios — e o GPS quase nunca identifica número de imóvel. Lote, quadra e trechos sem numeração ficavam impossíveis de cadastrar.

**Correção aplicada:** `number` passa a ser opcional (o rótulo perde o asterisco), coerente com o resto da tela. CEP, rua, bairro, cidade e UF seguem obrigatórios.

### 2.4 Defeito baixo — botão "Salvar" fora do `<form>`

O rodapé `sticky` com o botão Salvar vive **fora** do `<form>`. Consequência: `required` nunca roda, validação nativa do Android é ignorada e o Enter do teclado não envia.

**Correção aplicada:** o botão virou `type="submit"` ligado por `form="apois-new-address-form"` ao formulário, preservando o layout sticky.

### 2.5 O que **não** foi validado (depende de aparelho)

| Passo do fluxo | Status |
|---|---|
| Permissão de GPS nativa e ponte `navigator.geolocation` | **NÃO EXECUTADO** — código revisado, sem aparelho |
| `reverse_geocode` real com a chave Google | **NÃO EXECUTADO** — sem credencial |
| Persistência em `customer_addresses` e RLS | **NÃO EXECUTADO** — sem projeto Supabase conectado |
| Reaproveitamento do endereço após fechar/abrir o app | **NÃO EXECUTADO** — sem aparelho |
| Correção do APK APOIS Cliente #109 | **NÃO EXECUTADO** — não há artefato acessível nesta sessão |

---

## 3. FASE 2 — Pipeline de build: hardeners quebrados

Enquanto preparava o build para validar as correções acima, **três hardeners de Entregas falharam**, cada um por um motivo diferente. Isso significa que `npm run build:entregas` estava quebrado no snapshot fixado.

| Hardener | Erro | Causa | Correção |
|---|---|---|---|
| `harden-entregas-superapp-address-ux.mjs` | `padrão esperado não encontrado` | Procurava `catch (error: any)` que já não existe no snapshot; fazia `throw` obrigatório | Substituição passou a ser condicional; a preservação de GPS migrou para o hardener novo |
| `harden-entregas-superapp-push-navigation.mjs` | `fallback esperado não encontrado` | Snapshot devolve o alvo em 3 linhas, não em ternário único; navegação usava `pathname` (o Hash Router não responde a isso) | Aceita os dois formatos e converte `pathname` → `hash`; **toque no Push agora abre o pedido** |
| `harden-superapp-module-mobile-ui.mjs` | `nenhum ajuste aplicado` | Fazia `throw` quando o snapshot já continha o ajuste — não era idempotente | Passa a registrar `(já aplicado)`; a verificação de marcadores no fim continua obrigatória |

O terceiro é o mais relevante: um hardener não idempotente torna o build **não reprodutível** — funciona uma vez e falha na segunda.

---

## 4. Defeitos encontrados e **ainda não corrigidos**

Registrados aqui para decisão sua, porque envolvem segurança ou regra de negócio.

### 4.1 `process-superapp-refund` — variável usada fora do escopo

Arquivo: `supabase/functions/process-superapp-refund/index.ts`.

`let providerRefundId: string; let status: string; let reused: boolean;` são declarados dentro do bloco `if (chargeRoute.api === "orders")`, mas o bloco seguinte (`Payments API`) usa os três fora do escopo. Além disso `providerRefundId` é `let` sem valor atribuído em um caminho e o código o usa em seguida.

**Gravidade:** alta — a function que processa estorno é a que apresenta o defeito. Em TypeScript isso não compila (`tsc --noEmit` acusaria); em Deno com transpile direto, vira `undefined` em tempo de execução, o que pode gravar `refunds.status = "completed"` com `provider_refund_id` inválido.

**Ação recomendada:** corrigir a declaração para o escopo da função. Não apliquei porque é código financeiro e você pediu aprovação explícita antes de mudanças dessa natureza.

### 4.2 `google-maps-address` — quota consumida pelo fallback

A Edge Function consome quota `consume_google_maps_lookup_quota` **antes** de decidir entre Google e Nominatim, e não trata `429` do provedor de fallback. Em pico de uso o usuário recebe 500 mesmo tendo quota disponível no Google.

### 4.3 Artefatos de homologação em produção no snapshot de Entregas

Existem functions publicáveis chamadas `apois-pix-auto-homol-8f4c3e9a`, `apois-refund-homol-8-7c2f` e `temp-mp-token-key-check`. Precisam ser confirmadas como não deployadas no projeto real — **não é possível verificar sem acesso ao Supabase**.

### 4.4 `.gitmodules` aponta para `franciel046631/*`

Os repositórios que aparecem na sua conta são `apoistecnologia-gif/*`. Hoje o `sources:clone` funciona porque os dois caminhos resolvem para os mesmos commits (verifiquei com `git ls-remote` nos dois), mas é um vínculo implícito.

---

## 5. Correções desta sessão — onde estão

| Arquivo | Mudança |
|---|---|
| `scripts/lib/source-git.mjs` | **novo** — classifica o estado dos snapshots (`uninitialized`/`checked-out`/`broken`) |
| `scripts/verify-module-pins.mjs` | `verify:pins` deixa de ler o HEAD do Superapp como se fosse o commit do snapshot |
| `scripts/status-modules.mjs` | mesmo problema, mesma correção, e passa a sinalizar divergência de pin |
| `scripts/harden-entregas-superapp-address-fields.mjs` | **novo** — UF nas 27 UFs, GPS preservado na edição, número opcional, submit real |
| `scripts/harden-entregas-superapp-address-ux.mjs` | deixa de derrubar o build |
| `scripts/harden-entregas-superapp-push-navigation.mjs` | aceita o snapshot atual e corrige navegação por hash |
| `scripts/harden-superapp-module-mobile-ui.mjs` | passa a ser idempotente |
| `.apois/modules.json` | registra o hardener novo na cadeia de Entregas |

O PR #13 (`fix/pin-verification-false-positive`) já está aberto com a parte de pins. A parte de Entregas está no branch `fix/entregas-endereco-uf-gps` e ainda precisa do build completo (`bun install` + `vite build`) antes de virar PR — é o próximo passo.

---

## 6. Cobertura real até agora

| Fase | Situação |
|---|---|
| 1 — Inventário | **Concluída** para o Superapp e para o Cliente Entregas |
| 2 — Cliente Entregas | **Em andamento** — cadastro de endereço auditado e corrigido; checkout, sacola, pedidos e perfil ainda pendentes |
| 3 a 10 | Não iniciadas |

Nenhuma tela foi marcada como homologada. As correções de endereço estão como **CORRIGIDO — RETESTE PENDENTE**, porque exigem aparelho físico e o projeto Supabase real para validação.

---

## 7. O que preciso de você para avançar

1. **Aparelho / build**: autorização para rodar o build completo de Entregas e gerar o APK, ou um aparelho onde você instale a versão nova para reteste do cadastro de endereço.
2. **Supabase**: o conector Supabase não existe nesta sessão. Para auditar RLS, RPCs e Edge Functions dos dois projetos (`tbbzkrfupmqdywnzgnms`, `ptgkwyyolrdgnqketkjj`) preciso de acesso — sem ele, a Fase 8 fica bloqueada.
3. **Decisão sobre o §4.1**: autorizar a correção do escopo de variáveis em `process-superapp-refund`.
