# QA238 Cliente — investigação e regressão (13/11/2026)

Base QA237: 7c902e72c59f86a8968f9395ffee24a04ec87ed9. Branch de homologação: fix/apois-cliente-qa238-mapa-livre-20261113.
A captura da QA237 mostra cartão de região, aviso de ausência de motoristas, mensagem de carteira e botão de recálculo sem destino. QA238 removeu sobreposições via adaptadores QA217/QA218, preservando os marcadores reais e perfil. Corrigiu-se ainda o recálculo indevido com bloqueio financeiro ou de autenticação, e o alias singular/plural das imagens de categoria Moto/Carro. Testes de regressão da montagem gerada obrigatórios. Submódulos protegidos não modificados.

Supabase Corridas (tbbzkrfupmqdywnzgnms), consultas SELECT somente: quatro carteiras, uma bloqueada, com motivo «Há taxa de cancelamento pendente»; uma taxa pendente de R$ 5,00 vinculada à carteira bloqueada. Corrida criada 13/11/2026 13:05:31 UTC, aceita 13:05:44 UTC, cancelada pelo passageiro 13:09:10 UTC; taxa pending e is_paid=false, aceita por motorista. Não houve alteração financeira. Falta correlacionar a identidade autenticada da captura e validar regra comercial/regularização no aparelho.

Notificações: Edge Function send-ride-push ativa v5; 46 tokens ativos concedidos registrados para quatro usuários de domínio, mas nenhum notification_logs nos últimos 14 dias. Job QA238 tinha CORRIDAS_FIREBASE_PROJECT_ID e FIREBASE_SUPERAPP_GOOGLE_SERVICES_JSON_BASE64 vazios; push de Corridas permanece desabilitado. Validar antes de ligar que google-services.json do br.com.apois.app e FIREBASE_SERVICE_ACCOUNT_B64 da função pertencem ao mesmo Firebase. Não se expôs segredo.

Faltam instalação física, pagamento/baixa real da multa, disparo FCM em foreground/background/terminado e revalidação completa da interface. Não se alterou Parceiro, Entregas, produção, GitHub Actions do Parceiro, nem houve merge ou Play Store.
