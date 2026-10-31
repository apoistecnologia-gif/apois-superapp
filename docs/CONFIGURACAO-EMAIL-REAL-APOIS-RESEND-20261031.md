# APOIS Corridas — configuração do envio real de e-mails de pendência

Situação verificada em 31/10/2026: a função de produção `apois-driver-review-mailer` existe (ACTIVE v1, verify_jwt=true), com fila no banco desde a migration `20261031173347`. **Ainda não foi comprovado que os segredos do provedor e o remetente estão configurados.** Nenhuma mensagem de teste ou notificação artificial foi disparada.

## Domínio e remetente
- Marca: APOIS.
- Domínio institucional: `apoisbrasil.com.br`, associado à Vercel, mas nameservers autoritativos apontam para **HostGator**: `dns3.hostgator.com.br`, `dns4.hostgator.com.br`. Os registros DNS que autenticam o remetente NÃO devem ser adicionados na zona Vercel, que não é autoritativa.
- Recomendação de isolamento: cadastrar no Resend o **subdomínio de envio** `avisos.apoisbrasil.com.br` e usar o remetente `APOIS Cadastros <cadastro@avisos.apoisbrasil.com.br>`. Isso não altera o MX do domínio institucional nem caixas de entrada existentes.
- No Resend, adicionar o subdomínio em **Domains** e escolher uma região compatível. O provedor exibirá os registros **DKIM, SPF e, se exigido, MX/TXT de retorno** com valores específicos. Copiar exatamente os valores do painel; não inventar tokens nem trocar registros já existentes. Publicar no gerenciador de zona DNS da **HostGator**, depois executar **Verify** no Resend.
- Para reputação e entregabilidade, revisar DMARC de forma compatível com os sistemas existentes. Não substituir SPF do domínio principal inadvertidamente.
- Consultar status `Verified` para envio no Resend antes de prosseguir.

## Chave de produção e segredos
- Em **Resend → API Keys → Create**, criar `APOIS Corridas - Notificações Produção` com permissão **Sending access**, preferencialmente restrita ao subdomínio de envio. Não usar `Full access`.
- No **Supabase de Corridas `tbbzkrfupmqdywnzgnms` → Edge Functions → Secrets**, configurar:
  - `RESEND_API_KEY` = chave gerada **diretamente no Dashboard** (nunca enviar ao ChatGPT, e-mail, repositório, screenshot ou conversa).
  - `APOIS_EMAIL_FROM` = `APOIS Cadastros <cadastro@avisos.apoisbrasil.com.br>`.
- O Supabase injeta `SUPABASE_URL`, `SUPABASE_ANON_KEY` e `SUPABASE_SERVICE_ROLE_KEY`; não copiar credenciais do banco para segredos sem necessidade.
- O runtime carrega segredos atualizados sem redeploy de função. O usuário precisa de permissões Owner/Administrator para gravá-los.
- **Conexão atual não fornece ferramenta de gravação de segredos nem integração da conta Resend/HostGator**; portanto, sem essa etapa humana, o envio ainda não é operacional.

## Gatilho correto e prova de operação
1. Com serviço de e-mail verificado, iniciar sessão com conta **Admin autorizada** e realizar um pedido de correção de cadastro de motorista de teste autorizado.
2. RPC `apois_admin_request_driver_correction` grava pendência, notificação no app e linha `apois_driver_correction_email_outbox` (queued).
3. Painel chama a função `apois-driver-review-mailer` com JWT do administrador e `request_id`, nunca com chave do Resend.
4. A função verifica a conta e autorização `users.manage`, lê a fila, envia ao Resend e registra `status=accepted_by_provider`, `provider_id`, `attempts` e `accepted_at` somente após sucesso 2xx. Repetições usam chave de idempotência.
5. Conferir no Resend Emails se a mensagem aparece como accepted e depois delivered/bounced; conferir chegada à caixa de teste e Spam. **Aceito pela API não equivale a entregue.**
6. Adicionar depois webhooks autenticados para eventos `email.delivered`, `email.bounced`, `email.complained` caso a empresa precise de trilha de entrega independente da mera aceitação.

## Não confundir com os aplicativos atuais
- Migração de base e função de e-mail foram publicadas; a tela administrativa de pendenciar está no código de homologação mas **não foi publicada nos apps/painel de produção**.
- A regra de exigência de 13 fotos e 10 anos permanece intencionalmente desligada no servidor até liberação coordenada com a versão nova.
- Não criar chamados ou pendências reais apenas para demonstrar envio sem consentimento dos envolvidos.

Referências oficiais:
- https://resend.com/changelog/new-api-key-permissions
- https://resend.com/changelog/domain-verification-events
- https://supabase.com/docs/guides/functions/secrets
