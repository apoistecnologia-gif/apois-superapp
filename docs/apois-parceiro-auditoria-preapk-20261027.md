# APOIS Parceiro — Auditoria de pré-homologação Motorista + Entregador
Data: 27/10/2026
Escopo: branch `fix/apois-partner-courier-gps-logo-push-20261027` — PR #10 (rascunho).

## Fonte auditada
- Build integrado `scripts/build-partner-release.sh` no Superapp.
- Fontes oficiais preservadas por submódulo: Motorista `9fc171050d8b5703540c49d19a8f1e9f5162775f`, Entregador `0a1e0b294f75c97bce903200b57e7a6b482f381a`.
- Modificações realizadas somente nos scripts e no shell do Superapp; módulos de origem não foram atualizados por esta auditoria.

## Problemas identificados e correções
| Prioridade | Superfície | Problema comprovado | Correção isolada | Verificação |
| --- | --- | --- | --- | --- |
| P0 | Shell Parceiro | URL aninhada `https://localhost/modules/motorista/modules/...` em navegação relativa | `partnerModuleUrl` fixa módulos à raiz do host Capacitor; preserva callbacks externos, hash e trava operacional | Teste executável `test-partner-shell-navigation-v2.mjs` em fonte e bundle |
| P1 | Motorista Perfil | Contraste ilegível em nome e números | `harden-partner-motorista-profile-contrast-v2.mjs`, ajustado ao snapshot real fixado | Build/typecheck do Motorista e marcador no bundle |
| P1 | Entregador Home | Disponibilidade sobrepunha mapa, espera e rodapé | Disponibilidade no fluxo normal do layout; uma única instância; removida posição fixa | Contagem de controles e marcadores do bundle |
| P1 | Entregador Espera | Versão compacta inicial suprimiu ganhos, tempo online e atualização manual | Painel de espera compacto preserva 3 indicadores e botão Atualizar ofertas | `audit-partner-preflight-v1.mjs --dist` |
| P1 | Entregador GPS/Mapa | Mapa offline dependia de WebView e apresentava erro sem diagnóstico | Fallback para API nativa de GPS e mapa claro no componente | Typecheck + verificações do patch |
| P1 | Entregador Oferta | Marca antiga, card escuro e possível demora na atualização após aceite | Cartão com marca APOIS e evento de refresh imediato após aceite; som/vibração existentes mantidos | Build + verificações de fluxo/alerta |
| P1 | Entregador Push | Registro do pacote `br.com.apois.parceiro` falhava na constraint do backend | Restrição do banco corrigida em trabalho anterior; diagnóstico da chamada preservado e sem remover autorização | Testes de código; registro real requer homologação Android |
| P2 | Entregador telas internas | Marca quebrada e baixo contraste em Perfil, Ganhos e Entregas | Logo incorporada e ajustes de cartões/contraste | Typecheck + build de módulos |

## Preservações verificadas
- Motorista: login e recuperação, sessão, presença online/offline, GPS em segundo plano, notificações, corrida ativa, ganhos diretos, documentos, troca segura de função e logout.
- Entregador: login/cadastro, conta aprovada, GPS e Foreground Service, push da função correta, oferta e toque, aceitar/recusar, trajeto entregador→estabelecimento, transição após retirada, trajeto estabelecimento→cliente, conclusão e suporte, histórico e ganhos.
- Shell: callbacks OAuth/deep links, push cruzado ambíguo bloqueado, trava de função operacional e navegação ancorada na raiz.
- Regras de negócio financeiras, integrações de pagamento, tabelas e repositórios fonte não foram modificados.

## Testes executados
- `npm run verify:pins`
- `npm run audit:partner` e revisões estáticas integradas do Parceiro.
- `node --check` nos scripts de hardening acrescentados.
- `node scripts/test-partner-shell-navigation-v2.mjs` (URLs do WebView, push de cada função, trava operacional).
- `npm run build:partner`: fonte protegida preparada em `.work`, typecheck/compilação dos dois módulos, shell integrado.
- `node scripts/audit-partner-preflight-v1.mjs --dist` e teste de navegação sobre bundle final.
- GitHub Actions `APOIS Parceiro - Preflight sem APK`, obrigatório verde antes do teste Android.
- Nenhum `gradle assembleDebug`, `bunx cap add android` nem APK são executados no workflow de preflight.

## Restrições da evidência
Sucesso de compilação web e testes estáticos **não** comprova UX visual, permissão GPS, alerta sonoro com app em segundo plano, estabilidade de push e navegação com solicitação real. Esses casos compõem a próxima homologação física no aparelho, após autorização para gerar APK. Não existe alegação de testes E2E Android realizados.

## Estado de entrega
**Pronto para gerar APK de teste após o preflight da branch aprovar.** Sem merge ou publicação em produção. Mantém-se PR #10 aberto em rascunho para rollback seguro.
