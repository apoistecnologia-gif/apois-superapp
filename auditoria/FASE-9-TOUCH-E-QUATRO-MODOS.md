# APOIS — Fase 9 · D-003 corrigido + quatro modos em navegador

**Branch:** `audit/continuacao-20261107` · **Playwright 1.65.0 + Chromium** · Viewports 360×640, 390×844, 430×932
**Servidores reais:** porta 4183 (customer), 4191/4192/4193 (merchant/courier/admin)

---

## 1. D-003 corrigido e medido de novo

### 1.1 O que foi corrigido

| Elemento | Antes (medido) | Depois (medido) |
|---|---|---|
| "Termos de Uso" (landing) | **65×16** | **84×44** |
| "Privacidade" (landing) | **51×16** | **125×44** |
| Voltar (registro) | **36×36** | **44×44** |
| Mostrar/Ocultar senha | **20×20** | **44×44** |
| Checkbox de termos | **16×16** | **44×44** |
| Link "Entrar" (registro) | **42×44** | **44×44** |

Correção em `scripts/harden-entregas-touch-targets-v17.mjs`, sem alterar texto, rota, handler ou identidade visual: os links legais ganharam `min-h-11` mantendo cor e sublinhado; o Voltar virou `h-11 w-11` com `grid place-items-center`; o botão de senha cresceu em volta do ícone sem deslocar o input; o checkbox desenha o quadrado por `::before` dentro de uma caixa de 44px.

### 1.2 Um erro meu no caminho, registrado

A primeira tentativa usou `after:content-[""]` dentro de uma string JSX com aspas duplas. **Isso quebrou o build** (`Expected ',' or ')' but found string`). Corrigi para `after:content-['']` e, ao medir por hit-test, descobri que o `::after` **não ampliava a área clicável** (16×16, só 20px acima acertava — era o label). A solução final usa `::before` com o controle em 44×44.

### 1.3 Reteste visual — 15 combinações

```
combinações: 15 | com problema: 0
```

Zero overflow horizontal, zero texto cortado, zero alvo < 44px em 360×640, 390×844 e 430×932.

## 2. Quatro modos, builds separados

Cada modo foi **compilado e servido individualmente** — nenhum reutilizou o build `customer`.

| Modo | Build | Servidor | Rotas testadas | Erros de página |
|---|---|---|---|---|
| customer | ✓ 3 etapas | 4183 | 22 | **0** |
| merchant | ✓ | 4191 | 6 | **0** |
| courier | ✓ | 4192 | 5 | **0** |
| admin | ✓ | 4193 | 5 | **0** |

### 2.1 Resultado por modo

**merchant** — todas as rotas caem em `#/login` com formulário de 2 campos (175 caracteres). Isolamento correto: `/courier` e `/admin` não montam.

**courier** — login com `?redirect=%2Fcourier` preservado; `/merchant` e `/admin` redirecionam para o login do entregador. Isolamento correto.

**admin** — `/admin` preserva `?redirect=%2Fadmin`; demais rotas caem no login administrativo (177 caracteres). Isolamento correto.

**Nenhuma tela branca, nenhum `Invariant failed`, nenhum travamento nos quatro modos.**

## 3. Matriz — Fase 9

| App | Tela | O que deveria | O que aconteceu | Status | Gravidade |
|---|---|---|---|---|---|
| Entregas | Landing — links legais | alvo ≥44px | 84×44 e 125×44 | **CORRIGIDO E VALIDADO** | média |
| Entregas | Registro — Voltar | alvo ≥44px | 44×44 | **CORRIGIDO E VALIDADO** | média |
| Entregas | Registro — senha | alvo ≥44px | 44×44 | **CORRIGIDO E VALIDADO** | média |
| Entregas | Registro — checkbox | alvo ≥44px | 44×44 | **CORRIGIDO E VALIDADO** | média |
| Entregas | Registro — link Entrar | alvo ≥44px | 44×44 | **CORRIGIDO E VALIDADO** | baixa |
| Entregas | 22 rotas customer | sem erro | 0 erros | **APROVADO** | — |
| Entregas | 6 rotas merchant | isolamento | login, sem erro | **APROVADO (não autenticado)** | — |
| Entregas | 5 rotas courier | isolamento | login, sem erro | **APROVADO (não autenticado)** | — |
| Entregas | 5 rotas admin | isolamento | login, sem erro | **APROVADO (não autenticado)** | — |
| Todos | telas autenticadas | funcionar | — | **NÃO TESTADO** | crítica |
| Todos | GPS, push, teclado, safe area | funcionar | — | **NÃO TESTADO** | — |

## 4. O que continua sem resposta

- **Nenhuma tela autenticada foi aprovada.** Sem Supabase, todo fluxo logado para no login. Não há como afirmar que sacola, checkout, painel do estabelecimento, operação do entregador ou admin funcionam.
- **Formulários não foram submetidos.** Preencher e enviar exigiria backend; validar apenas o front não prova persistência.
- **Botões autenticados não foram clicados.** Os únicos botões exercitados foram navegação pública (termos, privacidade, voltar, login).
- **Duplicidades visuais dentro das telas logadas** não puderam ser observadas.

## 5. Arquivos desta fase

```
scripts/harden-entregas-touch-targets-v17.mjs
qa-visual/visual-audit.mjs      overflow, alvos, texto cortado (15 combinações)
qa-visual/hit-targets.mjs       hit-test de área real de toque
qa-visual/checkbox-hit.mjs      prova de 44x44 no checkbox
qa-visual/multi-mode.mjs        build + servidor + smoke por modo
qa-visual/v-*.png               capturas por rota e viewport
```
