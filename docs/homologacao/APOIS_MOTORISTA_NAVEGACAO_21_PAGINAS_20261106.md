# APOIS Motorista — correção transversal das páginas, menus e abas (06/11/2026)

**Estado:** modificações de fonte registradas na branch `fix/apois-corridas-e2e-homologacao-20261106`; **não houve geração de APK/AAB, build web, deploy ou migração aplicada em produção**.

## Origem e isolamento

- Auditoria visual: vídeo `1001992571.mp4` e gravação anterior do ciclo de corridas.
- Fonte canônica pinada em `sources/apois-corridas-motorista-admin`, commit `9fc171050d8b5703540c49d19a8f1e9f5162775f`.
- Aplicação após hardeners existentes somente em `.work/partner-motorista`.
- Não editar APOIS Entregas, não alterar pricing, gateway, cobrança, comissões ou contas de produção.
- Pagamentos em dinheiro e cartão são feitos diretamente ao motorista, que recebe o valor integral; mensalidade Motorista R$ 59,90 para novos contratos, sem alterar contratos antigos.

## Erros de navegação efetivamente identificados

1. Configurações → **Alterar senha** levava a `/motorista/seguranca` (SOS), embora o formulário de senha esteja em `ProfileForm`. Agora abre a edição real do Perfil por intenção de navegação de uso único.
2. Perfil → **Veículo e documentos** e **Documentos** tinham a mesma rota `/motorista/documentos`. Agora existe **uma** entrada, preservando estado documental.
3. Perfil → **Privacidade e segurança** levava apenas à política de privacidade. Substituído por **Configurações**, caminho único para segurança, privacidade, notificações e suporte. A página SOS segue separada.
4. Menu lateral tinha **Perfil** no cartão clicável e novamente na lista. A duplicação da lista foi retirada; o cartão e a aba inferior continuam abrindo o Perfil.
5. Configurações repetia **Perfil** e **Telefone e e-mail** com o mesmo destino. Mantida uma entrada.
6. Configurações repetia **Central de ajuda**, **Perguntas frequentes** e **Falar com suporte** com o mesmo destino. Consolidada uma opção com todas as funções da central.
7. Configurações exibia sessões, biometria e PIN como botões de “em breve”. Removidos os controles falsamente acionáveis até implementação real, sem mexer na autenticação existente.
8. Menu lateral distinguia pouco as funções de Carteira/Ganhos. Os textos foram esclarecidos; **ambas as páginas e seus recursos continuam presentes**.
9. Configurações tinha chaves locais de som/vibração/alertas enquanto `/motorista/preferencias-notificacoes` possui opções que efetivamente usam `user_notification_preferences` + preferências de dispositivo. Foi concentrada a configuração de categorias e canais nessa página; a permissão push nativa segue na tela principal.
10. “Idioma” permitia inglês/espanhol mesmo sem tradução correspondente nas páginas. Substituído por estado informativo “Português (Brasil)” sem oferecer seleção falsa.
11. Configuração de navegação Waze/Google era armazenada, mas os botões “Navegar” abriam sempre Google. A escolha salva passa a determinar o link externo; mapa interno permanece disponível.
12. Chat nas corridas era botão que só mostrava “Chat em breve”. Permanece visualmente desabilitado, sem enganar o usuário nem simular integração inexistente.
13. Foto do Perfil abria seletor WebView, diferentemente do cadastro, que já tinha seletor nativo Android. O perfil do **motorista** passou a usar o helper nativo já existente, mantendo compactação/validação/upload/RPC e fallback WebView fora do Android.

## Matriz das 21 rotas Motorista auditadas

| Rota | Estado nesta rodada |
|---|---|
| `/motorista/app` | Ajustado atalho de navegação e chat não funcional; ciclo de corridas e mapas preservados |
| `/motorista/corridas` | Link auditado; histórico preservado |
| `/motorista/corridas/$id` | Link auditado; detalhes preservados |
| `/motorista/carteira` | Mantida distinta de Ganhos; sem alteração financeira |
| `/motorista/ganhos` | Mantida distinta de Carteira; texto do menu esclarecido |
| `/motorista/notificacoes` | Caixa de avisos mantida; link único em Configurações |
| `/motorista/preferencias-notificacoes` | Passa a ser destino canônico de tipos de alerta/som/vibração |
| `/motorista/perfil` | Duplicação documental removida; acesso a configurações e seletor nativo de foto preparados |
| `/motorista/configuracoes` | Navegação corrigida, ações falsas retiradas, permissões e prefs preservadas |
| `/motorista/seguranca` | Mantida para SOS e contatos de emergência; senha não aponta mais para ela |
| `/motorista/status` | Status cadastral preservado, distinto do diagnóstico operacional |
| `/motorista/documentos` | Tela documental preservada, com entrada única no Perfil |
| `/motorista/regalias` | Link e acesso preservados |
| `/motorista/assinatura` | Preservada, sem gateway novo nem cobrança |
| `/motorista/suporte` | Central preservada com um link no grupo de Configurações |
| `/motorista/privacidade` | Página legal preservada, sem confusão com SOS |
| `/motorista/termos` | Rota existe; texto indica versão preliminar — requer publicação oficial |
| `/motorista/login` | Autenticação preservada |
| `/motorista/cadastro` | Cadastro e suas validações preservados |
| `/motorista/recuperar-senha` | Recuperação por e-mail preservada |
| `/motorista/redefinir-senha` | Recuperação por link seguro preservada |

As rotas da matriz foram localizadas no repositório pinado; busca estática nos links literais das 21 páginas não encontrou destinos internos inexistentes. Isso NÃO equivale a testes de clique em aparelho.

## Arquivos de correção e gates acrescentados nesta etapa

- `scripts/fix-apois-motorista-navigation-canonical-v1.mjs`
- `scripts/verify-apois-motorista-navigation-canonical-v1.mjs`
- `scripts/fix-apois-motorista-notifications-hub-v1.mjs`
- `scripts/verify-apois-motorista-notifications-hub-v1.mjs`
- `scripts/fix-apois-motorista-settings-real-actions-v1.mjs`
- `scripts/verify-apois-motorista-settings-real-actions-v1.mjs`
- `scripts/fix-apois-motorista-profile-native-photo-v1.mjs`
- `scripts/verify-apois-motorista-profile-native-photo-v1.mjs`
- `scripts/build-partner-release.sh` (apenas inclusão dos scripts no trecho Motorista)

## Evidências de validação obtidas

- Fonte das 21 rotas e menus inspecionada diretamente no GitHub.
- Patch do menu, Configurações e Perfil executado em simulação de transformação sobre arquivos reais pinados: OK.
- Patch de notificações + navegação externa + idioma testado sequencialmente em simulação de transformação: OK.
- Patch do seletor nativo de foto testado em simulação de transformação: OK.
- Os scripts JavaScript novos passaram por checagem sintática local no ambiente de execução.
- Gates estáticos estão versionados para execução na próxima preparação de fonte.

**Não realizado:** compilação TypeScript, suite automatizada completa, teste de integração com usuários QA, validação Android, geração de APK, build web, deploy, push de notificação, alteração de produção. **Não declarar homologação concluída.**

## Pendências técnicas que não devem ser escondidas

- Upload e exibição de fotografia: requer testar o Android nativo e aplicar/verificar em staging a política restrita de leitura do bucket privado já preparada; não há prova de que isso sozinho resolva o erro de upload do vídeo.
- Perfil público e contagem de corridas: consulta de contagem canônica preparada em migração **não aplicada**, exige staging e revisão de permissões.
- Finalização antecipada e sincronização Passageiro/Motorista: ainda precisa de contrato auditável no servidor para diferenciar encerramento antes do destino.
- GPS em segundo plano, push com app fechado, voz, recuperação de sessão, custos e conectividade intermitente: testar em dispositivo e com backend de homologação.
- Chat: permanece indisponível. Não foi inventado backend de mensagens.
- Textos legais de Termos de Uso: tela indica versão preliminar; publicação oficial depende de conteúdo aprovado.
- Regressões TypeScript/RLS: somente um teste executado sobre o workspace completo permite afirmar compatibilidade definitiva.

## Resultado

**Correções de navegação/configurações aplicadas ao código, não homologadas fisicamente. 21 rotas examinadas, nenhum APK gerado. Não liberar produção.**
