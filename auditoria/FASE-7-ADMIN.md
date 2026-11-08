# APOIS — Fase 7 · Painéis administrativos

**Branch:** `audit/continuacao-20261107` · **Método:** builds reais, hardeners executados duas vezes, gates de documentos. Sem Supabase, sem aparelho.

---

## 1. Inventário

**Admin Entregas** (`VITE_APOIS_PRODUCT_MODE=admin`, snapshot `2f4606e0`): rota `admin.tsx` + painéis `AdminOrdersPanel`, `AdminCourierSettlementsPanel`, `AdminCoveragePanel`, `AdminMerchantCreateDialog`, `AdminRealtimeOperationsPanel`, `AdminReviewsPanel`, `AdminSupportPanel`.

**Admin Corridas** (`sources/apois-corridas-motorista-admin`, pin `9fc17105`, 23 rotas): `admin.login`, `admin.dashboard`, `admin.motoristas`, `admin.passageiros`, `admin.corridas`, `admin.operacoes`, `admin.mapa`, `admin.financeiro`, `admin.financeiro-motoristas`, `admin.pagamentos`, `admin.assinaturas`, `admin.precos`, `admin.categorias`, `admin.cupons`, `admin.administradores`, `admin.notificacoes`, `admin.relatorios`, `admin.analytics`, `admin.logs`, `admin.seguranca`, `admin.suporte`, `admin.backups`, `admin.configuracoes`.

## 2. Execuções reais

| Verificação | Resultado |
|---|---|
| Build Admin Entregas (`admin`) | **✓ 3 etapas compiladas** |
| 13 hardeners/fixes `*admin*` | **11/13 OK** após correções |
| Idempotência (2 passadas consecutivas) | **11/13 estáveis**, 2 bloqueados por dependência |
| `test-admin-preview-private-documents-v1` | **OK** — 405/503/401/400/403, sem URL antes da autorização, sem cache |

## 3. Defeitos encontrados e corrigidos

| # | Script | Causa raiz | Correção |
|---|---|---|---|
| 1 | `fix-partner-admin-legacy-brand-v1` | exigia `Mapa ao Vivo — Admin MOVVI`; o snapshot já estava em APOIS | aceita marca já convertida, falha só se ainda houver MOVVI |
| 2 | `fix-admin-guard-navigation-v1` | `throw` quando o marcador `APOIS_ADMIN_GUARD_NAV_CACHE_V1` já existia — **não idempotente** | encerra com 0 e registra "já aplicado" |
| 3 | `fix-partner-admin-pendencies-preview-v1` | falhava em cascata pelo nº 1 | resolvido |

## 4. Bloqueados por dependência externa (não são defeitos de produto)

| Script | Motivo | Status |
|---|---|---|
| `build-corridas-admin-spa-v1` | exige `node_modules/vite` em `.work/partner-motorista` e o snapshot `admin-preview/original-admin-auth-snapshot.json`; só roda dentro de `build-admin-vercel-preview.sh` | **BLOQUEADO POR DEPENDÊNCIA** |
| `audit-admin-preview-render-v2` | exige **Playwright** (`APOIS_PLAYWRIGHT_ROOT`) e o `dist/admin-preview` gerado pelo anterior | **BLOQUEADO POR DEPENDÊNCIA** |

Ambos são exclusivos do **preview Vercel** do Admin Corridas, não estão em `package.json` e não entram no APK.

## 5. Matriz — Fase 7

| Sistema | Função | Status | Gravidade | Evidência |
|---|---|---|---|---|
| Admin Entregas | Build | **APROVADO** | crítica | 3 etapas |
| Admin Entregas | Endpoint privado de documentos | **APROVADO (teste)** | crítica | suíte dedicada |
| Admin Entregas | Contraste/legibilidade dos painéis (7 fixes) | **APROVADO** | média | 7/7 OK |
| Admin Corridas | Marca APOIS nos títulos | **APROVADO** | baixa | hardener |
| Admin Corridas | Guarda de navegação com revalidação | **APROVADO (código)** | alta | marcador + cache por aba |
| Admin Corridas | Preview Vercel (SPA + render) | **BLOQUEADO POR DEPENDÊNCIA** | — | falta Playwright/dist |
| Ambos | Login, permissões, aprovação de parceiros, financeiro | **NÃO EXECUTADO (UI)** | crítica | precisa Supabase + sessão admin |
| Ambos | Isolamento de dados e escalada de privilégio | **BLOQUEADO POR ACESSO** | crítica | sem RLS testável |

## 6. Observação de segurança registrada

`fix-admin-guard-navigation-v1` documenta que o cache de autorização é **por aba e por navegação**, com revalidação no Supabase a cada mudança de rota, e que "server/RLS permanece autoritativo; nenhum privilégio é introduzido ou armazenado localmente". Isso é coerente com o código, mas **não foi verificado adversarialmente** — exige RLS real.

## 7. Bloqueios mantidos

Supabase inacessível, mapas sem chave, zero teste físico. Nenhuma tela administrativa homologada em UI.
