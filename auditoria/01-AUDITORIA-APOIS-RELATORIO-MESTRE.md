# 01 — AUDITORIA APOIS · RELATÓRIO MESTRE

**Projeto:** `apoistecnologia-gif/apois-superapp`
**Branch auditada:** `audit/continuacao-20261107`
**Commit local:** `96732c55239ffa819be5817ab522d00fdfcefcf4`
**Commit remoto:** `96732c55239ffa819be5817ab522d00fdfcefcf4` — **sincronizado**
**Data:** 08/11/2026 · **Método:** auditoria documental, sem novas correções de código

---

## 1. Escopo e limites desta entrega

Esta é uma auditoria **documental**. Nenhum código foi alterado, nenhum APK gerado, nenhum build Android executado, nenhum Docker instalado, nenhum projeto Supabase criado, nenhuma dependência pesada instalada. Os processos locais (servidores Playwright nas portas 4183/4200/4201/4202) foram encerrados ao final.

Todo o material reutiliza evidências já produzidas nas Fases 1–11: relatórios em `auditoria/`, screenshots em `qa-visual/`, testes executados e commits já publicados.

## 2. Estado do repositório

| Item | Valor |
|---|---|
| Branch | `audit/continuacao-20261107` |
| HEAD local | `96732c55` |
| HEAD remoto | `96732c55` — **idêntico** |
| Alterações não commitadas | `.vercel/` (untracked, artefato de ferramenta, não é código) |
| `git reset --hard` executado | **não** |
| Merge / deploy | **não** |

### 2.1 Submódulos e pins (`.apois/source-lock.json`)

| Módulo | Repositório | Branch | Commit | Worktree |
|---|---|---|---|---|
| Entregas | `apoistecnologia-gif/apois-entregas` | `fix/courier-dispatch-readiness-20261027` | `2f4606e0` | checked out |
| Corridas passageiro | `apoistecnologia-gif/say-hello-buddy-23-84b5dcbf` | `feat/apois-passageiro-completo` | `7b047f75` | checked out |
| Corridas motorista/admin | `apoistecnologia-gif/movvi-go-connect` | `fix/apois-corridas-consolidacao` | `9fc17105` | checked out |

`npm run verify:pins` aprovado na Fase 2 (após correção do próprio verificador).

## 3. Inventário confirmado por contagem real

| Superfície | Quantidade | Como foi contado |
|---|---:|---|
| Rotas do Cliente Entregas | **37** | `find sources/apois-entregas/src/routes -name "*.tsx"` |
| Rotas do Cliente Corridas | **16** | `ls sources/apois-corridas-passageiro/src/routes/*.tsx` |
| Rotas do Motorista/Admin Corridas | **73** | `find .../apois-corridas-motorista-admin/src/routes -name "*.tsx"` |
| — das quais `admin.*` | **23** | `ls .../admin.*.tsx` |
| — das quais `motorista.*` | **21** | `ls .../motorista.*.tsx` |
| Scripts de integração (`scripts/*.mjs`) | **496** | `ls scripts/*.mjs` |
| Edge Functions do Superapp | **64** | `ls supabase/functions` |
| Edge Functions do snapshot Entregas | **39** | `ls sources/apois-entregas/supabase/functions` |
| Migrations do snapshot Entregas | **163** | `ls .../supabase/migrations/*.sql` |

**Total de rotas de UI: 126.** Os números de relatórios anteriores (37/16/73) foram reconfirmados; o total de scripts cresceu de ~200 para 496 ao longo da auditoria.

## 4. O que foi realmente testado

| Categoria | Testado | Resultado |
|---|---|---|
| Builds de Entregas (4 modos) | sim | customer, courier, merchant, admin compilam |
| Build Corridas passageiro | sim | `✓ built in 2m 14s` |
| Build Motorista | sim | `dist/client/index.html` gerado |
| Typecheck Motorista | sim | `tsc --noEmit` limpo |
| Testes unitários Motorista | sim | 31 pass / 0 fail (via shim Bun) |
| Testes Node de endereço | sim | 53 pass / 0 fail |
| Testes Bun de UF | sim | 4 pass / 0 fail |
| Testes cash isolado | sim | 27 checagens |
| Testes Safe2Pay | sim | 31 testes |
| Verificadores `verify-corridas-*` | sim | 20/20 |
| Verificadores `audit-partner-motorista-*` | sim | 6/6 |
| Hardeners Entregador | sim | 33/33, idempotentes em 2 passadas |
| Smoke Playwright Entregas (4 modos) | sim | 22+6+5+5 rotas, 0 erros |
| Smoke Playwright Corridas | sim | 14 rotas, 0 pageerror |
| Smoke Playwright Motorista | sim | 10 rotas, 2 defeitos |
| Auditoria visual (overflow/alvos) | sim | 15 combinações |
| **Fluxos autenticados** | **não** | bloqueados (§7) |
| **GPS, push, teclado, safe area real** | **não** | sem aparelho |
| **RLS, RPCs, Edge Functions em execução** | **não** | sem Supabase |

## 5. Defeitos: estado real por ID

| ID | App | Descrição | Estado no commit `96732c55` |
|---|---|---|---|
| D-001 | Entregas | travamento em "Validando sessão" ao navegar para rota de outro produto | **CORRIGIDO** (`d9202d74`) — reteste Playwright: 16→308 chars |
| D-002 | Entregas | tela branca `Invariant failed` em cold load de rota de outro produto | **CORRIGIDO** (`d9202d74`) — 3 rotas → 0 |
| D-003 | Entregas | alvos de toque < 44px (links legais, voltar, senha, checkbox, Entrar) | **CORRIGIDO E VALIDADO** (`3898e9d3`) — 6 alvos medidos em 44px |
| D-004 | Motorista | `/motorista/cadastro` renderiza tela vazia (0 chars, 0 inputs) | **ABERTO** — não corrigido |
| D-005 | Motorista | `/motorista/corridas` renderiza e depois esvazia | **ABERTO** — não corrigido |
| C-001 | Corridas | `request-ride` sem valor em centavos na criação | **CORRIGIDO** (`54bdec26`) — 7 testes de contrato; **sem deploy** |
| — | Entregas | UF "Pernambuco" recusada no salvamento | **CORRIGIDO** em commit anterior (`ac305d84`, V9) |
| — | Entregas | GPS perdido ao completar campo vazio | **CORRIGIDO** em commit anterior (V13) |
| — | Entregas | `hasValidCoordinates` e `missingLocationFieldsRef` duplicados (SyntaxError) | **CORRIGIDO** (`7c1b6c00`) |
| — | Entregas | Push navegando por `pathname` em Hash Router | **CORRIGIDO** (`7c1b6c00`) |
| — | Hardeners | não idempotentes (Entregas, Entregador, Admin) | **CORRIGIDO** (`7c1b6c00`, `ae92f1ba`, `5f82e5ea`, `49f7a98e`) |
| — | Pipeline | `.work/partner-motorista` não é criado fora de `build:partner` | **DIAGNOSTICADO** — não alterado |
| — | Financeiro | `process-superapp-refund` com variáveis fora de escopo | **NÃO CORRIGIDO** — aguarda autorização |
| — | Admin | preview Vercel exige Vite em `.work/partner-motorista` e Playwright | **BLOQUEADO POR DEPENDÊNCIA** |
| — | Todos | fluxos autenticados | **BLOQUEADO** — §7 |

## 6. Duplicidades confirmadas

| Item | Situação |
|---|---|
| Hooks declarados 2× por componente | **0** após `component-symbol-dedup` |
| `handleChange` duplicado | **0** |
| Listeners `backButton` duplicados (Entregador) | **0** após correções |
| `stopCourierNativeLocation` repetido | **0** após `-block-dedup` |
| `useEffect` com deps preservadas | 4 em `novo.tsx`, 1 em `editar/$addressId.tsx` |
| Rotas duplicadas entre produtos | não encontradas — isolamento por `routeFileIgnorePattern` funciona |
| Telas equivalentes | não confirmadas (telas autenticadas não observadas) |

## 7. Bloqueios para teste real

| Bloqueio | Impacto | Quem resolve |
|---|---|---|
| Supabase inacessível (sem conector) | nenhum fluxo autenticado, nenhuma RLS testada | você |
| Docker ausente | impossibilita `supabase start` local | você |
| Chaves de mapas ausentes | mapa e Places não homologáveis | você |
| Sem aparelho/emulador | GPS, push, teclado, safe area | você |
| Sem contas sintéticas | nenhum perfil autenticado | você (autorização) |
| Firebase de homologação | push não testável | você |

## 8. Prioridades para correção no GitHub

**P0** — D-004 (cadastro do Motorista vazio), D-005 (histórico instável), `process-superapp-refund` (escopo de variáveis em código financeiro).
**P1** — `.work/partner-motorista` no `prepare:modules`; preview admin (Vite + Playwright).
**P2** — nenhum pendente identificado além dos já corrigidos.
**P3** — nenhum pendente.

## 9. Lacunas desta entrega

- Telas autenticadas: **0 testadas** de 126 rotas.
- RLS, RPCs e Edge Functions: **0 verificadas em execução**.
- Números de linha dos defeitos D-004/D-005 não confirmados — exigem leitura do componente, não feita nesta fase documental.
- Duplicidades dentro de telas logadas não observáveis.

Nada foi declarado homologado sem execução.

## 10. Retificação e execução posterior da Fase 1 — 09/11/2026

**Esta seção atualiza o diagnóstico de 08/11 sem apagar evidências históricas do commit 96732c55.** A situação antiga na seção 7 não deve ser interpretada como estado atual dos bancos conectados.

### Armazenamento (APOIS-001/007 e documentos)
- Em leitura direta do Supabase de Entregas ptgkwyyolrdgnqketkjj, foram encontrados os buckets avatars, product-images, merchant-assets, merchant-documents, courier-documents e support-attachments, todos já com MIME e limite de tamanho configurados. Portanto não falta criar esses buckets no banco atual. Faltavam políticas específicas de upload em merchant-assets e políticas de INSERT/SELECT nos buckets privados de documentos.
- Corrigidas e aplicadas, depois de ensaios SQL BEGIN/ROLLBACK, as migrações: apois_report01_merchant_assets_manager_insert_20261109 (INSERT limitado à loja e logo/capa, 8/8 formatos sintéticos) e apois_report01_private_kyc_storage_policy_20261109 (4 políticas privadas por papel/titularidade, 12/12 formatos sintéticos). Políticas relidas após produção. Nenhuma alteração/exclusão de documento real foi feita.
- O handler de logo/capa do estabelecimento agora tem gerador isolado fix-entregas-merchant-assets-v1.mjs, integrado nos dois builders, caminho versionado, MIME verificado e confirmação do URL no banco em resposta perdida; não apaga cegamente a imagem anterior. Teste de aplicação de geradores em arquivos pinados passou em memória, mas nenhum upload autenticado foi executado.

### Motorista — histórico e cadastros
- OBS-011: o histórico real pinado tinha limite de 50 corridas, sem paginação. Gerador fix-motorista-history-cursor-v1.mjs integrado ao build Motorista e Parceiro, com consulta paginada por (created_at,id) e identidade do motorista. Validação de transformação em memória em duas passadas, mais teste SQL temporário com 105/105 corridas acessíveis em três páginas, 0 duplicações, 0 acesso às 13 de outro motorista. Falta build e teste Android.
- D-004 e D-005 continuam abertos à homologação: foi lido o código da tela de cadastro e histórico do pin, mas não houve reprodução em navegador/Android com sessão real. A paginação OBS-011 não deve ser confundida com a correção comprovada de tela branca ou tela que some.

### Entradas, pagamento e release
- O antigo supabase/functions/process-superapp-refund/index.ts do integrador foi inspecionado: atualmente responde via retiredProvider em modo RETIRED_FAIL_CLOSED; não executa mais o código financeiro histórico. Não reativar o endpoint sem revisão do novo fluxo Safe2Pay.
- O PIN de Entregas tinha lock Bun sem duas dependências Capacitor para login Google. Foi criado reconciliador minimalista para a cópia .work, com integridades conferidas em cinco locks independentes, conectado a ambos os builders e com testes de fixture escritos. Simulação dos objetos originais confirmou 0 diferença após reparo, idempotência e proteção contra adulteração. Sem executar Bun frozen, esse item não está homologado.
- O bloqueio 'Supabase sem conector' da seção 7 foi superado para inspeções e migrações controladas; não significa que existam contas sintéticas, aparelho físico ou autorização para cobranças reais.

**Não encerrar a Fase 1:** ainda faltam D-004/D-005 em runtime, autenticação de todos os papéis, upload privado e imagens reais com contas de teste, GPS/push/teclado/rotação/safe area, Safe2Pay em simulação, types e baseline do banco com testes, além da validação do APK final. Nenhum reporte de conclusão pode usar somente teste de transformação ou SQL sintético.
