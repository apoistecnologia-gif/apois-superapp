# APOIS — Correções executadas sobre o relatório Codex de 08/11/2026

## Identificação
Repositório: apoistecnologia-gif/apois-superapp
Branch autorizada: audit/continuacao-20261107
HEAD inicial: c2c7864d6ef696d88c02ae2a7cffbcfb0a7eb431
Entregas pinada: 2f4606e0fb52dffb49f2e6aebbe921ce687ab625
Motorista/Admin pinado: 9fc171050d8b5703540c49d19a8f1e9f5162775f
Passageiro pinado: 7b047f75a1a919a5336c0df6e0d60b14b02f2618
Produção somente leitura. Nenhum deploy, migração aplicada, merge, checkout em aparelho ou build completo executado nesta etapa.

## Mudanças reais publicadas na branch

| Commit | Local | IDs | Alteração |
|---|---|---|---|
| 252222873c71 | scripts/build-merchant-panel.mjs | INV-008 | Logger não imprime mais argv; Git Basic auth transmitido pelo GIT_CONFIG_* no ambiente do subprocesso, não na linha de comando |
| 6245f399b29b | scripts/harden-corridas-case-center-v1.mjs | INV-006 | Par de cores legível no botão de ocorrência, #991B1B sobre #FFF1F2 |
| ea0cf428b5eb | scripts/harden-corridas-case-center-v1.mjs | INV-007 | Link para /ocorrencias no histórico real restaurado, com verificação de âncoras e de resultado |
| 2918f18fd530 | supabase/entregas-forward-migrations/20261108_restrict_settle_delivered_order_financials_QA_NOT_APPLIED.sql | INV-009 | Migration de ACL preparada para staging, com checagem de SECURITY DEFINER e propriedade comum dos wrappers; NÃO aplicada |
| 12d23fa7ff2a | scripts/fix-partner-support-case-workroom-v1.mjs | INV-002/003/016 | Workroom: identidades de consulta, rascunhos por protocolo e estado explícito de anexo sem URL |
| be959e48c19d | scripts/harden-corridas-case-center-v1.mjs | INV-002/003 | Center: descarte de respostas assíncronas atrasadas, rascunho por protocolo e anexos do novo chamado isolados |
| 183ca70e5088 | scripts/qa/test-apois-incident-context-v2.mjs | INV-002/003/006/007/016 | Testes Node versionados para executar geradores em diretórios temporários e verificar idempotência do pipeline |
| 46eea06610a5 | scripts/qa/test-apois-merchant-token-logging-v1.mjs | INV-008 | Teste Node versionado que executa função de log com segredo sintético |
| c944c53a3fd3 | scripts/fix-partner-support-case-workroom-v1.mjs | INV-004/005 | Upload Workroom com SHA-256 do arquivo, checagem prévia do registro, recuperação e retirada por arquivo confirmado |
| e51db9a6450b | scripts/harden-corridas-case-center-v1.mjs | INV-004/005 | Mesma estratégia no passageiro, preservando arquivos restantes após falha durante a criação do chamado |
| 37c769e35bd | scripts/verify-apois-vehicle-incidents-v1.mjs | INV-011 | Gate final lê histórico/ação/Workroom já transformados; falha diante de link, cores ou marcadores de segurança ausentes |

## Verificações realmente executadas durante esta etapa

1. Inspeção GitHub da branch exata, geradores, verificadores, ordem de montagem e histórico Fase 3.
2. Consultas SQL SOMENTE DE LEITURA: ACL e corpo de settle_delivered_order_financials, três funções financeiras com owner, e assinatura/unicidade de apois_case_register_evidence em Corridas.
3. Logger do build: extração e execução isolada da função run() real com marcador Basic sintético. PASSOU: nenhum argumento, token ou codificação no log.
4. Dois handlers de casos extraídos do gerador real com carregamento A e B invertido. PASSOU 2/2: dados A não substituíram dados B.
5. Handlers reais de upload com rede, Storage e RPC simulados: três cenários para Workroom e três para Passenger Center. PASSOU 6/6: falha no segundo arquivo, confirmação perdida após registro, falha da indexação com nova tentativa. Nenhum arquivo confirmado foi registrado duas vezes nas simulações.
6. Geração de Workroom e Center executada em fixtures de arquivos em memória, duas vezes cada. PASSOU 2/2 geradores, incluindo ausência de duplicação do link após nova execução.
7. Contraste matemático nominal do botão corrigido: 7,56:1 (CSS definido, NÃO medida de pixels no Android).
8. Conferência do fonte pinado de Entregas: comprovado limite 50 no customer-support, ausência de range no histórico de pedidos, cache fixo de avatar e ausência de reconciliação de upload de produto no handler analisado.

**Atenção:** a execução isolada das funções ocorreu no interpretador de testes com mocks. Os novos arquivos scripts/qa/ foram publicados para reexecução em checkout, mas não foi executado node --test completo no repositório nem npm/bun install, typecheck, lint ou build Android.

## Testes reproduzíveis adicionados
- node --test scripts/qa/test-apois-incident-context-v2.mjs
- node --test scripts/qa/test-apois-merchant-token-logging-v1.mjs
- Pipeline já chama scripts/verify-apois-vehicle-incidents-v1.mjs em Corridas e Partner, agora com verificações adicionais de integridade final.

## Estado de produção e rollback
- INV-009 permanece aberto no banco de produção. A migration criada é revisão/homologação, não autorização de execução remota.
- Todas as mudanças de aplicativo vivem no integrador e geram arquivos em .work. Reversão é por commit na branch, sem descartar submódulos ou dados.
- Para a migration de ACL, fazer snapshot de grants, testar em staging e definir plano de retorno específico por DBA; NÃO executar GRANT permissivo automático em produção.
- A imagem pública, regras financeiras, autenticação, Supabase e rotas legítimas existentes foram preservadas no escopo dos patches.

## Próximo gate seguro
Rodar Node dos testes acima no checkout real e, depois, os pipelines de geração da branch em ambiente de QA. Executar typecheck/build e testes manuais autenticados nos sete aplicativos antes de classificar qualquer item como A.
