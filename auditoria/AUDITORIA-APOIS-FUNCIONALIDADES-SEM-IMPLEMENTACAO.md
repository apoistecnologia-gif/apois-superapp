# AUDITORIA-APOIS-FUNCIONALIDADES-SEM-IMPLEMENTACAO

Funcionalidades que **aparentam existir na interface** mas cuja implementação não foi localizada, está incompleta ou é intencionalmente desativada.

Método: leitura estática de cada rota e dos componentes que ela renderiza. Nenhuma conclusão aqui vem de execução.

---

## 1. Desativadas por decisão de produto (não são defeitos)

### F-01 · Cupons de corrida

| Campo | Valor |
|---|---|
| Rota | `/admin/cupons` |
| Arquivo | `sources/apois-corridas-motorista-admin/src/routes/admin.cupons.tsx` |
| Linhas | 12–40 |
| Interface | Título "Promoções", badge **Indisponível**, `EmptyState` "Nenhuma promoção operacional" |
| Implementação | **ausente por decisão** |
| Justificativa no código | "O schema canônico atual do APOIS Corridas não possui entidade coupons. A implementação antiga dependia de uma tabela legada fora da fonte de verdade e foi retirada" |
| Classificação | **INTENCIONAL — não é defeito** |
| Ação recomendada | nenhuma; se cupons forem necessários, criar entidade no backend canônico e cobrir pelo Fare Engine |

### F-02 · Backup e restore pelo painel

| Campo | Valor |
|---|---|
| Rota | `/admin/backups` |
| Arquivo | `sources/apois-corridas-motorista-admin/src/routes/admin.backups.tsx` |
| Linhas | 12–66 |
| Interface | Dois cards explicativos, badges **Fluxo falso removido** e **Operação de infraestrutura** |
| Implementação | **ausente por decisão** |
| Justificativa no código | "O painel não exporta tabelas inteiras… Não há botão de restaurar dentro do aplicativo. Isso é intencional" |
| Classificação | **INTENCIONAL — não é defeito** |
| Ação recomendada | nenhuma; restore pertence ao plano de infraestrutura do Supabase |

---

## 2. Telas de conteúdo sem controles (esperado)

| # | Rota | Linhas | Botões | Efeitos | Leitura |
|---|---|---:|---:|---:|---|
| F-03 | `/motorista/privacidade` | 108 | 0 | 0 | texto legal estático |
| F-04 | `/motorista/termos` | 114 | 0 | 1 | texto legal, 1 tabela |
| F-05 | `/motorista/preferencias-notificacoes` | 35 | 0 | 0 | composição de componentes, sem estado próprio |
| F-06 | `/motorista/suporte` | 90 | 0 | 0 | delega a `HelpCenterView` |

Ausência de botão é **esperada** nesses casos. Não são funcionalidades sem implementação.

---

## 3. Suspeitas de interface sem lastro — exigem execução

### S-3 · `/perfil/pagamentos` (Entregas)

| Campo | Valor |
|---|---|
| Arquivo | `sources/apois-entregas/src/routes/perfil/pagamentos.tsx` |
| Linhas | 132 |
| Inputs / botões / efeitos | 0 / 1 / **0** |
| Marcadores `TODO/implementar` | 2 |
| Observação | 132 linhas, nenhum efeito, nenhuma tabela, nenhum RPC — não busca dados |
| Suspeita | a tela pode exibir apenas texto estático sobre meios de pagamento, sem refletir o estado real da conta |
| Como confirmar | abrir com sessão e comparar o conteúdo com `payments`/`merchant_subscriptions` |
| Classificação | **SUSPEITA — REQUER VALIDAÇÃO** |

### S-4 · `/apois-plus` (Entregas)

| Campo | Valor |
|---|---|
| Arquivo | `sources/apois-entregas/src/routes/apois-plus.tsx` |
| Linhas | 119 |
| Inputs / botões / efeitos | 0 / 1 / **0** |
| Marcadores | 1 |
| Suspeita | botão único pode navegar para uma tela inexistente ou não fazer nada |
| Como confirmar | clicar e verificar destino com sessão ativa |
| Classificação | **SUSPEITA — REQUER VALIDAÇÃO** |

### S-5 · 22 rotas `admin.*` sem `<button>` no arquivo

| Campo | Valor |
|---|---|
| Rotas | 22 das 23 |
| Observação | controles vêm de `AdminLayout`, `DataTable`, `DSCard` do design system |
| Leitura | reutilização legítima, **não** ausência de implementação |
| Suspeita residual | alguma ação pode existir só como ícone sem `aria-label`, não detectável por regex de `<button>` |
| Como confirmar | abrir com sessão admin e inventariar controles renderizados |
| Classificação | **SUSPEITA — REQUER VALIDAÇÃO** |

### S-1 · `/motorista/cadastro` — render quebrado

| Campo | Valor |
|---|---|
| Arquivo | `sources/apois-corridas-motorista-admin/src/routes/motorista.cadastro.tsx` |
| Linhas | 188–191, 296, 312 |
| Observação | o componente **tem** `return` na linha 296; a tela medida em execução tem 0 caracteres |
| Suspeita | exceção durante o render de `DSSelect`/`DSSelectItem` ou de `useRideFeatureFlags` |
| Classificação | **REPROVADO — DEFEITO CONFIRMADO** (execução) + causa sob suspeita |

### S-2 · `/motorista/corridas` — instabilidade

| Campo | Valor |
|---|---|
| Arquivo | `sources/apois-corridas-motorista-admin/src/routes/motorista.corridas.tsx` |
| Linhas | 238–262 |
| Observação | o efeito trata erro e chama `setRides([])`; a tela deveria mostrar estado de erro, não ficar vazia |
| Suspeita | desmontagem por guard de sessão concorrente |
| Classificação | **REPROVADO — DEFEITO CONFIRMADO** (execução) + causa sob suspeita |

---

## 4. Rotas com marcadores de pendência no código

Contagem por regex `TODO|FIXME|XXX|implementar|not implemented`. **Podem ser falsos positivos** (a palavra "implementar" aparece em texto em português). Listadas para leitura individual, não classificadas como defeito.

| Rota | Marcadores |
|---|---:|
| `admin/motoristas` | 5 |
| `admin/passageiros` | 5 |
| `admin` (Entregas) | 3 |
| `admin/notificacoes` | 2 |
| `motorista/cadastro` | 2 |
| `motorista/configuracoes` | 2 |
| `perfil/pagamentos` | 2 |
| `admin/financeiro`, `admin/precos`, `admin/suporte`, `perfil/legal`, `estabelecimento/$merchantId`, `apois-plus`, `courier`, `merchant` | 1 cada |

---

## 5. Resumo

| Categoria | Quantidade |
|---|---:|
| Desativadas por decisão documentada | **2** (F-01, F-02) |
| Telas de conteúdo sem controles (esperado) | **4** (F-03 a F-06) |
| Suspeitas que exigem execução | **5** (S-1 a S-5) |
| Defeitos confirmados em execução | **2** (D-004, D-005) |
| Funcionalidades declaradas ausentes sem base | **0** |

Nenhuma funcionalidade foi declarada "sem implementação" apenas por não ter botão no arquivo: 22 rotas administrativas usam componentes do design system, o que é reutilização legítima.
