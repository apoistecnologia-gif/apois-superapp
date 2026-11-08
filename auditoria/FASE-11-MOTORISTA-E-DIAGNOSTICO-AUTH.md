# APOIS — Fase 11 · Smoke do Motorista + diagnóstico de testes autenticados

**Branch:** `audit/continuacao-20261107` · **Playwright 1.65.0 + Chromium** · 390×844
**Servidor:** 4202 (`.work/motorista/dist/client`, build real, 780 pacotes)

---

## 1. Motorista — smoke real

O build foi regerado nesta fase (`bun run build:motorista`, `dist/client/index.html` confirmado). O smoke anterior apontava para um `dist` que não existia e retornava 404 em tudo — corrigido.

| Rota | Path final | Texto | Inputs | Resultado |
|---|---|---:|---:|---|
| `/motorista/login` | — | — | — | **NÃO MEDIDO** (navegação abortada no 1º acesso) |
| `/motorista/cadastro` | `/motorista/cadastro` | **0** | 0 | **tela vazia** |
| `/motorista/recuperar-senha` | `/motorista/recuperar-senha` | 201 | 1 | **renderiza** "Esqueci minha senha" |
| `/motorista/app` | `/motorista/login` | 276 | 2 | redireciona para login |
| `/motorista/corridas` | `/motorista/corridas` | 563 → **0** | 1 → 0 | **instável**: renderiza "Histórico" e depois esvazia |
| `/motorista/ganhos` | `/motorista/login` | 276 | 2 | redireciona |
| `/motorista/perfil` | `/motorista/login` | 276 | 2 | redireciona |
| `/motorista/documentos` | `/motorista/login` | 276 | 2 | redireciona |
| `/admin/login` | `/motorista/login` | 276 | 2 | redireciona (admin não pertence a este build) |
| `/admin/dashboard` | `/motorista/login` | 276 | 2 | redireciona |

### D-004 · `/motorista/cadastro` renderiza tela vazia (DEFEITO CONFIRMADO)

Medição: `len = 0`, `inputs = 0`, path preservado. A rota existe, monta e não desenha nada. Não corrigido nesta fase — precisa de investigação do componente, e o tempo foi consumido pelo diagnóstico de autenticação.

### D-005 · `/motorista/corridas` renderiza e depois esvazia (DEFEITO CONFIRMADO)

Primeira medição: 563 caracteres, h1 "Histórico", 1 input. Segunda medição da mesma rota: **0 caracteres, 0 inputs**. Comportamento não determinístico — o conteúdo aparece e é removido. Não corrigido.

### Nota de método

O Motorista usa **history de browser**, não hash. Testar por `#/rota` sempre cai na landing — foi o que produziu 23 linhas idênticas na primeira tentativa. O smoke correto é por pathname, com `domcontentloaded` e retry de `evaluate` (a navegação destrói o contexto).

## 2. Diagnóstico de testes autenticados

### 2.1 O que já existe no repositório

| Item | Situação |
|---|---|
| `.env.example` | nomes de variáveis (`CORRIDAS_VITE_SUPABASE_URL`, `VITE_SUPABASE_URL`, chaves publicáveis, chaves de mapas, Firebase) — **sem valores** |
| `sources/apois-entregas/supabase/config.toml` | `project_id = "sbvhdgyuuperszlsllji"`; webhooks com `verify_jwt = false`. Configuração de **deploy**, não de teste |
| Supabase local | **inexistente** — sem `config.toml` na raiz, sem `supabase/seed.sql` |
| Contas de homologação | **não documentadas** em `docs/` |
| CI | build Android com assinatura, **sem** provisionamento de banco de teste |
| Docker | **não disponível** neste ambiente |

### 2.2 Variáveis necessárias por aplicativo

| App | Variáveis |
|---|---|
| Corridas passageiro | `CORRIDAS_VITE_SUPABASE_URL`, `CORRIDAS_VITE_SUPABASE_PUBLISHABLE_KEY`, `CORRIDAS_WEB_MAPS_API_KEY`, `CORRIDAS_PUBLIC_APP_URL` |
| Corridas motorista | mesmas + `CORRIDAS_ANDROID_MAPS_API_KEY`, Firebase |
| Entregas (4 modos) | `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `CORRIDAS_WEB_MAPS_API_KEY` |
| Parceiro (APK) | `FIREBASE_PARTNER_GOOGLE_SERVICES_JSON_BASE64` |
| Edge Functions | `MERCADOPAGO_*`, `MERCADOPAGO_TOKEN_ENCRYPTION_KEY`, `SUPABASE_SERVICE_ROLE_KEY` |

### 2.3 Serviços que precisam estar ativos

Auth (login/cadastro/reset), PostgREST (tabelas e RPCs), Realtime (status de corrida/pedido), Storage (documentos e fotos), Edge Functions (request-ride, create-merchant-mercadopago-pix, process-superapp-refund, google-maps-address, dispatch-push-outbox), FCM (push) e Google Maps (mapa e Places).

### 2.4 Supabase local com Docker ou projeto separado?

**Ambos são viáveis e nenhum exige tocar produção.**

- **Local (`supabase start`)**: sobe Postgres + Auth + PostgREST + Realtime + Storage em containers, aplica as 163 migrations do snapshot de Entregas e as do snapshot de Corridas. É o caminho mais fiel e o único que permite testar RLS sem risco. **Bloqueio: Docker não está instalado neste ambiente.**
- **Projeto separado de homologação**: dois projetos Supabase novos (Corridas e Entregas), com as mesmas migrations. Não compartilha dados com produção, mas exige criação de projeto e aplicação de migrations — ação sua.

### 2.5 Contas de teste necessárias

| Perfil | Uso |
|---|---|
| Passageiro | solicitar corrida, acompanhar, cancelar, histórico |
| Motorista | aprovar documentos, ficar online, aceitar, PIN, concluir |
| Cliente Entregas | endereço, sacola, checkout, pedido |
| Entregador | oferta, coleta, PIN, entrega |
| Estabelecimento | produtos, pedidos, preparação, financeiro |
| Administrador | aprovações, cobertura, repasses, logs |

### 2.6 Dados sintéticos mínimos

Categorias e tarifas de corrida; `ride_categories` ativas; um estabelecimento aprovado com produtos e adicionais; cobertura de cidade; `merchant_mercadopago_accounts` em estado `connected` simulado; assinaturas ativas para liberar checkout; um pedido em cada status; uma corrida em cada status.

### 2.7 Como testar RLS sem desativar

Consultar `pg_policies`, executar as mesmas queries com JWT de cada perfil (via `storageState` do Playwright) e afirmar que o resultado é vazio quando o dono não corresponde. Nenhuma política é alterada; o teste só **verifica** o comportamento.

### 2.8 Fluxos entre apps sem pagamento real

Usar `MERCADOPAGO_HOMOLOGATION_ONLY=true` (já existe no código de `mercadopago-create-ride-pix`), contas de teste do Mercado Pago e `orders_api_enabled` apenas no estabelecimento de homologação. Nenhuma cobrança real é criada.

### 2.9 Automação Playwright

`storageState` por perfil gerado por login real; screenshots por passo; asserção de texto e de rede. Já existe `qa-visual/` com servidor estático e smoke por modo — é a base.

## 3. O que depende de você

1. **Docker** instalado (ou autorização para criar dois projetos Supabase de homologação).
2. **Chaves de mapas** de teste (`CORRIDAS_WEB_MAPS_API_KEY`, `CORRIDAS_ANDROID_MAPS_API_KEY`).
3. **Autorização** para criar as 6 contas sintéticas e o seed no ambiente de homologação.
4. **Firebase** de homologação, se push for testado.

Sem esses quatro itens, nenhum fluxo autenticado pode ser executado — e nenhum será declarado aprovado.

## 4. Matriz — Fase 11

| App | Tela | Status | Gravidade |
|---|---|---|---|
| Motorista | `/motorista/cadastro` | **DEFEITO CONFIRMADO** — tela vazia | alta |
| Motorista | `/motorista/corridas` | **DEFEITO CONFIRMADO** — esvazia após renderizar | alta |
| Motorista | `/motorista/recuperar-senha` | **APROVADO** | — |
| Motorista | `/motorista/app`, `/ganhos`, `/perfil`, `/documentos` | **APROVADO (redirect)** | — |
| Motorista | `/motorista/login` | **NÃO MEDIDO** | — |
| Admin Corridas | 23 rotas | **NÃO EXECUTADO** | — |
| Todos | fluxos autenticados | **BLOQUEADO** — §3 | crítica |
