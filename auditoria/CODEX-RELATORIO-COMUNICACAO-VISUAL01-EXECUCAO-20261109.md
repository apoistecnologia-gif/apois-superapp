# APOIS — Comunicação Visual 01 — Execução incremental

**Data-base:** 09/11/2026. **Entrada:** `RELATORIO-COMUNICACAO-VISUAL-APOIS-20261109(1).md`.
**Escopo:** VIS-002–009, mapeados a CV-001–008. VIS-001 continua alias de INV-047, não recontado.
**Repositório autorizado:** `apoistecnologia-gif/apois-superapp`.
**Branch única de escrita:** `audit/continuacao-20261107`.
**Não executado:** merge, deploy, publicação, APK, SQL, pagamento, mensagens reais, mudança de backend e edição de repositórios-fontes.

## 1. Histórico protegido

Não alterada a matriz histórica dos Relatórios Técnicos 01 a 14: **67 registros / A 0, B 46, C 17, D 0, E 1, G 3**.
Lidas as fontes:
- `auditoria/CODEX-PENDENCIAS-VERIFICACAO-FISICA-RELATORIOS01-14-20261109.md`
- `auditoria/CODEX-MATRIZ-GERAL-51-ACHADOS-20261109.md`
- `.apois/source-lock.json`

O blob de `.apois/source-lock.json` permaneceu com SHA `3f98789f28666ccc052175db10f138208dd0937b`, antes e depois das alterações. Sources pinados protegidos não foram escritos.

## 2. Correções efetivamente gravadas

| Commit | Arquivo | CV | Alteração limitada ao UI |
|---|---|---|---|
| `10703768bedb3a81f9adbb3cfb1bf7e45f7d464f` | `scripts/harden-partner-motorista-visual-v18.mjs` | CV-005, CV-008 | Oculta texto de versão interna no login Motorista; aumenta apoio informativo de 10,5 para 12 px; mantém marcador de seletor, Google login, recuperação e `onSubmit` |
| `40f745a58c002bc105b927e51372859b8d64aa6d` | `scripts/harden-corridas-kit-visual.mjs` | CV-007 | Substitui badge `GPS` sem explicação por mensagem real de `locationError` em painel inferior rolável com `role=status`, `aria-live=polite`, quebra de texto e contraste; mantém mapa, botão de atualizar e todos os handlers |
| `9effe0b22ed9025ac2f3055ff94b6894e54689e8` | `scripts/qa/test-comunicacao-visual-01-v1.test.mjs` | CV-001–008 | Adiciona teste automatizado de contratos estáticos e contrastes da rodada; falta execução Node no checkout integral |
| `2432d03ec9f17c2abd1bac6cffdee9d03f73b718` | `auditoria/CODEX-MATRIZ-COMUNICACAO-VISUAL-20261109.md` | Todos | Cria série visual independente, sem alterar classificação de INV |

## 3. Verificações realmente feitas

Leitura de código remoto do commit fixado e de scripts da branch em 09/11/2026. Sete verificações estáticas no conteúdo remoto **PASS**:
1. Login Motorista conserva `onSubmit`, `DriverGoogleLoginButton`, marcador `data-apois-partner-auth-v18` e não contém mais a linha pública de versão.
2. Apoio de segurança no login Motorista passa para fonte 12 px.
3. Home Passageiro exibe mensagem real `locationError` no painel e mantém `refreshLocation()/refreshAddress()` e mapa.
4. Ordem do build Motorista mantém `fix-partner-input-contrast-v1.mjs` após visual-v18; placeholder final previsto #596372 sobre branco = **6,08:1**.
5. Build merchant mantém `fix-entregas-login-accessibility-v2.mjs` antes de `fix-entregas-login-cta-contrast-v1.mjs`.
6. SHA do arquivo de bloqueio de fonte permanece inalterado.
7. Teste de contrato da rodada existe no GitHub.

Contraste calculado matematicamente para a mensagem `#991B1B` em `#FFF1F2`: **7,56:1**. Trata-se do par de cores previsto no código, **não** medição de pixels efetivos de APK ou navegador.

**NÃO executados:** `node --test scripts/qa/test-comunicacao-visual-01-v1.test.mjs` no checkout real, typecheck/lint, render de React, bundle final, screenshots pós-correção, Playwright, TalkBack e Android físico. Consequentemente CV-005/007/008 estão **alterados em código, não homologados**.

## 4. Achados não alterados cegamente

- **CV-001/002 (login Estabelecimento):** evidência de tela pública branca em 1363×936 CSS px; fonte pinada `src/routes/login.tsx` usa fundo preto, e o pipeline já prepara CTA com texto branco. Não há associação comprovada entre deployment `parceiros.apoisbrasil.com.br` e commit atual. Antes de escrever CSS do login publicado, identificar release/SHA ou reprodução em checkout exato; posterior verificação visual de gradiente, product label, hover/loading/disabled.
- **CV-003/004:** hardener de acessibilidade do Estabelecimento já contém `id/htmlFor` e alvos 44px no código preparado; DOM publicado não foi retestado e nenhuma alteração duplicada foi feita.
- **CV-006:** apesar do placeholder intermediário #808995, o overlay final aplica #596372 com `!important` em momento posterior; resta conferir cascata real.
- **CV-008:** assinatura decorativa `VAMOS?` do Passageiro (8 px) conservada até verificar legibilidade contextual; não aumentar tudo sem render.
- **INV-047/VIS-001 e INV-065:** alterações de mensagem não substituem correções de comportamento.

## 5. Pendências direcionadas de homologação

Verificar versão final gerada após todos os scripts, inclusive componentes efetivamente renderizados; conferir desktop Estabelecimento e seus estados e login Motorista/Passageiro nos tamanhos 320/360/390/412 CSS px, orientação horizontal, teclado aberto, safe-area, fonte ampliada, toque, foco e leitor de tela. Em Android físico, observar loading, erro, GPS negado/indisponível/timeout, WebView autofill e rolagem. Registrar arquivo, build, SHA, data, screenshot antes/depois e PASS/FAIL/BLOQUEADO em cada caso.

**Resultado da rodada:** correções visuais de baixo risco aplicadas na branch autorizada, matriz separada criada e verificações estáticas aprovadas. **Homologação do produto permanece pendente.**

## 6. Consulta de vinculação do deployment na Vercel

Consulta **somente leitura** feita ao conector Vercel nesta rodada. O domínio `apoisbrasil.com.br` aparece na conta conectada, mas a listagem de projetos retornou **zero projetos acessíveis**, inclusive no time associado. A consulta direta pelo hostname `parceiros.apoisbrasil.com.br` no endpoint de deployments retornou **404 (deployment not found)**. Isso **não prova** que o site esteja fora do ar ou que não exista em outro time, conta, projeto ou plataforma; significa apenas que não foi possível estabelecer a referência segura do deployment com o acesso disponível. A decisão de não substituir CSS de uma versão não vinculada permanece correta.

Assim, **CV-001/002 ficam pendentes de vincular projeto, SHA de implantação e CSS computado após a montagem**, sem publicação nem edição de código de autenticação.
