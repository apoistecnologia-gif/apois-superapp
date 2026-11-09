# APOIS — Comunicação Visual 02 — Execução do Entregador
**Data:** 09/11/2026. **Entrada:** Relatório Visual 02 — VIS-010–013.
**Repositório de integração:** apoistecnologia-gif/apois-superapp.
**Única branch modificada:** audit/continuacao-20261107.
**Conjunto visual:** CV-009–012, independente dos CV-001–008 e da matriz técnica.

## 1. Segurança do escopo
Foi lida a branch autorizada, a matriz visual 01 e o arquivo de bloqueio das fontes. Fonte Entregas fixada no commit 2f4606e0fb52dffb49f2e6aebbe921ce687ab625. O arquivo `.apois/source-lock.json` permaneceu com SHA de blob `3f98789f28666ccc052175db10f138208dd0937b`. Os repositórios-fonte, branch main, banco, Safe2Pay, mapas, políticas e regras de entregas não foram modificados.

A branch de auditoria `audit/ecossistema-20261107` citada no relatório de origem NÃO foi usada para escrever: prevaleceu a autorização mais recente `audit/continuacao-20261107`.

## 2. Investigação da ordem de construção
A cadeia em `scripts/build-partner-release.sh` executa:
1. `harden-partner-courier-inner-panels-v1.mjs` e `harden-partner-courier-offer-ux-v2.mjs`
2. `harden-partner-courier-waiting-compact-v2.mjs` e `harden-partner-courier-home-viewport-v3.mjs`
3. `fix-partner-courier-offer-contrast-v1.mjs`
4. `fix-partner-courier-simple-journey-v1.mjs`, que substitui o componente ActiveDelivery
5. Correções posteriores de histórico, apresentação, disponibilidade e operações
6. **Novo overlay visual CV02**, depois dessas correções e antes das verificações de integridade.

Isso evita editar fonte antiga cuja aparência seria substituída posteriormente.

## 3. Correções adicionadas

| ID | Original | Mudança concreta | Preservação | Estado |
|---|---|---|---|---|
| CV-009 | VIS-010 | Texto do botão de retirada agora expressa ação futura: “Confirmar retirada” | `onTransition("picked_up")`, confirmação existente, busy, PIN | Implementado no gerador; render pendente |
| CV-010 | VIS-011 | Diálogo semântico com nome, foco inicial ao receber oferta, retorno de foco quando sai e controle de Tab. Não foi criada função de fechar/recusar implicitamente | RPCs, sons/vibração, expiração, evento de aceite, recusa explícita | Implementado no gerador; TalkBack pendente |
| CV-011 | VIS-012 | Cartão inteiro com altura limitada, cabeçalho preservado, corpo rolável e linha aceitar/recusar sticky ao fundo da rolagem | Botões, handlers, contador, ganhos, privacidade | Mitigação preventiva; demonstração sintética, sem reprodução física |
| CV-012 | VIS-013 | Botões de endereços e ajuda com altura mínima 44px, padding, foco visível; fileira pode quebrar linha com fonte ampliada | `setShowDetails` e `onReport` intactos | Implementado no gerador; toque físico pendente |

## 4. Commits e arquivos
- `43704dd5a952e554dd4bef533cd4ef2b99286895`: criação de `scripts/fix-partner-courier-visual02-v1.mjs`.
- `ecbd6cf31308f074f5d693db2d850397ad561ab4`: criação de `scripts/qa/test-partner-courier-visual02-v1.test.mjs`.
- `e7843ad3097dc6c8b0a402f388612942a40fbb30`: integração no `scripts/build-partner-release.sh`, com gate de teste e marcadores.
- `8a714bd4cf5eac17c90c0603e379b575fe7f2e1e`: atualização incremental da matriz visual CV-001–012.

## 5. Testes realmente executados
**V8 com APIs de arquivo simuladas, sobre duas fixtures sintéticas do próprio teste de regressão: 8/8 PASS.** Checagens de texto da ação, handler `picked_up`, ambos os alvos de toque, semântica e foco do diálogo, limite de altura e rolagem, preservação de aceite/recusa/privacidade, idempotência do gerador e rejeição de alteração inesperada na origem. Não foi um build React; nenhum request RPC real disparado.

**Chromium em modelo HTML/CSS isolado (não aplicação real):** dados de cartões suficientemente altos para exercitar o scroll. Resultados de geometria:

| Viewport | Cartão original ultrapassa o topo? | Cartão limitado ultrapassa? |
|---|---|---|
| 320×480 | Sim, topo -79,6 px | Não, topo 12 px |
| 360×640 | Sim, topo -34,8 px | Não, topo 12 px |
| 390×844 | Não, topo 22,3 px | Não, topo 12 px |
| 412×915 | Não, topo 79 px | Não, topo 79 px |
| 640×360 (paisagem) | Sim, topo -113,2 px | Não, topo 12 px |

O teste confirma o mecanismo de risco em uma reprodução estrutural, **mas não confirma defeito nem correção em aparelho, build ou deployment real**. Os estilos completos, dimensões reais de fonte, estados de carregamento, WebView e barras Android não foram renderizados a partir do aplicativo.

**Preparado mas NÃO executado no checkout:** `node --test scripts/qa/test-partner-courier-visual02-v1.test.mjs`, full builder, typecheck, lint, integração, distribuição e testes de permissões/foco.

## 6. Itens para a homologação física futura
- Identificar commit de cada APK, versão do shell e fonte real após geradores, com captura antes/depois;
- Testar 320/360/390/412 CSS px, paisagem e altura curta; fonte ampliada, zoom, rolagem, safe-area, barras Android e teclado quando aplicável;
- Foco inicial, Tab/Shift+Tab, retorno de foco, diálogo anunciado por TalkBack; expiração e troca de ofertas sem recusa indireta;
- Conferir contador, alerta sonoro, vibração, pedido, ganhos, privacidade do endereço e aceite/recusa de oferta em ambiente de homologação expressamente permitido;
- Confirmar que retirar pedido aciona a transição exatamente uma vez, que ajuda abre suporte e que endereços expande sem sobreposição.

## 7. Preservação dos relatórios técnicos
Total técnico histórico inalterado: **67 achados; A 0, B 46, C 17, D 0, E 1, G 3**. VIS-001 segue alias do INV-047. Agora há **12 achados visuais** independentes. Não houve merge, deploy, publicação, APK, migrations, pagamentos reais, disparos ou exclusão de dados.

**Conclusão:** melhorias cirúrgicas implementadas no gerador de UI do Entregador, com ensaios sintéticos de preservação e geometria; **validação no produto real continua pendente**.
