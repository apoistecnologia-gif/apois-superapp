# AUDITORIA-APOIS-90-ROTAS-PENDENTES

**Branch:** `audit/continuacao-20261107` @ `298422fa` · **Método:** leitura estática do arquivo real de cada rota, com extração automatizada de elementos interativos, handlers, RPCs, Edge Functions, tabelas e navegação (`auditoria/extract-rotas.mjs`).
**Classificação padrão:** `AUDITADO ESTATICAMENTE — EXECUÇÃO PENDENTE`. Nenhuma rota aqui foi marcada como testada em execução.

---

## 1. Escopo efetivamente inspecionado

| Métrica | Valor |
|---|---:|
| Rotas pendentes na matriz anterior | 90 |
| Rotas com arquivo localizado e lido | **72** |
| Rotas cujo arquivo não foi localizado | 0 |
| Diferença 90 → 72 | 18 rotas da lista anterior eram sub-rotas do mesmo arquivo (ex.: `pedido/$orderId` e `pedido/$orderId/index`), ou pertencem a builds sem arquivo próprio (`/admin` e `/motorista/app` do build do passageiro, já medidas em execução) |

As 72 rotas abaixo foram **individualmente abertas e analisadas**. O CSV `AUDITORIA-APOIS-90-ROTAS-DETALHADA.csv` traz a extração completa por rota.

---

## 2. Achados confirmados por leitura de código

### 2.1 D-004 — causa raiz localizada

**Arquivo:** `sources/apois-corridas-motorista-admin/src/routes/motorista.cadastro.tsx`
**Linhas:** 39–46 (rota), 188–191 (componente), 296 (render), 312 (select de categoria)

```tsx
component: DriverSignUpPage,          // linha 46 — sem beforeLoad, sem guarda
const availableCategories = CATEGORIES.filter((c) => isRideCategoryEnabled(c, flags));  // 191
<DSSelect name="category" defaultValue="carros"> ... {availableCategories.map(...)}      // 312
```

O componente **renderiza** (`return` na linha 296). O que quebra é o `<DSSelect>`: `defaultValue="carros"` é fixo, mas as opções vêm de `availableCategories`. Com `get_ride_feature_flags` indisponível (sem sessão), `useRideFeatureFlags` devolve `DISABLED_RIDE_FEATURE_FLAGS`, que desliga `guincho` e `fretes` — mas `carros` continua habilitado, então a lista não fica vazia.

**Conclusão revista:** a hipótese anterior ("retorno antecipado") está **descartada**. O componente tem `return`. A tela vazia medida em Playwright (0 chars, 0 inputs) é compatível com **exceção em tempo de execução durante o render**, não com guarda. O suspeito direto é `DSSelect`/`DSSelectItem` do design system sendo renderizado fora de um provider, ou `useRideFeatureFlags` lançando antes do primeiro `setFlags`.

**Status:** `REPROVADO — DEFEITO CONFIRMADO` (execução) + `SUSPEITA FUNDAMENTADA` (causa exata). Precisa de `page.on('pageerror')` capturado no momento do render para fechar o diagnóstico.

### 2.2 D-005 — causa raiz localizada

**Arquivo:** `sources/apois-corridas-motorista-admin/src/routes/motorista.corridas.tsx`
**Linhas:** 238–262

```tsx
const profile = await loadDriverProfile();
if (!profile.ok) { setError("Não foi possível identificar seu cadastro de motorista."); setRides([]); return; }
...
if (ridesError) { setError("Não foi possível carregar seu histórico de corridas agora."); setRides([]); return; }
```

Sem sessão, `loadDriverProfile()` falha, `setRides([])` zera a lista e `setError` preenche a mensagem. A tela **não fica vazia** — mostra o estado de erro. A medição de 0 caracteres na segunda execução é compatível com o componente sendo desmontado por redirect concorrente do guard de sessão, não com o efeito em si.

**Status:** `REPROVADO — DEFEITO CONFIRMADO` (instabilidade medida) + `SUSPEITA FUNDAMENTADA` (desmontagem por guard). Precisa de captura de `pageerror` e de observação de navegação durante a medição.

### 2.3 Funcionalidades de interface sem implementação real

| Rota | Arquivo:linha | O que a tela mostra | Implementação |
|---|---|---|---|
| `admin/cupons` | `admin.cupons.tsx:12–40` | "Promoções" com badge **Indisponível** | **intencionalmente ausente** — texto explica que o schema não possui `coupons` |
| `admin/backups` | `admin.backups.tsx:12–66` | "Backups" com badge **Operação de infraestrutura** | **intencionalmente ausente** — sem botão de restore por decisão de segurança |
| `motorista/suporte` | `motorista.suporte.tsx:1–90` | shell de suporte | delega a `HelpCenterView`; 90 linhas, 0 botões próprios |
| `motorista/preferencias-notificacoes` | `motorista.preferencias-notificacoes.tsx` (35 linhas) | preferências | **35 linhas, 0 inputs, 0 botões, 0 efeitos** — apenas composição |
| `motorista/privacidade` | `motorista.privacidade.tsx` (108 linhas) | texto legal | 0 botões, 0 efeitos — conteúdo estático |
| `motorista/termos` | `motorista.termos.tsx` (114 linhas) | texto legal | 0 botões, 1 tabela |

As duas primeiras são **decisões de produto documentadas no próprio código**, não defeitos. As quatro restantes são telas de conteúdo — ausência de botão é esperada.

### 2.4 Rotas com marcadores de pendência no código

| Rota | Marcadores | Leitura |
|---|---:|---|
| `admin` (Entregas) | 3 | investigar |
| `admin/motoristas` | 5 | investigar |
| `admin/passageiros` | 5 | investigar |
| `admin/notificacoes` | 2 | investigar |
| `motorista/cadastro` | 2 | investigar |
| `motorista/configuracoes` | 2 | investigar |
| `perfil/pagamentos` (Entregas) | 2 | investigar |
| `admin/financeiro`, `admin/precos`, `admin/suporte`, `perfil/legal`, `estabelecimento/$merchantId`, `apois-plus`, `courier`, `merchant` | 1 cada | investigar |

Marcadores contados por regex `TODO|FIXME|XXX|implementar|not implemented` — podem incluir falsos positivos (texto em português com "implementar"). **Não classificados como defeito sem leitura individual.**

### 2.5 Rotas administrativas sem `<button>` no arquivo

22 das 23 rotas `admin.*` têm `buttons = 0`. Isso **não** significa ausência de interação: os controles vêm de `AdminLayout`, `DataTable`, `DSCard` e componentes do design system. É reutilização legítima, não duplicidade. Confirmado por leitura de `admin.cupons.tsx` e `admin.backups.tsx`, que usam `DSCard`/`EmptyState`/`DSBadge`.

### 2.6 Rotas de passageiro com arquivo mínimo

| Rota | Linhas | Leitura |
|---|---:|---|
| `_authenticated.corridas` | 10 | delega a um componente de histórico |
| `_authenticated.carteira` | 10 | delega a um componente de carteira |

Não são telas vazias: são wrappers finos. **Reutilização legítima.**

---

## 3. Fichas técnicas por rota

Formato compacto: `rota · linhas · inputs/botões · efeitos · RPC/Edge/tabelas · navegação · estados`.

### 3.1 Entregas · Cliente (19 rotas)

| Rota | L | in/btn | eff | RPC / Edge / tabelas | nav | Estados |
|---|---:|---|---:|---|---|---|
| `enderecos/editar/$addressId` | 336 | 8/2 | 1 | — / — / `customer_addresses` | 1 | loading, erro, vazio |
| `pedido/$orderId` | 603 | 0/4 | 1 | 1 / 1 / 3 | 2 | loading, erro |
| `pedido/$orderId/avaliar` | 307 | 0/5 | 1 | 1 / — / 2 | 2 | loading, erro |
| `pedido/confirmado` | 215 | 0/3 | 1 | — / — / 1 | 3 | loading |
| `sacola` | 334 | 0/7 | 1 | — / — / 1 | 3 | loading, vazio |
| `checkout` | 1185 | 0/7 | 8 | — / 3 / 3 | 4 | loading, erro |
| `buscar` | 798 | 1/10 | 3 | — / — / 2 | 4 | loading, erro, vazio |
| `favoritos` | 286 | 0/6 | 1 | — / 1 / 0 | 4 | loading, vazio |
| `notificacoes` | 340 | 0/4 | 1 | — / — / 0 | 3 | loading, vazio |
| `perfil` | 190 | 0/6 | 1 | — / — / 1 | 4 | loading |
| `perfil/dados-pessoais` | 474 | 0/4 | 1 | — / — / 2 | 2 | loading, erro |
| `perfil/pagamentos` | 132 | 0/1 | 0 | — / — / 0 | 1 | **sem loading, 2 marcadores** |
| `perfil/ajuda` | 369 | 0/7 | 1 | — / 1 / 0 | 2 | loading, erro |
| `perfil/legal` | 173 | 0/3 | 1 | — / — / 0 | 3 | 1 marcador |
| `perfil/notificacoes` | 252 | 0/1 | 1 | — / — / 1 | 1 | loading |
| `estabelecimento/$merchantId` | 607 | 0/8 | 2 | — / 1 / 0 | 2 | loading, vazio |
| `apois-plus` | 119 | 0/1 | 0 | — / — / 0 | 1 | **sem loading, 1 marcador** |
| `chamado-suporte/$ticketId` | 281 | 0/3 | 1 | — / 1 / 0 | 1 | loading, erro |
| `perfil/ajuda/chamado/$ticketId` | 454 | 0/6 | 2 | — / 1 / 0 | 1 | loading, erro |

### 3.2 Entregas · Entregador / Estabelecimento / Admin (4 rotas)

| Rota | L | in/btn | eff | RPC / Edge / tabelas | nav | Estados |
|---|---:|---|---:|---|---|---|
| `courier` | 978 | 0/1 | 4 | — / — / 1 | 1 | loading, erro, 1 marcador |
| `merchant` | 2568 | 1/7 | 3 | — / 2 / 1 | 2 | loading, erro, 1 marcador |
| `configuracoes-estabelecimento` | 472 | 0/4 | 1 | — / — / 0 | 1 | loading |
| `admin` | 2153 | 0/6 | 3 | — / 1 / 1 | 1 | loading, 3 marcadores |

### 3.3 Corridas · Passageiro (8 rotas)

| Rota | L | in/btn | eff | RPC / Edge / tabelas | nav | Estados |
|---|---:|---|---:|---|---|---|
| `inicio` | 326 | 0/6 | 0 | — / — / 0 | 2 | loading |
| `buscar-destino` | 385 | 0/8 | 1 | — / — / 0 | 1 | loading, vazio |
| `revisar-solicitacao` | 235 | 0/1 | 0 | — / — / 0 | 2 | loading |
| `corrida/$rideId` | 287 | 0/4 | 1 | — / — / 0 | 1 | loading, erro |
| `corridas` | 10 | 0/0 | 0 | — / — / 0 | 0 | wrapper |
| `carteira` | 10 | 0/0 | 0 | — / — / 0 | 0 | wrapper |
| `notificacoes` | 283 | 0/4 | 1 | — / — / 1 | 0 | loading, vazio |
| `perfil` | 165 | 0/1 | 0 | — / — / 0 | 1 | loading |

### 3.4 Corridas · Motorista (21 rotas)

| Rota | L | in/btn | eff | RPC / Edge / tabelas | nav | Estados |
|---|---:|---|---:|---|---|---|
| `motorista/cadastro` | 390 | 0/6 | 0 | — / — / 0 | 2 | **D-004, 2 marcadores** |
| `motorista/corridas` | 546 | 0/0 | 1 | — / — / 2 | 2 | **D-005** |
| `motorista/corridas/$id` | 562 | 0/0 | 1 | 1 / — / 3 | 2 | loading, erro |
| `motorista/ganhos` | 326 | 0/5 | 1 | — / — / 0 | 1 | loading |
| `motorista/carteira` | 496 | 0/5 | 2 | 1 / — / 4 | 1 | loading, erro |
| `motorista/perfil` | 486 | 0/1 | 2 | 1 / — / 0 | 7 | loading |
| `motorista/documentos` | 205 | 0/4 | 2 | — / — / 0 | 2 | loading |
| `motorista/assinatura` | 283 | 0/1 | 2 | — / — / 2 | 2 | loading |
| `motorista/configuracoes` | 484 | 0/1 | 1 | — / 1 / 0 | 7 | 2 marcadores |
| `motorista/seguranca` | 397 | 0/6 | 2 | 4 / — / 1 | 0 | loading, erro |
| `motorista/notificacoes` | 289 | 0/4 | 2 | — / — / 1 | 0 | loading, vazio |
| `motorista/suporte` | 90 | 0/0 | 0 | — / — / 0 | 0 | delega |
| `motorista/regalias` | 230 | 0/2 | 2 | — / — / 0 | 2 | loading |
| `motorista/status` | 430 | 0/2 | 1 | — / — / 0 | 5 | loading |
| `motorista/preferencias-notificacoes` | 35 | 0/0 | 0 | — / — / 0 | 0 | composição |
| `motorista/app` | 3280 | 0/23 | 24 | — / — / 2 | 3 | loading, erro — **maior arquivo do ecossistema** |
| `motorista/privacidade` | 108 | 0/0 | 0 | — / — / 0 | 0 | estático |
| `motorista/termos` | 114 | 0/0 | 1 | — / — / 1 | 0 | estático |

### 3.5 Corridas · Admin (23 rotas)

| Rota | L | in/btn | eff | RPC / Edge / tabelas | nav | Estados |
|---|---:|---|---:|---|---|---|
| `admin/login` | 120 | 0/0 | 0 | — / — / 0 | 1 | form em componente |
| `admin/dashboard` | 440 | 0/0 | 3 | — / — / 2 | 3 | loading |
| `admin/motoristas` | 538 | 0/0 | 1 | — / — / 1 | 0 | **5 marcadores** |
| `admin/passageiros` | 521 | 0/0 | 1 | — / — / 2 | 0 | **5 marcadores** |
| `admin/corridas` | 272 | 0/0 | 1 | — / — / 2 | 0 | loading |
| `admin/operacoes` | 631 | 0/0 | 1 | — / — / 4 | 0 | loading |
| `admin/mapa` | 325 | 0/0 | 1 | — / — / 2 | 0 | loading |
| `admin/financeiro` | 426 | 0/1 | 2 | — / — / 0 | 0 | 1 marcador |
| `admin/financeiro-motoristas` | 414 | 0/0 | 1 | — / — / 3 | 0 | loading |
| `admin/pagamentos` | 179 | 0/0 | 1 | — / — / 0 | 0 | loading |
| `admin/assinaturas` | 316 | 0/0 | 1 | — / — / 1 | 0 | loading |
| `admin/precos` | 649 | 0/0 | 2 | — / — / 2 | 0 | 1 marcador |
| `admin/categorias` | 374 | 0/0 | 1 | — / — / 1 | 0 | loading |
| `admin/cupons` | 42 | 0/0 | 0 | — / — / 0 | 0 | **indisponível por decisão** |
| `admin/administradores` | 215 | 0/0 | 1 | — / — / 1 | 0 | loading |
| `admin/notificacoes` | 377 | 0/0 | 2 | — / — / 0 | 0 | 2 marcadores |
| `admin/relatorios` | 317 | 0/0 | 1 | — / — / 7 | 0 | loading |
| `admin/analytics` | 341 | 0/1 | 1 | — / — / 1 | 0 | loading |
| `admin/logs` | 257 | 0/0 | 2 | — / — / 1 | 0 | loading |
| `admin/seguranca` | 246 | 0/0 | 1 | — / — / 1 | 3 | loading |
| `admin/suporte` | 411 | 0/0 | 1 | — / — / 2 | 0 | 1 marcador |
| `admin/backups` | 69 | 0/0 | 0 | — / — / 0 | 0 | **indisponível por decisão** |
| `admin/configuracoes` | 269 | 0/0 | 1 | 1 / — / 0 | 0 | loading |

---

## 4. Duplicidades — investigação fundamentada

| Categoria | Método | Resultado | Confiança |
|---|---|---|---|
| Hooks duplicados por componente | varredura de todo `src/` + contrato de hardener | 0 | **alta** (verificado por código) |
| `handleChange` duplicado | contrato V16 | 0 | alta |
| Listeners `backButton` | inspeção de `courier.tsx` | 0 | alta |
| `stopCourierNativeLocation` em sequência | contrato `-block-dedup` | 0 | alta |
| Rotas duplicadas entre produtos | `routeFileIgnorePattern` + 404 medido | 0 | alta |
| Telas equivalentes | comparação de propósito por rota | **não confirmadas** | **baixa** — exige execução |
| Menus/abas duplicados em telas logadas | não observável | **não verificado** | **nenhuma** |
| Requisições repetidas ao Supabase | exigiria `page.on('request')` com sessão | **não verificado** | **nenhuma** |

**Correção da afirmação anterior:** "zero duplicidades ativas" é válido apenas para as cinco primeiras linhas, que têm verificação por código. Para menus, abas e requisições em telas autenticadas, o correto é **não verificado** — não "zero".

---

## 5. Suspeitas que precisam de execução para virar defeito

| # | Suspeita | Rota | Como confirmar |
|---|---|---|---|
| S-1 | `DSSelect`/`useRideFeatureFlags` lança durante o render | `motorista/cadastro` | capturar `pageerror` no instante do render |
| S-2 | guard de sessão desmonta o componente durante a medição | `motorista/corridas` | observar navegação concorrente |
| S-3 | `perfil/pagamentos` (132 linhas, 0 efeito, 0 loading) pode exibir dados estáticos | `perfil/pagamentos` | abrir com sessão e comparar com o banco |
| S-4 | `apois-plus` (119 linhas, 1 botão, 0 efeito) pode ser apenas informativa | `apois-plus` | clicar o botão e verificar destino |
| S-5 | 22 rotas admin sem `<button>` podem ter ações só no `AdminLayout` | `admin/*` | abrir com sessão admin e inventariar controles renderizados |

---

## 6. Cobertura desta entrega

| Item | Valor |
|---|---:|
| Rotas inspecionadas por leitura de arquivo | **72** |
| Rotas com ficha técnica neste documento | **72** |
| Rotas marcadas AUDITADO ESTATICAMENTE | 72 |
| Rotas marcadas TESTADO EM EXECUÇÃO | **0** (nenhuma nova) |
| Defeitos confirmados | 2 (D-004, D-005) |
| Suspeitas fundamentadas | 5 |
| Funcionalidades sem implementação real | 2 intencionais + 4 telas de conteúdo |

Nenhuma rota foi declarada homologada. Nenhuma correção foi feita nesta fase.
