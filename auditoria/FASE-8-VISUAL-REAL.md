# APOIS — Fase 8 · Auditoria visual e funcional real (Playwright)

**Branch:** `audit/continuacao-20261107` · **Build:** `customer` (`APOIS_MOBILE_BUILD=1`, Nitro preset node) · **Viewports:** 360×640, 390×844, 430×932
**Ferramenta:** Playwright 1.65.0 + Chromium, instalados nesta sessão. Servidor real em `127.0.0.1:4175`.

Esta fase muda o método: até aqui a evidência era código e build. Aqui os apps foram **abertos em navegador e medidos**.

---

## 1. Dois defeitos que só aparecem usando o app — corrigidos

### 1.1 D-001 · Rota de outro produto travava o app em "Validando sessão"

**Reprodução:** abrir `#/`, esperar a landing, então navegar para `#/courier`.

**Medição antes:** em 2s, 6s, 15s e 30s após a navegação, a tela continuava com **16 caracteres** de texto (`"Validando sessão"`) e hash `#/`. Nunca saía.

**Causa raiz:** `AuthSessionIsolation` detecta rota de outro produto, chama `window.location.replace('#/')` e retorna **sem** `setReady(true)`. O efeito tem dependências `[]`, então não roda de novo — o spinner fica permanente.

**Correção:** `scripts/harden-entregas-product-route-redirect-hang.mjs` marca a sessão como resolvida antes do redirect.

**Medição depois:** 308 caracteres de conteúdo em 2s, 6s, 15s e 30s. Estável.

### 1.2 D-002 · Cold load em rota de outro produto derrubava o app

**Reprodução:** abrir diretamente `#/courier`, `#/merchant` ou `#/admin` no build do Cliente.

**Medição antes:** `Error: Invariant failed`, **0 caracteres** de texto, tela em branco. O stack aponta para o matcher do router (`useStore`), antes de qualquer redirect.

**Causa raiz:** essas rotas são removidas da árvore por `routeFileIgnorePattern`, mas o hash ainda chega ao matcher na primeira resolução. O `AuthSessionIsolation` redireciona depois — tarde demais.

**Correção:** `scripts/harden-entregas-cold-route-invariant.mjs` normaliza o hash **antes** de `createRouter`, usando `isPathAllowedForProduct` e `getProductLandingRoute`.

**Medição depois:** as 3 rotas deixam de produzir erro; o app cai na landing.

---

## 2. Smoke test de 22 rotas — resultado real

Executado em `390×844` com Hash Router (o app usa `createHashHistory`; testar por pathname cai sempre na landing e não mede nada).

| Resultado | Rotas |
|---|---|
| **Renderizam conteúdo** | `/`, `/register`, `/termos`, `/privacidade` |
| **Redirecionam para login com `?redirect=`** (comportamento correto sem sessão) | `/inicio`, `/enderecos`, `/enderecos/novo`, `/pedidos`, `/perfil`, `/sacola`, `/checkout`, `/buscar`, `/favoritos`, `/notificacoes`, `/perfil/pagamentos`, `/perfil/ajuda`, `/perfil/legal`, `/apois-plus` |
| **Bloqueadas por produto → landing** | `/merchant`, `/courier`, `/admin` |

**Antes das correções: 3 rotas com tela vazia e `Invariant failed`. Depois: 0.**

## 3. Auditoria visual — overflow, alvos de toque e corte de texto

15 combinações (5 telas × 3 viewports):

| Verificação | Resultado |
|---|---|
| Overflow horizontal (`scrollWidth - clientWidth`) | **0 em todas as 15 combinações** |
| Texto cortado (`scrollWidth > clientWidth`) | **0 em todas** |
| Alvos de toque < 44px | **encontrados em 2 telas** (abaixo) |

### D-003 · Alvos de toque pequenos (DEFEITO CONFIRMADO — não corrigido)

| Tela | Elemento | Dimensão medida |
|---|---|---|
| `/` (landing) | link "Termos de Uso" | **65×16** |
| `/` (landing) | link "Privacidade" | **51×16** |
| `/register` | botão voltar | **36×36** |
| `/register` | ícones internos | 20×20, 16×16 |

Altura de 16px está bem abaixo do mínimo de 44px recomendado para toque no Android. **Não corrigi** porque altera layout de telas legais/registro e exige reteste visual — fica registrado para decisão.

## 4. Duplicidades e efeitos React — verificação

| Verificação | Resultado |
|---|---|
| Hooks duplicados por componente (todo `src/`) | **0** — contrato de `harden-entregas-component-symbol-dedup.mjs` |
| `useEffect` com dependências preservadas | **4 em `novo.tsx`, 1 em `editar/$addressId.tsx`** |
| Listeners duplicados de `backButton` no Entregador | **0** após correções da Fase 5 |
| Chamadas `stopCourierNativeLocation` duplicadas | **0** após `-block-dedup` |
| `handleChange` duplicado | **0** |

## 5. Matriz — Fase 8

| App | Tela/Rota | O que deveria | O que aconteceu | Status | Gravidade | Evidência |
|---|---|---|---|---|---|---|
| Entregas | `#/courier` (navegação) | redirecionar | preso em "Validando sessão" 30s | **CORRIGIDO — RETESTE PENDENTE** | crítica | 16 chars antes / 308 depois |
| Entregas | `#/courier` `#/merchant` `#/admin` (cold) | redirecionar | `Invariant failed`, tela branca | **CORRIGIDO — RETESTE PENDENTE** | crítica | 0 chars → landing |
| Entregas | `/` | landing | renderiza, 308 chars | **APROVADO** | — | Playwright |
| Entregas | `/login` | form 2 inputs | renderiza | **APROVADO** | — | Playwright |
| Entregas | `/register` | form 8 inputs | renderiza | **APROVADO** | — | Playwright |
| Entregas | `/termos` `/privacidade` | texto legal | 4753 / 6646 chars | **APROVADO** | — | Playwright |
| Entregas | 14 rotas autenticadas | exigir sessão | redirect `?redirect=` correto | **APROVADO** | — | Playwright |
| Entregas | `/` e `/register` | alvos ≥44px | 16px e 36px | **DEFEITO CONFIRMADO** | média | medição |
| Entregas | overflow horizontal | 0 | 0 em 15/15 | **APROVADO** | — | medição |
| Todos | fluxos autenticados reais | funcionar | — | **NÃO TESTADO** | crítica | sem Supabase |
| Todos | GPS, push, teclado Android | funcionar | — | **NÃO TESTADO** | — | sem aparelho |

## 6. Bloqueios mantidos

- **Supabase**: sem acesso. Nenhum fluxo autenticado pôde ser exercitado — todas as telas logadas param no redirect de login.
- **Aparelho**: GPS, push, teclado, safe area real e gestos **NÃO TESTADOS**.
- **Mapas**: sem chave; mapa não renderiza.
- **Merchant/courier/admin builds**: o smoke cobre apenas o build `customer`. Os demais exigem servidor próprio por modo.

## 7. Arquivos desta fase

```
qa-visual/smoke.mjs               smoke por pathname (mostra que o app é hash-router)
qa-visual/hash-smoke.mjs          22 rotas por hash, com erros de página
qa-visual/hang3.mjs               medição temporal do travamento
qa-visual/visual-audit.mjs        overflow, alvos de toque, texto cortado
qa-visual/*.png                   capturas das telas medidas
scripts/harden-entregas-product-route-redirect-hang.mjs
scripts/harden-entregas-cold-route-invariant.mjs
```
