# APOIS — Matriz independente de comunicação visual — CV 01

**Data:** 09/11/2026. **Repositório:** `apoistecnologia-gif/apois-superapp`. **Branch de integração autorizada:** `audit/continuacao-20261107`.

## Integridade histórica

Esta matriz **NÃO substitui** `CODEX-MATRIZ-GERAL-51-ACHADOS-20261109.md` nem `CODEX-PENDENCIAS-VERIFICACAO-FISICA-RELATORIOS01-14-20261109.md`. Base técnica preservada, conforme declaração dos relatórios 01–14: **67 achados; A 0, B 46, C 17, D 0, E 1, G 3**. Não promover os estados históricos sem nova evidência.

**VIS-001 = alias de INV-047:** fora da nova contagem visual. Identificadores VIS-002–009 pertencem ao relatório externo de 09/11/2026. Aqui, cada referência recebe CV-001–008. IDs CV organizam trabalho visual; referências INV já existentes não geram achados técnicos duplicados.

## Achados visuais — rodada 01

| CV | Origem | Prioridade | Superfície | Evidência original | Estado na integração em 09/11 | Aceite restante |
|---|---|---|---|---|---|---|
| CV-001 | VIS-002 / INV-028 | P1 | Estabelecimento / login público | Texto de produto #FDEBED em branco, contraste 1,15:1, 14 px | **Pendente de vinculação a build publicado**. Fonte pinada do login Entregas é escura; não corrigir cegamente o CSS de uma versão possivelmente diferente | Identificar commit/deployment publicado; contraste >=4,5:1 no contexto claro e verificar estados escuros |
| CV-002 | VIS-003 | P1 | Estabelecimento / Entrar | Texto #070707 sobre gradiente vermelho, extremos de 4,33:1 e 3,45:1 | **Preparação existente, sem comprovação no publicado**: `fix-entregas-login-cta-contrast-v1.mjs` aplica branco apenas ao CTA na montagem merchant; falta vincular e renderizar o deployment | Verificar botão Entrar, hover, loading, disabled e efeitos de CSS posterior |
| CV-003 | VIS-004 / INV-029 | P2 | Estabelecimento / revelar senha e recuperação | Áreas de 20 px observadas na página | **Preparação existente, não homologada**: `fix-entregas-login-accessibility-v2.mjs` amplia alvo de toque no código gerado | Captura final, área 44x44 quando aplicável, ausência de sobreposição e teste touch |
| CV-004 | VIS-005 / INV-030 | P2 | Estabelecimento / inputs | DOM público sem associação observada de labels | **Preparação existente, não homologada**: overlay `fix-entregas-login-accessibility-v2.mjs` associa `htmlFor/id` no source transformado | Associar no DOM publicado, testar clique no label, teclado e leitor de tela |
| CV-005 | VIS-006 | P2 | Motorista / login | Texto técnico `APOIS Parceiro • visual 18` na UI | **Alterado em gerador**, commit `10703768`: removido texto técnico visível; preservado `data-apois-partner-auth-v18` e logic de auth/Google | Rodar gerador, typecheck, comparação de DOM, APK físico |
| CV-006 | VIS-007 | P2 | Motorista / placeholder | Regra intermediária v19 #808995 resulta ~3,54:1 | **Sem duplicação de patch**: etapa posterior `fix-partner-input-contrast-v1.mjs` escreve #596372 em branco, com `!important` e ordem posterior | Verificar CSS computado após cadeia completa, autofill e WebView Android |
| CV-007 | VIS-008 | P2 | Passageiro / localização | Sigla GPS em 10 px sem orientação na Home | **Alterado em gerador**, commit `40f745a5`: mensagem existente `locationError` apresentada em card rolável com status acessível; nenhum fluxo do GPS alterado | Rodar compilação, verificar erro negado/indisponível/timeout e 320–412 px, teclado e TalkBack |
| CV-008 | VIS-009 | P2 | Motorista e Passageiro / microtipografia | Auxílio Motorista 10,5 px; assinatura decorativa Passageiro 8 px | **Parcial no código**, commit `10703768`: Motorista aumentou informativo para 12 px. Assinatura decorativa VAMOS? mantida conforme relatório, dependente de renderização | 320–412 px, fonte ampliada, teclado, quebras e contraste contextual |

## Restrições e evidências

- Fonte pinada continua **imutável** em `.apois/source-lock.json`; não alterar nenhum repositório-fonte protegido.
- Não modificar login, Auth, Google, Supabase, RPC, RLS, pedidos/corridas, Safe2Pay, geolocalização, rotas ou handlers.
- O painel do Estabelecimento observado em `parceiros.apoisbrasil.com.br/login` **não tem SHA de publicação associada** nesta rodada. Não inferir que o bundle atual é a página observada.
- Teste de contrato estático adicionado: `node --test scripts/qa/test-comunicacao-visual-01-v1.test.mjs`. Só registrar como executado após execução real.
- Estado de compilação, navegador real e Android físico: **pendentes**. Nenhum APK, deploy, merge, SQL ou pagamento autorizado/executado.
- Dependências INV-047/VIS-001 e INV-065 são funcionais; não chamar corrigidas apenas por mudança de mensagem/cor.

## Encaminhamento

Prioridade de publicação futura: identificar exatamente a origem do login Estabelecimento e verificar CV-001/002/003/004; validar posteriormente o resultado final dos overlays CV-005/006/007/008 em 320, 360, 390 e 412 CSS px, orientação horizontal, fonte ampliada, foco, safe-area, teclado aberto e Android físico. Esta matriz é **incremental**, será ampliada nos relatórios CV seguintes, sem alterar a matriz técnica.
