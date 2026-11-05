# ADR — APOIS Android: homologação pelo GitHub e assinaturas definitivas somente antes do lançamento
**Data:** 2026-11-05
**Status:** decisão aprovada pelo responsável do projeto, execução técnica em andamento.
**Escopo:** APOIS Cliente (corridas e entregas) e APOIS Parceiro (motorista e entregador). NÃO alterar APOIS Entregas isoladamente.

## Decisão do responsável — não rediscutir em futuros chats

- Nenhum aplicativo APOIS foi publicado oficialmente na Google Play; os APKs atuais são de **testes**.
- **Continuar os testes e gerar APKs pelo GitHub Actions**, não exigir Codemagic para homologação.
- Está **autorizado desinstalar o APK de testes anterior e instalar o novo APK** em caso de assinatura incompatível. AVISAR ANTES que isso pode apagar dados locais (preferências, sessões, offline). NÃO excluir contas/servidores.
- **Usar uma chave nova, FIXA, EXCLUSIVA DE HOMOLOGAÇÃO para o APOIS Cliente**, mantida em GitHub Actions Secrets e em backup local seguro. NÃO criar chave aleatória em cada build. Não substituir silenciosamente a identidade QA do Parceiro.
- **Criar/configurar as chaves e a estratégia definitivas de PRODUÇÃO somente na preparação do lançamento oficial**, após concluir testes, antes de publicar na Play Store ou distribuir APKs de produção. Em produção, definir Google Play App Signing, chaves de upload, backup, fingerprints Firebase/OAuth/Maps, continuidade de atualizações e eventual distribuição fora da Play Store.
- A chave QA NÃO vira automaticamente a chave de produção; as assinaturas de produção serão tratadas e aprovadas separadamente.
- Preservar repositórios, Supabase, autenticação, pagamentos, mapas, regras de corridas/entregas, funcionalidades e fonte pinada. Não fazer merge ou deploy em produção só por causa desta ADR.

## Identificadores oficiais atuais
- APOIS Cliente — corridas + entregas: `br.com.apois.app`.
- APOIS Parceiro — motorista + entregador: `br.com.apois.parceiro`.

## Estado técnico verificado em 05/11/2026
- Repositório: `apoistecnologia-gif/apois-superapp`.
- Branch de correções Cliente (ocorrências e busca): `fix/passageiro-ocorrencias-safearea-20261105`.
- Branch de correções Motorista: `fix/motorista-39-achados-20261105`.
- GitHub Actions Cliente: `.github/workflows/apois-client-android.yml`.
- A identidade QA antiga do Cliente (fingerprint SHA-256 começando em `97:EA:F6:4E`) não está disponível nem no Secret existente nem no cache restaurável; APK de Cliente falhou ANTES do build Android em execução #77.
- A chave de debug do notebook (`4A:34:76:B9`) é OUTRO certificado. `movvi-release.jks` é outra entrada, senha desconhecida, **não confirmada** como QA Cliente. Não substituir ou excluir.
- Existe release signing do Codemagic referenciado como `apois_entregas_release`, atualmente usado no YAML de release de Cliente e Parceiro; a identidade release é diferente das QA. NÃO alterar essa identidade agora.
- O Parceiro possui uma identidade QA protegida que já permitiu gerar APKs pela Actions; deixá-la intacta.
- O módulo Cliente compilou e passou testes específicos de ocorrências e busca de destino (#79); typecheck completo detectou erros anteriores/externos ao escopo (#80). Não confundir build web com homologação Android.
- Não houve nenhuma publicação em loja: a escolha de assinatura definitiva ainda pode ser preparada corretamente.

## Padrão de homologação Cliente aprovado
1. Gerar **uma única vez** um keystore de depuração do Cliente no computador do responsável, em pasta própria, usando alias `androiddebugkey` e credenciais QA esperadas pelo workflow (`android`, apenas para testes). Não usar o keystore release do Codemagic.
2. Registrar a cópia em `APOIS_CLIENT_QA_DEBUG_KEYSTORE_BASE64` como **GitHub Actions Secret**. O valor base64 da chave é sensível: nunca colocar em conversa, commit, log ou issue.
3. Registrar o SHA-256 **público** do certificado em `APOIS_CLIENT_QA_CERT_SHA256` como segundo Secret (ou pin em código depois de auditado). O workflow deve falhar se ausente ou diferente, sem gerar outra chave.
4. Preservar o arquivo original e ao menos uma cópia de segurança **criptografada e fora do GitHub**. Não armazenar chave privada no repositório.
5. A cada build do Cliente: verificar certificado e package name `br.com.apois.app`, versionCode monotônico, arquivos internos e upload de artefato; testar no dispositivo; instalar por cima quando mesmo cert, ou desinstalar QA antiga quando inevitável após aviso.
6. Ao concluir homologação: abrir decisão separada de assinatura PROD, Firebase/Maps/Auth/Play e backups, antes de qualquer lançamento.


### Chave QA Cliente gerada em 05/11/2026 — impressão digital pública
- Local no notebook do responsável: `%USERPROFILE%\\APOIS-CHAVES\\cliente-qa.keystore` (não adicionar ao Git).
- Alias: `androiddebugkey`; keystore exclusivo de testes, **não de produção**.
- SHA-256 do certificado informado pelo responsável após `keytool -list -v`: `3F:7E:52:2F:8A:AC:C6:63:84:37:14:22:50:77:08:7C:5F:FD:6C:1C:81:A8:18:66:38:3E:F8:A1:2F:DE:46:09`.
- Próxima ação: cadastrar o arquivo **em base64** no GitHub Actions Secret `APOIS_CLIENT_QA_DEBUG_KEYSTORE_BASE64` e o hash público no Secret `APOIS_CLIENT_QA_CERT_SHA256`. Não revelar nem commitar o conteúdo do keystore.
- Situação: **VALIDADA EM CI**. Os dois Secrets foram cadastrados pelo responsável; a execução GitHub Actions [#84](https://github.com/apoistecnologia-gif/apois-superapp/actions/runs/42082719912) restaurou a chave protegida, validou o SHA-256 pinado, compilou e publicou `APOIS-Cliente-TESTE.apk` como artefato `APOIS-Cliente-TESTE` (ID 13440833198). O job `build-client-apk` concluiu com SUCCESS. O workflow geral concluiu FAILURE porque o job paralelo de QA web falhou por erros TypeScript preexistentes; **não confundir com falha de assinatura ou de geração do APK**.
- A execução foi disparada uma única vez por gatilho controlado; o gatilho temporário foi REMOVIDO da branch Cliente. Para builds futuros, usar `workflow_dispatch` e preservar os dois Secrets. Não criar nem trocar novas chaves QA.
- APK gerado em 05/11/2026, SHA-256 do ARQUIVO (não certificado): `b6cb47310c63f11207ed4a212c767c48f44135db0ec17f8886536a91177318d3`.
- Pendência independente: corrigir erros do TypeScript no job `Corridas Passenger Web QA`; não mascarar ou remover validação.


## Política para próximos chats e engenheiros
Começar lendo esta ADR e o workflow real na branch Cliente. Não voltar a exigir recuperação do keystore antigo como bloqueio obrigatório; o responsável aprovou reinstalação dos APKs de **testes**. Não autorizar merge, migração, chave de produção, divulgação de Secrets ou publicação sem autorização específica. Se o APK QA não for gerado, informar precisamente qual Secret, assinatura ou teste bloqueia a build.

## Referências de continuidade
- Cliente: https://github.com/apoistecnologia-gif/apois-superapp/tree/fix/passageiro-ocorrencias-safearea-20261105
- Motorista: https://github.com/apoistecnologia-gif/apois-superapp/tree/fix/motorista-39-achados-20261105
- GitHub Actions Cliente: https://github.com/apoistecnologia-gif/apois-superapp/actions/workflows/apois-client-android.yml
- Esta decisão permanece no histórico e na branch até revisão ou merge explicitamente autorizados.
