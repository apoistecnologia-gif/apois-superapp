# APOIS — Homologação de chamadas Cliente Corridas ↔ Motorista (04/11/2026)

## Objetivo
Produzir APK **APOIS Parceiro** para testes de chamadas, mantendo Motorista e Entregador no mesmo pacote `br.com.apois.parceiro`, sem afetar aplicativos de produção, credenciais, corridas reais, fontes travadas ou mensalidades.

## Resultado de leitura do backend (sem mutações)
- Supabase Corridas: `tbbzkrfupmqdywnzgnms` (produção).
- Três motoristas aprovados em `carros`; nenhum online na vistoria.
- Dois têm `subscription_status=teste` e um `pending`. A função real `private.driver_subscription_allows_rides` considera `teste` elegível.
- Em inspeção agregada de `private.driver_kyc_is_ready`, **dois** motoristas têm KYC completo. Contagem combinada aprovada + mensalidade elegível + KYC + sem suspensão: **dois**. Não foi liberada assinatura nem alterado status.
- `public.driver_set_presence`, `driver_accept_ride`, `driver_reject_ride`, `driver_cancel_ride`, `driver_mark_arrived`, `driver_start_ride`, `driver_finish_ride` e `driver_rate_passenger` existem com permissão `authenticated`. A função de presença exige GPS válido e KYC na transição offline→online.
- Edge Functions publicadas: `request-ride` v18 e `driver-finish-redispatch` v12, mas **não** `driver-reject-redispatch`, **não** `driver-cancel-redispatch` e **não** `dispatch-ride`. A função finalizadora já publicada depende de `dispatch-ride` para redistribuição de corrida enfileirada. Portanto, E2E de recusa/cancelamento/fila **bloqueada pela implantação ausente**, mesmo que o APK compile.
- A `request-ride` publicada oferece candidatos por `drivers.user_id` (domain user id), compatível com o `setUserId(d.user_id)` e a checagem `candidate_driver_ids` do Motorista travado.
- Colunas de oferta/redispatch em `public.rides` verificadas por leitura do catálogo. Sem gerar corridas para medir o fluxo.

## Correções versionadas na branch canônica, sem deploy
As Edge Functions de fonte protegida em `sources/apois-corridas-motorista-admin` foram **copiadas sem editar o submódulo** para `supabase/functions/driver-reject-redispatch/index.ts`, `driver-cancel-redispatch/index.ts` e `dispatch-ride/index.ts`, com auxiliares `_shared/dispatch-engine.ts`, `ride-request.ts` e `ride-feature-flags.ts`. O CORS compartilha a implementação existente no repositório integrador. Foram incorporados `scripts/qa/verify-corridas-redispatch-contract-v1.mjs` e a chamada no preflight web-only. Trata-se de preparação do código, **não de deploy executado nem garantia E2E**. Revisar as diferenças entre o `request-ride` publicado e o novo `dispatch-ride` antes de qualquer implantação.

## Bloqueios de homologação ainda abertos
1. A cadeia de Edge Functions precisa de revisão de autorização, idempotência e compatibilidade com o dispatch em produção antes de eventual deploy explicitamente autorizado.
2. Cliente Corridas: C-001 endereço de partida ainda depende do serviço de geocodificação; correção Photon/CTA apenas staged. C-002 dados pessoais e C-003 exclusão de conta preparados para futuro APK, sem testes físicos.
3. Motorista: realizar login e ativação online com uma das **contas já elegíveis**, GPS do aparelho e permissões Android; nunca fabricar aprovação, localização ou assinatura.
4. Assinatura `br.com.apois.parceiro`: preservação do certificado QA original é indispensável para instalar por cima da versão anterior. O workflow GitHub `APOIS Parceiro Android APK` exige keystore QA original e SHA-256 pin; é `workflow_dispatch` manual. O Codemagic `android-partner-superapp` utiliza outra identidade de assinatura release e não deve ser presumido compatível com APK QA já instalado.
5. Prova real em dois aparelhos: Cliente solicita categoria Carros; Motorista online recebe em até janela configurada; aceitar, chegada, PIN, início, conclusão, recusa/cancelamento, retorno à busca e histórico; validar push com app fechado. Não realizar pagamento real.

## Estado de build / entrega
Última comprovação anterior em `bba1ccd9`: preflight **3/3 SUCCESS** (WEB-only e typechecks), sem APK. O código novo da cadeia de redispatch demanda novo CI no HEAD exato. Não foi iniciada compilação Android nem publicado APK nesta auditoria: a conexão GitHub disponível permite leitura/commits e consulta de runs, mas não oferece iniciar `workflow_dispatch` nem obter uma versão nova assinada de forma direta; também não há acesso ao Codemagic para acionar build. Não inventar arquivo ou link.


## Atualização — tentativa efetiva de APK e proteção da presença (04/11/2026)

**Preflight confirmado:** job 41887655601, commit `0fdc50a4`, 3/3 etapas WEB-only aprovadas. Este resultado não representa APK nem E2E Android.

**Compilação Android efetivamente acionada uma vez:** workflow `APOIS Parceiro Android APK`, execução `41889663287`, commit `07a4ad7`. Falhou em `Validate required GitHub secrets`, antes de Gradle/Java/assinatura, porque os dois secrets originais não existem no ambiente GitHub Actions: `APOIS_PARTNER_QA_DEBUG_KEYSTORE_BASE64` e `APOIS_PARTNER_QA_CERT_SHA256`. Os demais secrets obrigatórios desse passo estavam presentes. Nenhum APK/artifact foi criado nessa execução. A alteração temporária que autorizou este disparo foi desfeita; o workflow volta a exigir `workflow_dispatch` manual, mantendo todos os gates de segurança.

**Bloqueio de assinatura:** o APK Parceiro QA precisa da chave privada original para instalar por cima do aplicativo anterior. Um hash SHA-256 ou APK antigo permite **verificar** a identidade, mas não substitui a chave privada. Não gerar debug keystore aleatório, nem remover verificação de assinatura. O ZIP local `movvi-admin(7).zip` e o tree GitHub atual não exibem arquivos de keystore reconhecíveis por nome (isso não prova que a chave não exista em outro local). O usuário deve recuperar a chave original de forma segura e cadastrar os secrets no GitHub Actions diretamente, nunca em código, commit ou chat.

**Falha operacional extra identificada:** `useDriverBroadcast.ts` chamava `driver_set_presence`, registrava a falha da RPC em console mas não comunicava ao componente. Assim o motorista podia ficar marcado como ONLINE na interface sem estar online no banco; não receberia chamadas. Correção `scripts/harden-partner-driver-presence-ack-v1.mjs` preparada para o workspace Motorista: falha de RPC produz evento local apenas para lifecycle atual, encerra GPS e retorna a tela para offline com texto explicativo. `scripts/audit-partner-preflight-v1.mjs` agora confere o contrato após build. **Ainda não validado em dispositivo físico.**

**Correção adicional na cadeia de redispatch:** recusa/cancelamento enviam resposta de redispatch adiado após erro de rede posterior à RPC já confirmada, para não induzir repetição de mutação. Reforçado por `scripts/qa/verify-corridas-redispatch-contract-v1.mjs`. Código staged, sem deploy.

**Próximo gate real:** preflight verde no HEAD com proteção de presença + assinatura original recuperada + APK assinado com certificado pinado + integração autenticação/chamada em aparelhos. Até então, C-001/C-002/C-003 e redispatch são pendências de homologação; não declarar release completa.
