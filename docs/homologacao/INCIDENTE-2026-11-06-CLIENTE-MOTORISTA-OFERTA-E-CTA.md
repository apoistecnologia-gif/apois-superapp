# Incidente de homologação — Oferta não aparece ao Motorista e botão branco invisível no Cliente

**Registrado:** 06/11/2026 (America/Recife) • **Ambiente:** APKs de testes APOIS Cliente + APOIS Parceiro, backend Supabase APOIS Corridas já existente. **Status:** correção de código entregue em branches de teste; verificação física pós-build pendente. Push FCM permanece bloqueado por segredo ausente no servidor.

## Evidência física
- Cliente: tela `Buscando motoristas`, corrida de R$ 18,59, botão branco sem texto imediatamente acima de `CANCELAR CORRIDA`. Captura entregue pelo responsável.
- Parceiro/Motorista: tela `Olá, FRANCISCO`, indicador `ONLINE`, `Recebendo solicitações`, sem card de nova corrida no segundo celular no mesmo teste.
- Esse botão sem texto foi comprovado por inspeção da **versão APK instalada**: o JSX do botão `Reportar problema com esta corrida` apresentava `bg-white/5 text-sm font-bold text-white` em superfície branca. O botão abre `ApoisCaseCenter` e deve continuar funcional.

## Supabase Corridas: diagnóstico SOMENTE LEITURA
Project ref `tbbzkrfupmqdywnzgnms`. A corrida `28fc6b2b-603a-46cf-884b-7c8be4a9fd34` foi criada às 11:04:21 do dia 06/11/2026 (14:04:21Z), origem Rua dos Pombos, destino River Shopping, preço estimado R$ 18,59.
- Status final `cancelada_passageiro`, alteração às 11:04:35; não foi aceita.
- `candidate_driver_ids` e `offered_driver_ids` contêm `4261b88b-3c21-4a11-a197-b400d0fb4602`, que identifica a conta de domínio do motorista Francisco; `dispatch_attempts=1`. A oferta foi persistida corretamente.
- Motorista Francisco tinha cadastro `aprovado`, categoria `carros`, mensalidade `teste`, `is_online=true`, GPS recente. Havia tokens de notificações Android ativos.
- Logs da função `send-ride-push` às 11:04:21: **HTTP 500** com `firebase_secret_missing`, por ausência da configuração `FIREBASE_SERVICE_ACCOUNT_B64`. `request-ride` HTTP 200; registrou `push provider status 500`. **Não houve envio FCM confirmado**.
- A função `send-ride-push` usa `Deno.env.get("FIREBASE_SERVICE_ACCOUNT_B64")`. Restauração do segredo na infraestrutura Supabase é pendência operacional independente; não inserir JSON de chave em código, GitHub, chat ou documentação. Nenhum segredo foi modificado.
- Logs do aparelho Android 13 do Motorista mostram consultas de ofertas antes da criação (14:03:53Z), sem nova consulta de ofertas identificada durante a janela de ~14 segundos da corrida, apesar dos pings de presença após a criação. Isso sustenta a necessidade de fallback efetivo, mas **não prova** qual evento do Realtime faltou nem se a versão instalada possuía V1.

## Correção Motorista — branch `fix/motorista-39-achados-20261105`
- A montagem do Parceiro já aplicava `scripts/harden-partner-motorista-offer-fallback.mjs` com polling V1 de 4s; o código V1 pulava consultas se `!navigator.onLine` e ocultava erros, podendo ficar mudo no WebView.
- Criado `scripts/fix-partner-motorista-offer-recovery-v2.mjs` para substituir o timer V1 existente, sem duplicá-lo: consulta ofertas a cada 4s via Supabase autenticado, com `candidate_driver_ids`, estado `procurar_motorista`, sem driver atribuído, uma requisição por vez, erro registrado, sem depender de FCM ou do indicador `navigator.onLine`. Conserva validação de candidatura, expiração e RPC de aceite originais.
- Teste `scripts/qa/verify-partner-motorista-offer-recovery-v2.mjs` validou estrutura no código gerado. GitHub Actions Parceiro [#118](https://github.com/apoistecnologia-gif/apois-superapp/actions/runs/42234321905) **SUCCESS**, APK `APOIS-Parceiro-TESTE` com assinatura QA original mantida, artifact `13510434448`. **Teste físico da oferta ainda pendente.**

## Correção Cliente — branch `fix/passageiro-ocorrencias-safearea-20261105`
- Corrigido no gerador `scripts/harden-corridas-case-center-v1.mjs`: botão `Reportar problema com esta corrida` de `bg-white/5 ... text-white` para `bg-white ... text-[#991B1B]`, preservando clique `setShowCaseCenter(true)` e botão `CANCELAR CORRIDA`.
- Teste `scripts/qa/verify-corridas-active-ride-case-cta-contrast-v1.mjs` integrado após o case center, passou na QA Web [#92](https://github.com/apoistecnologia-gif/apois-superapp/actions/runs/42235164530). QA Web geral ainda falha por 12 erros TypeScript preexistentes, não diretamente ligados ao contraste.
- Uma tentativa inicial exploratória de alterar o card `RideStopsTimeline` foi revertida: não era a causa do espaço branco e impactava gate de proporções mobile. Nenhum ajuste especulativo de card permanece.
- Corridas, mapas, notificações, pagamentos e Entregas permanecem inalterados, exceto ajustes visuais do CTA. O APK precisa ser validado contra o resultado da build específica; não declarar teste físico concluído.

## Próximos passos para outros chats
1. Instalar APK Parceiro #118 e APK Cliente mais recente da branch de correção, manter assinatura QA fixa.
2. Com Motorista online em primeiro plano, solicitar nova corrida do Cliente; verificar que card aparece, aceitar, iniciar, finalizar, cancelar e checar reset corretamente; inspecionar logs somente leitura se falhar.
3. Restaurar `FIREBASE_SERVICE_ACCOUNT_B64` no ambiente Supabase Corridas **somente por canal seguro e com autorização operacional**, validar FCM com testes controlados e sem enviar notificação para usuários reais; o fallback não substitui push quando app fechado/background.
4. Corrigir posteriormente as falhas antigas de TypeScript via escopo próprio; não suprimir gates.
5. Não alterar dados de produção, secrets de produção nem realizar deploy sem autorização separada.

## Resultado adicional após compilações de 06/11/2026
- **Parceiro Android #118:** assinado e distribuído via GitHub artifact `13510434448`; SHA-256 **do arquivo APK** `283fd2d333f09fed7081d6dcdaa336041b4562588fe27518050c6fc08f6f1d62`. Novo JS `modules/motorista` contém consultas por `candidate_driver_ids`. Preservada assinatura QA. Necessária validação de toque/alerta na tela real.
- **Cliente Android #93:** [execução](https://github.com/apoistecnologia-gif/apois-superapp/actions/runs/42235799031), job `build-client-apk` **SUCCESS** (assinatura QA e APK verificados), artifact `13512515910`. SHA-256 **do APK** `8b9cde0b76c6de786a9f17748a49bf8e1586a394d970420c3e0d13ade5ec614f`. Inspeção direta do APK confirmou que `Reportar problema com esta corrida` usa `bg-white text-sm font-extrabold text-[#991B1B]` e `onClick: setShowCaseCenter(true)`, preservando o cancelar. O gatilho excepcional usado apenas para gerar #93 foi removido.
- O job paralelo `Corridas Passenger Web QA` da #93 mantém erros TS anteriores, sem ligação comprovada com o CTA. Não apresentar essa execução como CI global verde.
- Pendência operacional: `FIREBASE_SERVICE_ACCOUNT_B64` ausente no ambiente da função Supabase `send-ride-push`; não pode ser resolvida via APK nem foi restaurada. Não declarar recebimento push como validado.
- Nenhum dado, papel, motorista, corrida, pagamento ou função Edge de produção foi alterado. Próximo passo é homologação física com os dois APKs atualizados.
