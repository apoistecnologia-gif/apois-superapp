# APOIS — Auditoria integrada de regressão e plano de homologação

**Data:** 02/11/2026  
**Escopo:** Cliente Corridas, Cliente Entregas, Motorista, Entregador, Admin Corridas, Admin Entregas, Portal Estabelecimento.  
**Branch de correção:** `fix/entregas-homologacao-ajustes-20261030`  
**Produção:** NÃO alterada. **Merge:** nenhum. **APK:** não gerado nesta auditoria.  
**Última evidência objetiva aprovada nesta investigação:** GitHub Actions `41525241046`, commit `37c84ff7`, 3/3 jobs `success`.

## Regras de preservação

As três fontes protegidas permanecem fixadas em `.apois/source-lock.json`: Motorista/Admin `9fc171050d8b5703540c49d19a8f1e9f5162775f`, Cliente Corridas `7b047f75a1a919a5336c0df6e0d60b14b02f2618`, Entregas `2f4606e0fb52dffb49f2e6aebbe921ce687ab625`. Correções feitas em scripts que alteram **somente as workspaces temporárias** no build da branch. Não modificar fontes base; preservar rotas Maps/GPS, pagamentos, Supabase, autenticação, pedidos e operações.

## Achados identificados e intervenções

| ID | Prioridade | Área | Evidência e causa | Intervenção | Estado |
|---|---|---|---|---|---|
| A-01 | P0 | Motorista — conta existente | Usuário confirmado no Auth mas sem registro de Motorista. `ensureAuthenticatedAccount` tentava `signUp` depois de falha de `signIn`, exibindo falsa mensagem de confirmação. | `scripts/fix-partner-driver-existing-passenger-v7.mjs`: opção de reaproveitar conta Passageiro, impedir fallback `signUp` no modo existente, validar `mobility_user_id` e `driver_get_profile` antes dos documentos, mostrar CTA de continuação. | **Implementado; compilação validada; E2E Auth real não validado** |
| A-02 | P1 | Motorista — redefinição | Código OTP de recuperação funcionou, mas nova senha apareceu com pouco contraste quando revelada e o retorno ao login não confirmou a troca. | `scripts/fix-partner-driver-password-success-v2.mjs`: texto escuro (inclusive autofill), linguagem `Código verificado`, aviso de senha alterada após retorno ao login. | **Implementado; compilação validada; atualização real não repetida** |
| A-03 | P1 | Cliente Corridas — login | Captura de QA 360 px mostrou título `Entrar na sua conta` sob botão flutuante de troca de módulo. | `scripts/harden-apois-client-red-visual.mjs`: título responsivo com espaço livre; Playwright verifica sobreposição geométrica dos textos. | **Corrigido no teste de interface 360/1280** |
| A-04 | P1 | Cliente Entregas — login | Texto preto em botão vermelho, visível na captura QA. CSS herdado sobrepunha primeiro ajuste. | `scripts/fix-entregas-login-cta-contrast-v1.mjs`: texto branco explícito dentro do botão, sem trocar handlers; Playwright mede cor real. | **Corrigido no teste de interface 360/1280** |
| A-05 | P1 | Todos — campos | Histórico de texto branco sobre fundo branco, especialmente Android WebView. | `scripts/audit-browser-public-v1.mjs`: avaliação da cor efetiva de todos os inputs/textarea visíveis em login, cadastro e recuperação. QA de Motorista OTP valida digitação e cores. | **Cobertura browser ampliada; Android físico não validado** |
| A-06 | P1 | Motorista — pendências | Componente antigo de correção usava fundos/CTAs dourados e escuros destoantes. | `scripts/fix-partner-driver-corrections-red-v2.mjs`: vermelho/branco/preto mantendo RPCs e eventos de reenvio. | **Implementado, build validado; tela real pendente** |
| A-07 | P0 | Admin Corridas — documentos | Vercel preview estático chamava `createServerFn` sem servidor. Endpoint adicional chamava RPC inexistente `admin_has_permission`. | `scripts/build-corridas-admin-spa-v1.mjs` troca chamada por `/api/admin/driver-documents`; endpoint valida JWT e `public.profiles` + `public.role_permissions` no servidor; arquivo publicado em `api/admin/driver-documents.js` na raiz (Vercel Functions); testes simulados de autorização negativos e positivos. | **Código e testes simulados validados; NÃO liberado no Vercel, falta segredo de servidor** |
| A-08 | P1 | Admin Corridas — navegação | Prévia profissional restaurada preserva Dashboard/Operações/etc., mas `Assinaturas` e `Pagamentos` estavam fora da sidebar. | Reintegração sob permissões RBAC em `scripts/build-corridas-admin-spa-v1.mjs`; testes de build e rota. | **Implementado e compilado; QA autenticada pendente** |
| A-09 | P1 | Admin Corridas — layout | Build verde não provava que a tela de login original estava renderizando. | `scripts/audit-admin-preview-render-v2.mjs`: Chromium mobile 360/desktop 1280, logo oficial, texto do email, sem overflow nem erro JS; screenshots preservadas no artefato do workflow. | **Teste visual anônimo aprovado** |
| A-10 | P1 | Entregador — início/varredura | Regressão histórica de mapa e status; scripts anteriores de restauração já estão no pipeline. | Verificações `test-courier-home-render-v1.mjs` e módulos do build foram mantidas; operação online, notificação de ofertas e GPS real ainda requerem teste em telefone. | **QA web fixture aprovada; E2E real pendente** |
| A-11 | P0 | Aprovação e inspeção | Produção tem 3 motoristas antigos, 0 fotos em `apois_vehicle_inspection_photos`, 0 pedidos/outbox de correção. Stage1 aplicada; Stage2 não aplicada. `admin_set_driver_approval` não condiciona aprovação individual das 13 fotos + regra dos 10 anos. | **NÃO aplicar Stage2** até homologar as telas e o envio real de arquivos, conforme bloqueio anterior. Migração preparada em `supabase/corridas-forward-migrations/20261031_vehicle_13_photos_STAGE2_ONLY_AFTER_APP_RELEASE.sql`. | **Bloqueado por homologação/risco de produção** |
| A-12 | P0 | Correções e notificações | Sem cadastro confirmado de Motorista, não há evento/outbox de correção, portanto não é possível comprovar e-mail/push a partir do teste anterior. | Preservadas `apois-driver-review-mailer` e RLS; não houve disparos reais em teste. | **E2E não validado** |
| A-13 | P0 | Painel oficial | Domínio `admin-corridas.apoisbrasil.com.br` está no projeto Vercel `apois-corridas-admin` associado ao build original anterior, enquanto o Admin novo se encontra na homologação `apois-corridas-admin-homologacao`. | Não promover a prévia ao domínio oficial antes da aprovação visual/funcional, e antes de resolver o endpoint privado. | **Bloqueado por aprovação e segredos Vercel** |
| A-14 | P1 | Entregas Admin + Estabelecimento | Fontes protegidas, build isolado e telas existentes continuam. | Job WEB-only Estabelecimento e auditorias estáticas executados; sem credenciais de teste reais não foi possível certificar gestão de pedidos, pagamentos, mapas e repasses. | **Compilação aprovada; E2E autenticada pendente** |

## Riscos externos que impedem declaração de prontidão

1. **Segredo no Vercel QA:** o projeto `apois-corridas-admin-homologacao` possui segredo de leitura de GitHub, mas ainda não expõe a variável server-only `CORRIDAS_SUPABASE_SERVICE_ROLE_KEY`. O endpoint de imagens responde **503 fail-closed** sem ela; nenhuma chave foi extraída/registrada em código. Deve ser configurada de forma segura, somente no projeto Preview, antes de teste autenticado. Nunca utilizar em frontend.
2. **Produção sem Stage2:** a API de aprovação ainda permite avaliar sem o bloqueio completo das 13 fotos e do ano máximo. Exige gate de release coordenado após envio real de documentos e análise no Admin; não foi aplicada migration.
3. **Sem testes reais com contas de homologação completas:** cadastro no app, upload do celular, verificação de admin, e-mail Resend real, push OS Android, corrida real, localização GPS, pagamentos e extratos requerem credenciais/sessões de teste e infraestrutura ativa. Não usar contas reais nem simular sucesso.
4. **Painel oficial desatualizado:** o projeto da Vercel de produção é outro, com branch/deploy distintos da QA. Não foi publicado nem promovido nesta auditoria.
5. **Políticas de segurança Supabase:** Advisor retorna avisos de execução ampla de funções SECURITY DEFINER e proteção de senhas vazadas; precisa revisão direcionada e autorização antes de DDL/alteração Auth.
6. **Lint legado Entregas:** build gerado não equivale a lint limpo; a base ainda tem grande volume de avisos/erros estáticos legados.

## Critério real de liberação

**Não declarar `Pronto para testes E2E` nem gerar APK/AAB automático** até (a) CI 3/3 verde no HEAD exato; (b) prévia Admin Corridas Vercel READY com SHA do mesmo HEAD; (c) função `/api/admin/driver-documents` testada com e sem privilégio; (d) teste real com conta passageiro existente criando motorista com 13 fotos confirmadas no Storage e Admin; (e) notificações Resend/Android recebidas; (f) mapa/varredura/roteamento verificados no Android; (g) aprovação Stage2 planejada com rollback; (h) todas as interfaces conferidas visualmente em mobile e desktop.

**Este relatório distingue deliberadamente `implementado`, `compilado`, `teste UI aprovado` e `E2E pendente`.** Nenhum resultado de produção foi inventado.
