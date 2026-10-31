# APOIS Corridas — 13 fotografias, veículos de até 10 anos e correção de cadastros

Data: 31/10/2026. Implementação QA na branch `fix/entregas-homologacao-ajustes-20261030`, sem alterações nos repositórios de origem pinados.

## Regra comercial aprovada
Para **novos motoristas de carros**, ano de **fabricação** nos últimos dez anos civis, inclusive o limite. Em 2026: **2016 a 2026**. O filtro do formulário é dinâmico (`ano corrente - 10`) e o mesmo cálculo é exigido pelo trigger no servidor na transição para `aprovado`. Não aplicar retroativamente a contas já aprovadas sem uma decisão comercial/jurídica específica.

### Fotos obrigatórias (13)
1. Frente do carro e placa legível (campo de foto do veículo já existente);
2. Lado direito;
3. Lado esquerdo;
4. Painel;
5. Bancos dianteiros;
6. Bancos traseiros;
7. Pneu dianteiro esquerdo;
8. Pneu dianteiro direito;
9. Pneu traseiro esquerdo;
10. Pneu traseiro direito;
11. Cintos dianteiros;
12. Cintos traseiros;
13. Faróis **acesos**, ambos visíveis.

O formulário explica mostrar banda de rodagem/sulcos e lateral dos pneus, cintos e fechos, e faróis acesos. Os cinco primeiros ângulos complementares foram ampliados para doze; o total de documentos de cadastro/progresso passou de quatro para **dezesseis itens**, pois CNH, CRLV e selfie continuam sendo controles separados dos treze ângulos.

## Código QA implementado
- `scripts/fix-partner-driver-vehicle-photo-form-v1.mjs`: cadastro com as treze fotos obrigatórias para carros, sem impor as treze categorias a motos/fretes/guincho/envios.
- `scripts/fix-partner-driver-vehicle-photo-upload-v1.mjs`: nomes exclusivos e `upsert:false`, originais anexados à vistoria com acesso privado, sem sobrescrita de prova anterior.
- `scripts/fix-partner-driver-manufacture-year-v1.mjs`: explicita fabricação e bloqueia ano fora da faixa no formulário e no envio.
- `scripts/fix-partner-admin-vehicle-inspection-v1.mjs`: galeria e aprovação/reprovação foto a foto, links assinados de dez minutos, com auditoria de decisão e motivo.
- `scripts/fix-partner-admin-pendencies-preview-v1.mjs`: pré-visualização de imagens e documentos **dentro do Admin**; formulário de `Pendenciar cadastro` com itens selecionáveis, justificativa obrigatória e acionamento separado de e-mail transacional.
- `scripts/fix-partner-driver-correction-center-v1.mjs`: em Status e Meus documentos, mostra o motivo e itens para corrigir, permite foto nova para ângulos solicitados, ano de fabricação corrigido por RPC e botão para solicitar nova análise após o reenvio.
- `scripts/verify-apois-13-photo-driver-pendencies-v1.mjs`: gates dos 13 ângulos, regra de idade, privacidade, mensageria e integração de telas.

## Banco preparado, mas NÃO APLICADO em produção
Base: `supabase/corridas-forward-migrations/20261031_vehicle_inspection_and_cases_QA_NOT_APPLIED.sql`.
Complemento: `supabase/corridas-forward-migrations/20261031_driver_correction_notifications_QA_NOT_APPLIED.sql`.
- Os treze ângulos devem estar presentes, e a **última imagem de cada ângulo** aprovada para o mesmo veículo/placa antes de aprovar um carro novo. Regra dinâmica da idade de fabricação no servidor.
- A pendência administrativa preserva o cadastro, marca `documents_status=correction_required`, mantém o motorista offline e grava a lista de itens e justificativa; não aprova nem bloqueia automaticamente. A ação é restrita à equipe com permissão `users.manage`, somente cadastros ainda não aprovados.
- Os pedidos ficam numa tabela própria de correções com trilha de estado e `audit_logs`; um pedido em `correction_required` bloqueia a aprovação mesmo que outro componente tente aprovar diretamente.
- Uma notificação persistente é inserida em `public.notifications`, cuja leitura por RLS é restrita à conta do motorista. A tela e a lista em `/motorista/notificacoes` preservam o histórico.
- Novos arquivos sob `apois-inspections` são enviados com caminho exclusivo e sem sobregravar fotos anteriores. O motorista pode declarar reenvio, mas isso retorna a **análise humana**, não aprova automaticamente.
- Tabelas `apois_driver_correction_requests` e `apois_driver_correction_email_outbox`, RLS ativo e sem acesso direto aos dados sensíveis; RPCs autenticadas validam `auth.uid()` e proprietário/permissão.
- Em 31/10/2026 os dois SQLs compilados juntos num bloco `BEGIN ... ROLLBACK`, e `apois_driver_my_corrections()` sem autenticação retornou lista vazia. **Nenhuma migração foi aplicada**.

## E-mail: processo seguro preparado, ainda NÃO operacional em produção
- `supabase/functions/apois-driver-review-mailer/index.ts` usa provedor Resend, e-mail derivado da própria conta, fila durável, chamada autorizada somente por pessoal `users.manage`, segredo servidor e chave de idempotência. Não expõe a chave no app.
- Configurar domínio de remetente e segredos `RESEND_API_KEY` e `APOIS_EMAIL_FROM` no projeto Corridas; **implantar a Edge Function com JWT verificado** na mesma janela de release. Sem esses elementos, o Admin indica “E-mail pendente” e a notificação do aplicativo continua persistida.
- O estado `accepted_by_provider` significa API do serviço aceitou a mensagem; **não comprova entrega à caixa do destinatário**. Para comprovação de entrega/bounce, integrar posteriormente webhook autenticado e guardar eventos da plataforma.
- Não criar remetente falso, nem exibir “e-mail entregue” antes de confirmação do provedor.

## Homologação e liberação
- Build WEB-only e segurança, sem APK/AAB e sem produção, na branch QA; confirmar o último run Actions após o último commit.
- Testar: (a) carro 2015 reprovado em 2026, 2016 aceito no critério etário; (b) 13 fotos enviadas e revisadas; (c) ausência/reprovação de qualquer foto impede aprovação; (d) Admin solicita apenas pneus/cinto/farol; (e) notificação aparece no perfil certo; (f) reenvio mantém anteriores e fica aguardando reanálise; (g) usuário estranho não acessa as provas; (h) e-mail só marca aceito quando Resend responder sucesso; (i) módulos Cliente, Entregador e pagamentos inalterados.
- Implantação coordenada necessária: **não aplicar o trigger de aprovação antes de publicar o app atualizado**, sob risco de impedir novos cadastros. Nem publicar a interface antes de aplicar tabelas, políticas e a Edge Function.
- Auditoria documental não equivale a laudo mecânico; sugerir declaração do motorista, manutenção, inspeções por amostragem e política de guarda de provas. Imagens comprimidas no fluxo cadastral não constituem “original bruto” da câmera.

**Situação:** recursos escritos e conectados na QA; servidores de produção e APKs atuais permanecem inalterados por esta melhoria.
