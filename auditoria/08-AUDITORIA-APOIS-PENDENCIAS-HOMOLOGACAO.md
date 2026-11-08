# 08 — PENDÊNCIAS DE HOMOLOGAÇÃO

O que ainda impede teste real, o que já existe e o que precisa ser providenciado.

---

## 1. Bloqueios ativos

| # | Bloqueio | Impacto | Existe algo? | Precisa |
|---|---|---|---|---|
| B-1 | Supabase inacessível (sem conector na sessão) | nenhum fluxo autenticado, nenhuma RLS testada | projetos `tbbzkrfupmqdywnzgnms` (Corridas) e `ptgkwyyolrdgnqketkjj` (Entregas) existem | acesso ou ambiente separado |
| B-2 | Docker ausente | impossibilita `supabase start` local | — | instalação ou autorização para projeto de homologação |
| B-3 | Chaves de mapas ausentes | mapa e Places não homologáveis | `.env.example` documenta os nomes | `CORRIDAS_WEB_MAPS_API_KEY`, `CORRIDAS_ANDROID_MAPS_API_KEY` de teste |
| B-4 | Sem aparelho/emulador | GPS, push, teclado, safe area | APK #112 existe como artefato | dispositivo ou emulador |
| B-5 | Sem contas sintéticas | nenhum perfil autenticado | — | autorização para criar 6 contas |
| B-6 | Firebase de homologação | push não testável | `FIREBASE_*` documentadas | projeto de homologação |

## 2. O que já existe no repositório

| Item | Situação |
|---|---|
| `.env.example` | nomes de todas as variáveis, **sem valores** |
| `sources/apois-entregas/supabase/config.toml` | `project_id = "sbvhdgyuuperszlsllji"`, webhooks com `verify_jwt = false` — configuração de **deploy** |
| 163 migrations do snapshot Entregas | presentes, aplicáveis em banco local |
| Edge Functions (64 no Superapp, 39 no snapshot) | presentes |
| `scripts/qa/` — 44 suítes | presentes e executáveis |
| `qa-visual/` — 19 arquivos | servidor estático, smokes, hit-test, capturas |
| Workflow Android no CI | existe, com assinatura; **sem** provisionamento de banco de teste |
| Contas de homologação documentadas | **não encontradas** |

## 3. Variáveis por aplicativo

| App | Variáveis |
|---|---|
| Corridas passageiro | `CORRIDAS_VITE_SUPABASE_URL`, `CORRIDAS_VITE_SUPABASE_PUBLISHABLE_KEY`, `CORRIDAS_WEB_MAPS_API_KEY`, `CORRIDAS_PUBLIC_APP_URL` |
| Corridas motorista | as acima + `CORRIDAS_ANDROID_MAPS_API_KEY`, Firebase |
| Entregas (4 modos) | `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `CORRIDAS_WEB_MAPS_API_KEY` |
| Parceiro (APK) | `FIREBASE_PARTNER_GOOGLE_SERVICES_JSON_BASE64` |
| Edge Functions | `MERCADOPAGO_*`, `MERCADOPAGO_TOKEN_ENCRYPTION_KEY`, `SUPABASE_SERVICE_ROLE_KEY` |

## 4. Serviços necessários

Auth (login, cadastro, reset), PostgREST (tabelas e RPCs), Realtime (status de corrida e pedido), Storage (documentos e fotos), Edge Functions (`request-ride`, `create-merchant-mercadopago-pix`, `process-superapp-refund`, `google-maps-address`, `dispatch-push-outbox`), FCM, Google Maps.

## 5. Contas necessárias

| Perfil | Fluxos que desbloqueia |
|---|---|
| Passageiro | solicitar, acompanhar, cancelar, histórico |
| Motorista | documentos, online, aceitar, PIN, concluir |
| Cliente Entregas | endereço, sacola, checkout, pedido |
| Entregador | oferta, coleta, PIN, entrega |
| Estabelecimento | produtos, pedidos, preparação, financeiro |
| Administrador | aprovações, cobertura, repasses, logs |

## 6. Dados sintéticos mínimos

Categorias e tarifas de corrida ativas; um estabelecimento aprovado com produtos e adicionais; cobertura de cidade; `merchant_mercadopago_accounts` em estado `connected` simulado; assinatura ativa para liberar checkout; um pedido em cada status; uma corrida em cada status.

## 7. RLS sem desativar

Consultar `pg_policies`, executar as mesmas queries com JWT de cada perfil via `storageState` do Playwright e afirmar que o resultado é vazio quando o dono não corresponde. Nenhuma política é alterada — o teste apenas **verifica**.

## 8. Fluxo financeiro sem dinheiro real

`MERCADOPAGO_HOMOLOGATION_ONLY=true` já existe em `mercadopago-create-ride-pix`. Usar contas de teste do Mercado Pago e `orders_api_enabled` apenas no estabelecimento de homologação.

## 9. Automação Playwright

`storageState` por perfil gerado por login real; screenshots por passo; asserção de texto e de rede. A base está em `qa-visual/` (servidor estático + smokes por modo).

## 10. Ações que dependem de você

1. Instalar Docker **ou** autorizar dois projetos Supabase de homologação.
2. Fornecer chaves de mapas de teste.
3. Autorizar a criação das 6 contas sintéticas e do seed.
4. Fornecer Firebase de homologação, se push for testado.
5. Autorizar a correção F-001 (`process-superapp-refund`).

Sem esses itens, **nenhum fluxo autenticado roda** — e nenhum será declarado aprovado.

## 11. Testes que continuam NÃO EXECUTADOS

126 rotas de UI: **90 sem teste** por ausência de autenticação, GPS ou aparelho. As 36 restantes são públicas e foram medidas em navegador.
