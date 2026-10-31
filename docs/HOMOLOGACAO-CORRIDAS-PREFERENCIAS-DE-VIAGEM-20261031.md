# APOIS Corridas — preferências de conforto do passageiro | Homologação QA

Data: 31/10/2026. Somente branch `fix/entregas-homologacao-ajustes-20261030`; fontes pinadas permanecem somente leitura.

## Requisito confirmado
No Cliente Corridas, na etapa **Revisar solicitação**, passageiro de categoria **carros** escolhe, de forma opcional:
- Conversa: Sem preferência / Prefiro silêncio / Pode conversar.
- Música: Sem preferência / Quero ouvir música / Prefiro sem música.
- Ar-condicionado: Sem preferência / Prefiro ligado / Prefiro desligado.

As três escolhas começam em *Sem preferência* e valem para a corrida que será solicitada (não são ajuste global de cadastro nem escolha obrigatória). O motorista vê o resumo **antes do aceite** e nas etapas de embarque, espera e trajeto. Preferência é cortesia, sujeita a segurança/condições do veículo.

## Implementação de código
- `scripts/fix-corridas-ride-comfort-preferences-v1.mjs`, executado pelo `scripts/build-isolated-module.mjs` sobre `.work/corridas`: preserva `selectedCategory.details` e adiciona `ride_comfort_preferences` aninhado a `service_details` existente. Mantém request_key, destino, pagamento e regras de tarifa.
- `scripts/fix-partner-motorista-ride-comfort-v1.mjs`, executado pelo `scripts/build-partner-release.sh` sobre `.work/partner-motorista`: cria `ApoisRideComfortCard`, extrai somente os valores permitidos de `ride.service_details`, mostra na oferta e em painéis da corrida. Corridas antigas sem o campo não exibem o cartão e continuam válidas.
- `scripts/verify-corridas-ride-comfort-v1.mjs` e `scripts/verify-partner-motorista-ride-comfort-v1.mjs`: testes estáticos integrados aos respectivos builds, garantindo contrato tipado, persistência sem sobrescrever detalhes e cartões do Motorista, sem SELECT adicional a passageiros.

## Backend e preço
- Estrutura **já existente em produção**: `public.rides.service_details` JSONB, sem nova tabela ou migração. O Edge Function **`request-ride` v16**, consultado diretamente no Supabase de Corridas, lê `body.service_details`, usa a lógica de tarifa existente e persiste os detalhes junto ao pedido. Tarifação por carros não interpreta `ride_comfort_preferences` como adicional.
- Política `rides_driver_read_relevant` mantém o acesso do motorista somente às ofertas e corridas relevantes; não foi ampliada. Não compartilhar localização, telefone ou perfil em outra API. Nenhuma alteração em dados/SQL/Edge Function de produção para este recurso.
- Valores são opcionais e restritos no código Cliente e no parser Motorista; não tratá-los como confirmação de serviço ou obrigação contratual.

## Verificação e estado
- GitHub Actions [41219517634](https://github.com/apoistecnologia-gif/apois-superapp/actions/runs/41219517634): três jobs `WEB-only cliente`, `WEB-only estabelecimento` e `audit-web-only` concluídos **SUCCESS**.
- Logs do auditor: `[OK] Motorista: ride comfort before acceptance, pickup, active trip, other stages` e `[OK] Motorista: per-ride conversation/music/A-C visible before accept and during trip`. Cliente validado em build WEB e script estático próprio.
- **Não houve APK/AAB, publicação, merge, deploy ou criação de corridas para testes.**
- Pendente E2E Android: escolher preferências no Cliente, confirmar solicitação, verificar recebimento na oferta Motorista e permanência nos estados após aceite, segundo plano e retomada; confirmar tarifa idêntica e ausência de vazamento de dados.
- Pendências herdadas paralelas não foram declaradas resolvidas: PIN Cliente/Entregador, avaliação de produtos, painel estabelecimento publicado, concorrência real na Central de Chamadas e regularização do secret QA de assinatura Cliente.
