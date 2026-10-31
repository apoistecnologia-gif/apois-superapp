# APOIS Corridas — relatório real de liberação em etapas (31/10/2026)

Autorização do usuário: "prossiga as liberações". Projeto de produção: `APOIS CORRIDAS - PRODUÇÃO`, ref `tbbzkrfupmqdywnzgnms`. Não tocar APOIS Entregas nem finanças.

## ETAPA 1 — EXECUTADA e VERIFICADA
- Migration Supabase **`apois_vehicle_inspection_case_corrections_stage1_20261031`**, version **`20261031173347`**, status success.
- SQL exato em `docs/qa-sql/20261031173347_apois_corridas_stage1_APPLIED.sql`.
- Estruturas privadas: `apois_vehicle_inspection_photos`, `apois_vehicle_inspection_review_events`, `apois_driver_correction_requests`, `apois_driver_correction_email_outbox`, `apois_case_events`, `apois_case_evidence`, políticas Storage e RPCs de autenticados.
- Pós-aplicação: tabelas existem, RLS habilitado, permissões anônimas de execução nas RPCs novas revogadas, 3 motoristas de carros permanecem `aprovado`.
- Os novos registros de correções e a fila de e-mail são fail-closed (RLS ativo, sem políticas de leitura direta). O advisor registra `rls_enabled_no_policy` nível INFO, **intencional** para dados restritos que somente RPCs autorizadas e service role podem ler.
- Três triggers sobre `public.drivers` deliberadamente **não foram ativadas**, evitando ruptura do cadastro antigo: `apois_require_vehicle_inspection_on_driver`, `apois_snapshot_front_on_vehicle_change`, `apois_prevent_approval_during_corrections`. Verificado: contagem de triggers ativos = **0**.
- Não foram criados motoristas, chamados, evidências ou notificações fictícias.

## ETAPA 2 — EDGE FUNCTION PUBLICADA, envio real pendente
- Função `apois-driver-review-mailer`, **ACTIVE version 1**, `verify_jwt=true`, Supabase Corridas produção.
- Fonte exata no repositório: `supabase/functions/apois-driver-review-mailer/index.ts`.
- Implementa verificação dupla de token de login e permissão staff, Resend via servidor, fila idempotente e registro `accepted_by_provider` somente após resposta 2xx. Isso não garante leitura ou entrega no destinatário.
- **Não comprovado**: `RESEND_API_KEY` e `APOIS_EMAIL_FROM` configurados, domínio remetente verificado, e-mail de ponta a ponta entregue. A função retorna indisponibilidade se faltar configuração.
- Não houve disparos de e-mail de teste nem inserção de pendência para motorista real.

## ETAPA 3 — PREPARADA e testada, NÃO APLICADA
- Script `supabase/corridas-forward-migrations/20261031_vehicle_13_photos_STAGE2_ONLY_AFTER_APP_RELEASE.sql`.
- `BEGIN ... ROLLBACK` em produção validou **3 triggers temporários**, revertidos ao final, sem alterar cadastro e com verificação de pré-requisitos.
- Quando autorizado depois de app distribuído e testes físicos: ativa (a) snapshot de nova foto da frente; (b) 13 fotografias aprovadas + fabricação até 10 anos para aprovação de novos carros; (c) bloqueio de aprovação enquanto há correção aberta.
- **Não aplicar antes do cliente Motorista e Admin atualizado e verificado em dispositivo**, ou novos cadastros feitos no app antigo não poderão cumprir a exigência.

## INTERFACES — código QA, ainda não distribuídas
- Scripts isolados no branch `fix/entregas-homologacao-ajustes-20261030`: cadastro 13 fotos, ano de fabricação, fotos privadas sem sobrescrita, galeria Admin e pendenciar, status de pendências e reenvio, ocorrências e acompanhamento do Cliente.
- Gate de build WEB-only **`41224424141`**: 3/3 jobs SUCCESS, sem APK.
- Não confundir testes estáticos/compilação WEB com homologação E2E física, login Google, envio de mídia, abertura de documentos no WebView Android, comunicação de e-mail e reprodução de problemas no Admin.
- Há projetos Vercel distintos (`apois-corridas-admin` e `apois-admin`). Não se confirmou uma implantação segura desta branch QA como release oficial desses projetos; **nenhum domínio/site foi sobrescrito**.
- Não foi gerado APK/AAB, não houve merge, distribuição, troca de versão ou alteração dos produtos APOIS Entregas e pagamentos.

## Checklist pendente antes da publicação completa
1. Validar no Android o fluxo 13 fotos + celular/galeria, ano 2015 recusado e 2016 aceito em 2026.
2. Aprovação foto a foto pelo Admin, visualização interna de selfie/CNH/CRLV e novo envio de arquivos sem perda de histórico.
3. Admin marca pendência específica; app mostra dados corretos no perfil do próprio motorista; outros motoristas não acessam.
4. Configurar remetente de e-mail e provedor via segredos no Supabase, testar aceite/bounce, controlar reenvios.
5. Distribuir o build Motorista/Admin compatível e só depois aplicar a etapa 3; verificar que novos carros sem 13 fotos **não são aprovados** e legados não sofrem bloqueio.
6. Regressões nas corridas, pagamentos, Entregador, Cliente, PIN, mapas e sessão.
7. Aprovar política LGPD para retenção de fotos e provas, e instruções de inspeção.

**STATUS ATUAL:** back-end base e Edge Function em produção; interfaces e regras de aprovação completas **ainda não estão publicadas**. Não anunciar a funcionalidade como ativa para motoristas ou passageiros.
