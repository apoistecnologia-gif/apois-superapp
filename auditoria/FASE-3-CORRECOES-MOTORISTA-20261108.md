# APOIS — Execução Fase 3: correções e auditoria técnica (08/11/2026)

## Estado de execução

- Branch exclusiva: `audit/continuacao-20261107`.
- Código-fonte pinado do submódulo Motorista/Admin (snapshot `9fc17105`) permanece intacto; os scripts trabalham em cópias de montagem `.work/motorista` e `.work/partner-motorista`.
- Sem merge na `main`, sem deploy manual, sem alteração de dados ou políticas no Supabase de produção.
- Qualificação dos resultados: inspeções do código original e do banco em modo leitura; verificações estáticas; quatro testes locais em fixtures reproduzindo as transformações. **Não ocorreu build APK, teste React autenticado ou E2E Android.**

## Correções aplicadas no GitHub

| ID | Problema confirmado | Ajuste realizado | Estado |
|---|---|---|---|
| APOIS-008 / D-005 (parcial) | `motorista.corridas.tsx` invoca promessa assíncrona no `useEffect` sem `.catch`; uma exceção de perfil/consulta pode deixar carregamento indefinido | `scripts/harden-motorista-history-recovery.mjs` captura rejeição inesperada, exibe erro e oferece botão de nova tentativa; cobre os dois builds | Corrigido no código de montagem; reteste visual e de sessão pendentes |
| APOIS-009 | `driverRegistration.mobile.ts` utiliza `upsert: true` em dois uploads com nomes novos, mas Storage Corridas concede apenas INSERT aos objetos de cadastro e não concede UPDATE | `scripts/harden-motorista-registration-insert-only.mjs` utiliza `upsert: false` nos dois uploads para que se mantenha o princípio de menor privilégio | Corrigido no código de montagem; E2E de upload pendente |
| APOIS-010 | Cadastro do Motorista permite selecionar PDF como selfie/foto do veículo; `driver-selfies` e `profile-photos` só permitem MIME de imagem | `scripts/harden-motorista-document-photo-types.mjs` restringe os dois seletores a JPG/PNG/WEBP e valida MIME também após selecionar; CNH/CRLV continuam aceitando PDF | Corrigido no código de montagem; teste em aparelho pendente |
| APOIS-006 (robustez) | Hardener de MIME do estabelecimento podia gravar um arquivo antes de descobrir que outro formulário divergiu | `scripts/harden-entregas-merchant-image-mime.mjs` agora valida as duas fontes antes de gravar | Corrigido; reteste de build pendente |
| APOIS-002 (segurança) | Validação local de chave JWT base64 podia marcar `keyProjectVerified: true` sem verificar assinatura | `scripts/verify-corridas-build-env.mjs` marca também JWT como não validado remotamente; deixa explícita a necessidade de teste de autenticação | Corrigido; login de homologação pendente |

## Verificações independentes

O projeto Supabase Corridas ativo `tbbzkrfupmqdywnzgnms` foi consultado em modo leitura. Confirmado:

- Buckets `driver-cnh`, `driver-selfies`, `profile-photos` e `vehicle-documents` existem, privados e com limite 10 MB.
- A policy `apois initial driver documents upload own` cobre INSERT do usuário na pasta correspondente; não concede UPDATE. Há SELECT específico de `profile-photos`, mas não os UPDATEs de `upsert`.
- A RPC `driver_complete_registration_v3` existe com os parâmetros esperados e permite EXECUTE para a role autenticada. A RPC `get_ride_feature_flags` também existe e permite EXECUTE para autenticados.
- As âncoras das transformações de histórico, selfie, foto do veículo e upsert foram encontradas uma vez cada no código-fonte pinado.
- Os pipelines Motorista standalone e Parceiro incluem os novos scripts de correção antes da compilação.

**Testes locais de transformação:** 4/4 aprovaram com Node.js v22, incluindo duplas execuções idempotentes, rejeição de entrada inesperada e não gravação parcial. Estes testes foram executados em *fixtures* reproduzindo os padrões e scripts de correção, não no build compilado do repositório integral. Arquivos de testes de regressão também foram adicionados em `scripts/qa/`.

## Pendências reais e riscos adicionais

- D-004 — Cadastro Motorista que anteriormente apresentou tela vazia: ainda não reproduzido no bundle atualizado, permanecer `NÃO HOMOLOGADO`.
- D-005 — Histórico instável: um caminho de rejeição não tratada foi corrigido. A hipótese de guarda de autenticação concorrente ainda precisa de evidência e reteste.
- OBS-011 — histórico aplica `.limit(50)` antes de filtros locais, então telas de 7/30 dias e período personalizado não conseguem mostrar corridas fora das 50 mais recentes. Defeito funcional de cobertura identificado; demanda paginação com testes antes de alterar comportamento e carga da API.
- As migrations de Storage Entregas da Fase 2 continuam `STAGE_ONLY`, não executadas. Uploads de produtos, documentos, anexos e avatar ainda exigem homologação RLS com identidades sintéticas e aplicação controlada.
- Não declarar aprovados mapas, pagamentos, motoristas online/GPS, push, admin, rotas privadas e UI responsiva sem execução completa.

## Ordem de homologação

1. Executar `node --test scripts/qa/test-motorista-history-recovery.mjs scripts/qa/test-motorista-registration-insert-only.mjs scripts/qa/test-motorista-document-photo-types.mjs scripts/qa/test-entregas-merchant-image-mime-v1.mjs` em checkout completo e conferido.
2. Compilar os dois bundles de Motorista e passar `typecheck`, evitando alterar produção.
3. Testar no aparelho: abrir cadastro, navegar nas três etapas, anexar JPG/PNG/WEBP, recusar PDF para fotos, enviar com usuário sintético e verificar a RPC; testar histórico sem conexão, após login e após reinício.
4. Em homologação Supabase Entregas, testar as migrations `STAGE_ONLY` com A/B adversariais. Não aplicar políticas amplas sem garantir acesso restrito.
5. Só então repetir o visual em diversos tamanhos e auditar os outros módulos.

**Conclusão:** correções de código reais publicadas na branch, mas nenhuma aplicação declarada pronta para lançamento por falta de build e E2E de homologação.
