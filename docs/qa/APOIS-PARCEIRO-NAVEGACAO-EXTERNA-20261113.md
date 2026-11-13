# APOIS Parceiro — navegação externa para Motorista e Entregador

**Data:** 13/11/2026  
**Branch:** `feature/apois-partner-external-navigation-20261113`  
**Base:** `b6957ed61664ee945026658f029d730895d2f39a` (QA222)  
**App Android:** `br.com.apois.parceiro`  
**Execução:** código versionado na camada de integração do Superapp, sem alterar os submódulos protegidos, Supabase/Google Cloud. A compilação de homologação ocorre exclusivamente no GitHub Actions, pelo workflow `APOIS Parceiro Android APK`.

## 1. Auditoria da arquitetura

- Motorista usa `MotoristaApp`, `PickupNavOverlay`, `ActiveTripNavOverlay`, `DriverLocationPlugin/Service`, `Geolocation.watchPosition`, RPCs de corrida e rotas, e mapas internos para a operação.
- Entregador usa `CourierRouteMap`, `CourierLocationTracker`, `CourierLocationPlugin/Service`, `delivery_jobs`, `courier_transition_delivery`, `update_courier_location` e mapas operacionais.
- O host `superapp/partner-shell` possui controle de função ativa, rotas de deep link específicas e serviços de GPS de foreground distintos já existentes. Ambos publicam localização em Supabase enquanto ativos.
- O build canônico é `npm run build:partner` via `scripts/build-partner-release.sh`. O workflow `.github/workflows/apois-partner-android.yml` (**GitHub Actions — APOIS Parceiro Android APK**) gera/sincroniza o host Capacitor Android, executa `node scripts/install-partner-launcher.mjs`, compila o APK de teste, valida assinatura/pacote e envia o artefato `APOIS-Parceiro-TESTE`. `scripts/build-partner-modules.sh` é uma cadeia anterior e não substitui os ajustes QA222.

## 2. Implementação compartilhada

`superapp/partner-shell/shared/ApoisExternalNavigation.tsx` é copiado por transformador para o workspace descartável de cada módulo. Disponibiliza `INICIAR NAVEGAÇÃO`, Google Maps e Waze, seletor e navegador preferido em `localStorage`, coordenadas validadas e mensagens para indisponibilidade/erro.

O app Android registra `APOISExternalNavigationPlugin.java`, que abre `Intent.ACTION_VIEW` para Google Maps ou Waze com coordenadas e usa URLs universais oficiais se o aplicativo dedicado não existir. Não se usa `@capacitor/browser` para a navegação externa, nem se chama a API paga da APOIS para abrir o outro navegador.

Documentação: Google Maps URLs `https://developers.google.com/maps/documentation/urls/get-started` e Waze Deep Links `https://developers.google.com/waze/deeplinks`.

## 3. Motorista

- Na ida até o passageiro, o botão abre as coordenadas de **embarque**.
- Depois do PIN e início confirmado, o botão abre as coordenadas de **destino**.
- Permanecem no APOIS: aceitar/recusar, GPS, online, chegada, autenticação, PIN, finalização, segurança, perfil, avaliações, mapa de acompanhamento, ETA de caráter operacional, cálculo de rota com limites e integridade comercial.
- A interface deixa de executar `tickNavigation`, anunciar primeira manobra e disparar requisições pagas exclusivas de desvio de 42 m/7 s da QA222. A orientação operacional de chegada com movimento comprovado e lembrete de finalização permanece no APOIS. A atualização operacional de rota/ETA da QA201 (até após 3 minutos com deslocamento suficiente, além de troca de fase/falhas permitidas) permanece.

## 4. Entregador

- Antes de `picked_up`, navega para `job.pickup_latitude/longitude` do estabelecimento.
- Em `picked_up`, `on_the_way` ou `arrived_destination`, navega para `job.delivery_latitude/longitude` do cliente.
- Permanecem intactos: aceite/rejeição, confirmação de coleta, PIN/comprovação conforme regras do backend, conclusão do pedido, rastreamento, mapas e métricas comerciais.
- O antigo botão **Rotas** e a abertura pelo Browser nativo foram substituídos pelo seletor compartilhado.
- As consultas pagas do mapa do Entregador já tinham um controle condicional `VITE_APOIS_ENTREGAS_LIVE_ROUTING === "true"` e frequência limitada. A integração não remove as métricas necessárias.

## 5. Retorno ao APOIS, Foreground Service e segundo plano

Não há criação de serviços Android novos. O host reutiliza:
- `DriverLocationService`, mesmo ID e canal de notificação;
- `CourierLocationService`, mesmo ID e canal de notificação;
- seus `PendingIntent` de retorno `br.com.apois.parceiro://module/motorista` e `/entregador`.

Uma ação **VOLTAR AO APOIS** é adicionada às notificações existentes. Quando a atividade recupera a corrida/pedido, um plugin compartilha a condição de operação com um **receptor privado não exportado** registrado pelo serviço de GPS já ativo. O receptor atualiza apenas a notificação. Não é feita chamada `startService` nem `startForegroundService` para atualizar o texto — isso preserva as políticas de reinício dos serviços.

O app mantém a autenticação e reconsulta operações pelo código existente de sessão, lifecycle/Realtime e GPS ao voltar do alternador Android. Nem Google Maps nem Waze podem confirmar automaticamente chegada, PIN ou conclusão de operação. Um botão inserido **dentro** da interface de Google Maps/Waze não está disponível pelos deep links públicos; o retorno é via notificação, Back/alternador ou abertura do APOIS.

Limites reais de Android: force-stop manual, restrições de bateria e políticas de foreground/background podem impedir continuidade; não há aprovação física dessa permanência sem teste com tela bloqueada, dispositivo e ROM reais.

## 6. Impacto nas APIs Google e custos

| Área | Antes | Depois |
|---|---|---|
| Navegação curva a curva do Motorista | Instruções GPS e recálculo de desvio QA222 | Google Maps/Waze externos; sem recálculo QA222 por desvio |
| Motorista — rota/ETA operacional | Compute Routes por etapa + política QA201 3min/450m | Mantida para estimativas necessárias |
| Entregador — rota/ETA operacional | Maps JavaScript, Routes opt-in + 3min/500m se habilitado | Mantida para estimativas necessárias |
| Abertura da navegação externa | Google Maps link no Entregador; navegador interno no Motorista | Intents Google/Waze e URLs universais, sem chave Maps da APOIS |
| Geocoding / Places / Distance Matrix | Sem mudança confirmada nestes fluxos | Não foram modificados; não reivindicar economia sem Cloud Metrics |

**Estimativa ilustrativa, não faturamento medido:** numa hora hipotética com desvios contínuos e respostas bem-sucedidas, um circuito de recálculo a cada 30 s pode chegar a ~120 solicitações/h; o limite operacional remanescente a cada 180 s permite ~20 solicitações/h se também ocorrer o deslocamento exigido. Isso representa até ~100 solicitações/h a menos **nesse subfluxo** (~83%), e não uma redução garantida de 83% nas despesas globais. O custo efetivo depende de free cap, SKU Essentials/Pro/Enterprise, requisições realizadas, quotas e Google Cloud Metrics. A URL de navegação externa não requer chave da API Google Maps da APOIS.

Referências: `https://developers.google.com/maps/billing-and-pricing/pricing`; `https://developers.google.com/maps/documentation/routes/usage-and-billing`.

## 7. Arquivos incluídos/alterados

- **Novo:** `superapp/partner-shell/shared/ApoisExternalNavigation.tsx`
- **Novo:** `scripts/android/APOISExternalNavigationPlugin.java`
- **Novo:** `scripts/install-partner-external-navigation.mjs`
- **Novo:** `scripts/install-partner-external-navigation-ui.mjs`
- **Novo:** `scripts/qa/test-partner-external-navigation-v1.test.mjs`
- **Alterado:** `scripts/build-partner-release.sh`
- **Alterado:** `scripts/install-partner-launcher.mjs`
- **Alterado:** `scripts/audit-partner-preflight-v1.mjs`
- **Novo:** este documento técnico.

Nenhum arquivo das fontes pinadas ou de implantação do backend foi alterado.

## 8. Testes e limites da validação

**Verificações executadas previamente à compilação:** verificação estática de referência em 8 arquivos reais (**16/16 aprovações**), simulação isolada do instalador Android sobre duas classes Service representativas (**6/6 aprovações**) e checagem sintática JS dos três scripts novos. Isso verifica composição e marcadores; **não prova build TypeScript/Gradle nem execução nativa**.

**Validações de compilação necessárias no GitHub Actions:** `npm run build:partner` com as duas fontes protegidas, `node scripts/install-partner-launcher.mjs` após o `cap sync` real e `Gradle assembleDebug`, com conferência de assinatura original. A homologação física Android continua necessária: Google Maps/Waze presentes ou ausentes; GPS em segundo plano e tela bloqueada; retorno por notificação; recuperação após encerramento de processo; E2E reais de ambas as jornadas.

**Critério de aceite pendente:** completar a sequência real `corrida: aceitar → navegar embarque → voltar → chegada → PIN → navegar destino → voltar → finalizar` e `entrega: aceitar → navegar estabelecimento → voltar → coleta → navegar cliente → voltar → concluir`, observando GPS, estado e rastreamento contínuos. 

**Status inicial:** código implementado no branch isolado; **validação parcial (estática/sintética)**. A compilação de APK de teste deve ser verificada no **GitHub Actions**. Não realizar merge, deploy, publicação Play Store, alteração de Cloud/keys ou migração Supabase.