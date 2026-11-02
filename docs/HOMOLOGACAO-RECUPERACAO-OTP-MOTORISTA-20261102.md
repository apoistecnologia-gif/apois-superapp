# APOIS Corridas — recuperação de senha por código OTP (Motorista)

**Data:** 02/11/2026  
**Implementação recuperada:** Portal do Estabelecimento APOIS, `apoistecnologia-gif/apois-entregas`, branch histórica `fix/apois-portals-recovery-20261028`; commits `f5aab763`, `a7fcbd6a`, `2bf19b28`, `5182138d`, `72bbc75f`.

## Estado e escopo

- Código do **Motorista**, somente em `apoistecnologia-gif/apois-superapp` / branch de homologação `fix/entregas-homologacao-ajustes-20261030`, aplicado no workspace descartável `.work/partner-motorista` após o saneamento visual.
- Motorista solicita recuperação com `supabase.auth.resetPasswordForEmail(email)`; informa o mesmo e-mail e um OTP numérico de 6–8 dígitos; chama `supabase.auth.verifyOtp({email,token,type:"recovery"})`; **somente após sessão confirmada**, abre `/motorista/redefinir-senha`. A senha é atualizada pela função oficial `updateUser`, com retorno ao login.
- O fluxo não exige abrir link no navegador, evita consumo antecipado de link por scanners e não salva código, token ou senha em banco próprio.
- Conta de passageiro e conta de motorista podem compartilhar o mesmo endereço do Supabase Corridas; redefinir senha altera a senha da conta compartilhada.
- Sem alteração da tela do Cliente ou Entregador, sem migrations e sem APK nesta alteração de código.

## Etapa obrigatória no Supabase Corridas

Projeto correto: `tbbzkrfupmqdywnzgnms` — **não** `ptgkwyyolrdgnqketkjj` (Entregas).

Painel: **Authentication → Email Templates → Reset Password**.

1. Antes de alterar, copie e guarde o conteúdo atual do modelo de recuperação.
2. Cole o HTML versionado em `docs/email-templates/APOIS-CORRIDAS-RECOVERY-OTP.html`.
3. Assunto sugerido: `APOIS | Código para redefinir a senha`.
4. Confira que o HTML contém **`{{ .Token }}`** e mantém **`{{ .ConfirmationURL }}`** para aplicações antigas, sem desativar métodos existentes.
5. Salve. **A configuração do modelo de e-mail é de produção e afeta todos os módulos que utilizam Auth Corridas.** Não altere templates de confirmação, convite, SMTP ou Auth de Entregas.

**Importante:** a integração Supabase disponível nesta sessão não oferece ação para alterar templates de Auth. O código foi versionado, mas o modelo de produção não foi modificado. Não declarar envio de OTP funcionando até que o modelo seja configurado e o teste real seja aprovado.

## Aceite de homologação

- Instalar uma APK nova produzida **após** os testes web/React aprovados (APK anterior V8 não contém a nova UI).
- Motorista → Esqueci minha senha: e-mail em letras escuras, botão `Enviar código por e-mail`, campo `Código de verificação`.
- Solicitar código para uma conta de teste existente, com autenticação válida; não expor se um e-mail existe.
- Verificar recebimento do e-mail com código numérico sem depender do link. Não usar outro código já consumido.
- Testar código incorreto, código expirado, 6 ou 8 dígitos conforme o template real, código correto e encaminhamento para `Crie uma nova senha`.
- Alterar a senha somente após a validação correta; conferir login do Motorista e Passageiro com a nova senha.
- Confirmar que nenhum usuário novo foi criado, nenhum status de aprovação foi modificado e a conta permanece única.
- Regressões: Cliente Corridas (modelo mantém link), Entradas de OTP de Entregas (projeto Supabase separado), login Google, recuperação de sessão, navegação e menu.

## Segurança

- Não salvar nem enviar capturas do código de recuperação ou do link completo.
- Supabase controla validade e uso único do código.
- O botão de solicitação tem bloqueio local de 60 segundos e o servidor também aplica rate limiting.
- Mensagens de sucesso não revelam a existência de contas; falhas de verificação não incluem o código.
- O modelo `{{ .ConfirmationURL }}` deve permanecer para clientes antigos enquanto a migração OTP de outros apps não for homologada.
