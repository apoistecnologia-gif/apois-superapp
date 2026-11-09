# APOIS — Relatório de Execução Visual 03 — Motorista

**Data:** 09/11/2026  
**Arquivo de entrada:** `RELATORIO-VISUAL-03-APOIS-MOTORISTA-20261109(1).md`  
**Repositório:** `apoistecnologia-gif/apois-superapp`  
**Única branch alterada:** `audit/continuacao-20261107`  
**Identificadores:** VIS-014–016 => CV-013–015. Retificação de VIS-007 / CV-006 sem gerar novo achado.

## 1. Ponto inicial confirmado

- Snapshot Motorista/Admin protegido: `apoistecnologia-gif/movvi-go-connect@9fc171050d8b5703540c49d19a8f1e9f5162775f`, verificado por leitura de `src/routes/motorista.app.tsx`, inclusive `RatingScreen`.
- Integrador: `.apois/source-lock.json`, SHA blob pré/pós alterações `3f98789f28666ccc052175db10f138208dd0937b`; arquivo NÃO editado.
- Verificada ordem do builder Motorista: `fix-partner-input-contrast-v1.mjs` (login) antes de `fix-partner-motorista-ride-visual-v7.mjs` (avaliação), seguida por ajustes finais de rota/drawer e relatório técnico 03/07. O overlay desta rodada é executado no workspace descartável depois dessas etapas, antes do typecheck/build.
- No snapshot o grupo usa `[1,2,3,4,5].map(n)` com botões `onClick={() => setStars(n)}` sem nome/estado acessível; textarea tem apenas `placeholder="Comentário (opcional)"`. V7 prepara fundo claro e placeholder `#8A9098` sobre branco, **sem cobrir esses pontos**.
- O login já recebe `#596372 !important` por `fix-partner-input-contrast-v1.mjs` no escopo auth. **Retificação confirmada**: não há justificativa para duplicar correção VIS-007 no login sem nova evidência de erro real.

## 2. Correções aplicadas no gerador, NÃO no APK

| CV | Intervenção visual | Preservação | Estado |
|---|---|---|---|
| CV-013 / VIS-014 | Grupo `role=group` nomeado “Nota do passageiro”, cinco botões com `aria-label` de 1 a 5 estrelas e `aria-pressed={stars === n}`, tamanho mínimo 44×44px, foco visível | Não altera valor `stars`, `setStars(n)`, escala ou `onSubmit` | **Implementado em gerador; Android/TalkBack não testado** |
| CV-014 / VIS-015 | `label` visível “Comentário (opcional)” associado a `textarea#apois-driver-rating-comment` via `htmlFor` e `id` | `value={comment}`, `onChange`, envio/pular/retry mantidos | **Implementado em gerador; DOM final não testado** |
| CV-015 / VIS-016 | Texto da dica `#8A9098` (3,22:1 em branco) substituído por `#596372` (6,08:1); CSS `::placeholder` reforçado **somente** na textarea dentro de `data-apois-driver-rating-readable-v7` | Sem substituição de tokens globais, login ou qualquer outro campo | **Implementado em gerador; CSS computado do APK ainda pendente** |

Os rótulos e ajustes são incrementais e não reimplementam o RatingScreen. Mantêm apresentação branca/vermelha, oferta abaixo da barra Android, modal rolável com margem inferior segura, PIN, aviso da autoavaliação de homologação, lógica de conclusão, chamadas de avaliação e opções de concluir/tentar novamente/pular.

## 3. Commits e arquivos da rodada

- `4233c15a5b074f3d86b718bd0609f45773293ced` — criação de `scripts/fix-partner-motorista-rating-accessibility-cv03-v1.mjs`
- `18920e74d04f26e2bca89c93893fb462e912f3c9` — posiciona o marcador dentro de RatingScreen para tornar a execução idempotente
- `585eea8afdb3d96d4311078c6b0ebed9de3c0f7d` — criação de `scripts/qa/test-motorista-rating-accessibility-cv03-v1.test.mjs`
- `52409caa6110b84ce5eac424e62784d08ef0d3f4` — alinha a fixture do teste à indentação de fonte real
- `1185377eb9924ac98f6b7a0c01fe8cbe3f20a519` — integração controlada do gerador e do gate de testes em `scripts/build-partner-release.sh`
- `1ef366c86c62b0cfbfc920d8aab323248b765cb2` — ampliação da matriz visual `CODEX-MATRIZ-COMUNICACAO-VISUAL-20261109.md`, com retificação VIS-007

Nenhuma linha dos repositórios-fonte pinados, de `main` ou de outra branch foi alterada.

## 4. Evidências verificáveis — nível de execução

**Confirmado por leitura real do GitHub:** presença dos anchors no snapshot pinado, localização correta do `RatingScreen`, sequência de correções V7 e input-contrast, CSS local e preservação de `onSubmit`, `onSkip`, `onDismiss`, `setStars(n)`, `value={comment}`, `onChange`.

**Executado com V8 e filesystem simulado, sem Android, rede nem RPC:**
- 8 de 8 verificações PASS com o bloco `RatingScreen` verdadeiro do commit pinado, após simular **somente os trechos visuais V7 relevantes**. Validação de nomes/estado de estrelas, associação do label, CSS de placeholder localizado, escala, callbacks, ausência de modificações externas, idempotência e falha segura em source drift.
- 7 de 7 verificações PASS na fixture extraída do teste QA recém-registrado, incluindo as mesmas proteções.
- Inspeção de sintaxe V8 dos dois arquivos JS (imports ESM tratados apenas para o parser da inspeção), checks de ordem de aplicação no builder e conservação do SHA do lock.
- Contraste sRGB matemático: `#8A9098` sobre `#FFFFFF` = aproximadamente **3,22:1**; `#596372` sobre `#FFFFFF` = aproximadamente **6,08:1**. Essas razões são dos pares de cores previstos no código, não pixels efetivamente medidos em WebView.

**Não executados:** `node --test scripts/qa/test-motorista-rating-accessibility-cv03-v1.test.mjs` no checkout completo, aplicação integral de todos os geradores desde os snapshots, npm/bun typecheck/lint/build, Playwright do aplicativo real, DOM/árvore acessível, TalkBack, APK Android, E2E e envios efetivos de avaliação.

## 5. Gate de homologação física futura

Verificar pós-corrida em build identificado por SHA, em 320/360/390/412 CSS px, paisagem, fontes ampliadas, teclado e safe-area Android. Conferir nomes das cinco notas, `aria-pressed` refletindo exatamente a nota atual, foco e toque, label sempre visível antes/depois de digitação, contraste CSS computado, texto preenchido e campos vazios. Testar sucesso, falha, Tentar novamente e Pular avaliação apenas com contas sintéticas e autorização de homologação. Validar comportamento de autoavaliação de homologação sem gravar nota reputacional. Verificar que PIN, mapa, ofertas, rotas e notificações não sofreram regressão.

## 6. Histórico mantido

- **15 CV independentes** = 8 da rodada 01, 4 da rodada 02, 3 da rodada 03; VIS-001 permanece somente alias do INV-047.
- VIS-007 / CV-006 explicitamente fora da fila de defeitos ativos de código, por correção posterior existente; APK ainda pendente e registro histórico preservado.
- **67 achados técnicos inalterados: A 0 / B 46 / C 17 / D 0 / E 1 / G 3.** Não tocar na matriz técnica ou na consolidação física dos relatórios 01–14.
- **Não realizados:** merge, deploy, publicação, geração de APK, mudanças no Supabase, SQL, pagamentos reais, envio de notas, notificações ou operações em dados pessoais.

**Conclusão:** a rodada Visual 03 tem correções de código cirúrgicas registradas na branch autorizada e testes sintéticos reproduzíveis, **sem homologação final do aplicativo**.
