# Auditoria APOIS — checkpoint verificável de 07/11/2026

## Build Android Cliente #112 — concluído

Workflow: https://github.com/apoistecnologia-gif/apois-superapp/actions/runs/42407724208
Commit compilado: 8517ade96303987f0a9cc3c617aff134b598b940, branch audit/ecossistema-20261107. Conclusão success; job 128508941699. A compilação dos módulos Corridas, Entregas e shell Cliente, geração Android, Gradle assembleDebug e upload do artefato foram executados de verdade.

Validação no CI: 53 testes Node de endereços passaram; 4 testes Bun UF passaram; versão monotônica e pacote conferidos pelo aapt; certificado do APK comparado à configuração QA existente; assets do APK extraídos e grafo de HTML/CSS/JS verificado. Não foi criado nem trocado certificado.

| Campo | Valor |
|---|---|
| Pacote | br.com.apois.app |
| versionCode | 112 |
| versionName | 1.0.11-qa.112 |
| Certificado SHA-256 (público) | 3f7e522f8aacc663843714225077087c5ffd6c1c81a81866383ef8a12fde4609 |
| Artefato GitHub | APOIS-Cliente-TESTE, ID 13588580927 |
| ZIP do artefato SHA-256 | 49fb7ea69e9d2ea352968b5d4577e9f74ed5c67ebe08a210ef6a24ff6a84c03a |
| APK interno SHA-256 | 6ec3f71a7a3626aa2dc33b1fc4ab4e3a39c6defd17ae5f344055a85639973bc8 |
| APK interno tamanho | 8.354.189 bytes |

O ZIP foi baixado e seu digest comparado ao GitHub. O arquivo APK interno foi materializado como APOIS-Cliente-QA112-8517ade9.apk. Confirmada presença de AndroidManifest.xml e entradas shell, Corridas e Entregas dentro do APK. Não confundir o hash do ZIP com o do APK. O artefato GitHub expira em 14/11/2026 às 16:48 (Brasília), segundo a API. Tentativa de guardar cópia permanente falhou por limite de armazenamento; não foram excluídos arquivos do usuário. Há cópia no workspace desta sessão.

O run #110 falhou antes de gerar APK: V11 esperava o CEP bruto, sem a validação/loading adicionados por um hardener anterior. Corrigida a integração preservando indicador, CTA e validação, com controle da requisição mais recente e liberação do indicador após CEP apagado/incompleto. A asserção textual Bun de normalização ViaCEP foi atualizada para o contrato com proteção contra edição manual. O recorte local foi reconstruído incluindo o hardener CEP anterior; 53 testes aprovados. O run #111 compilou módulos e avançou ao Android; #112 é a versão final verificada desta continuação e inclui o último caso de cancelamento CEP.

Isto comprova build e verificações de empacotamento, não aprovação funcional do ecossistema. OAuth, GPS físico, teclado Android, persistência real e testes cruzados permanecem pendentes. Seguir RETESTE-CLIENTE-ENDERECOS.md no aparelho; auditoria dos demais módulos ainda incompleta. Não houve merge ou promoção em produção; previews Vercel podem ser gerados automaticamente pelos commits.

## Correção V13 — completar dados ausentes sem apagar o GPS

Defeito adicional reproduzido: com GPS confirmado e campos vazios, a regra isCompletingMissingField considerava somente o valor da renderização anterior. Após o primeiro caractere, rua/bairro/cidade/CEP passavam a ser tratados como alteração de endereço identificado e perdiam as coordenadas no segundo caractere. A edição também perdia o ponto ao completar UF vazia.

A correção mantém em missingLocationFieldsRef quais campos vieram vazios da seleção atual ou do endereço carregado. Preenchê-los com múltiplos caracteres preserva o ponto. Selecionar outro endereço reinicia essa referência. Alterar rua/cidade que já vieram preenchidas continua invalidando o ponto; nenhuma coordenada é criada por digitação.

Nova suíte executa callback de seleção e handleChange reais em isolamento. Antes: 14 casos, 5 aprovados e 9 falhas. Depois: 14/14 aprovados. Regressão conjunta: **51 testes de lógica aprovados**, zero falhas. Esse total inclui os 37 casos anteriores e não inclui a suíte separada de documentos do Admin. Sintaxe do novo hardener verificada. Sem build integral, gravação real de endereço, teste Android físico ou homologação visual atual.

Arquivos: scripts/harden-entregas-address-missing-fields-v13.mjs; scripts/qa/test-entregas-address-missing-fields-v5.mjs; três harnesses anteriores ganharam a nova referência de estado com inicialização vazia. O manifest aplica V13 após V12 e executa a quinta suíte. Fontes dos submódulos, banco, autenticação, regras financeiras e componentes do estabelecimento não alterados.

## Acesso aos painéis atuais — continuação

A tentativa de abrir o preview de Corridas no navegador retornou a tela de login da Vercel, confirmando a proteção antes do login APOIS. O usuário selecionou Google pelo formulário seguro. Após a identificação segura, o Google exibiu “Something went wrong — Sorry, something went wrong there. Try again.” Não houve autenticação concluída, inspeção de senha, repetição da tentativa, troca automática de método ou mudança na proteção. A validação visual atual continua bloqueada. Nenhum parâmetro OAuth foi salvo neste documento.

A leitura de build events do deployment dpl_3JUKVk37MSuzy7rVMsew8Xp2fckT retornou 404 mesmo com o teamId explícito. Isso não contradiz o READY consultado nos metadados: logs indisponíveis pela ferramenta não são falha de build comprovada. CLI Vercel não está instalada no ambiente.

Trabalho independente executado: inspeção de scripts/build-admin-vercel-preview.sh e api/admin/driver-documents.js; execução da suíte existente scripts/test-admin-preview-private-documents-v1.mjs, aprovada. Ela usa fetch totalmente simulado e credenciais sintéticas e não acessa banco ou documentos reais. Exercita rejeições 405/503/401/400/403, ausência de assinatura antes da autorização, resposta com URLs temporárias e cabeçalhos privados sem cache, além de não expor os tokens sintéticos na resposta. Não equivale à validação do endpoint implantado nem à aprovação integral de segurança. Nenhuma alteração funcional nova nesta continuação.

## Retificação de versões publicadas — consulta direta aos aliases Vercel

O mapa atual está em VERCEL-ATUAIS.md. A tela examinada no alias apois-entregas-visual-preview.vercel.app era do commit **877b5adeb0496a37188d55a6aff8213d63cf5e5b**, não ccd30fc03. A associação anterior foi feita com o último deploy do projeto, mas o alias permanece em outro deploy. As referências abaixo a ccd30fc03 como versão da tela efetivamente aberta ficam invalidadas; o achado visual continua restrito à tela antiga. O fonte de login obtido do SHA ccd30fc03 não comprova a causa da tela antiga.

O último preview de Corridas encontrado corresponde ao SHA f7728ae5 da branch audit/ecossistema-20261107; Entregas e Estabelecimento têm previews mais recentes que seus aliases curtos, no SHA ccd30fc03. Tentativas de leitura dos três previews pela conexão Vercel retornaram 403; metadados foram acessíveis. Sem CLI autenticada disponível nesta sessão e sem alteração de proteção.

Correção de outra formulação anterior: os pushes dispararam previews automáticos na Vercel para Admin Corridas. Não houve deploy manual nem promoção em produção. Esses builds de Admin não equivalem ao build integral do Cliente ou à geração de APK.

## Atualização mais recente — seleção de endereço e evidência web

V12 corrige mistura de campos de dois endereços: ao selecionar um ponto parcial, rua/bairro/cidade/UF/CEP/número ausentes ficam vazios para conferência, em vez de herdar valores da seleção anterior. Coordenadas ausentes, não numéricas ou fora dos limites deixam ambos os valores nulos. Apelido, complemento e referência manuais continuam preservados e precisam ser conferidos pelo cliente ao trocar de local. Não foi alterado o componente compartilhado com estabelecimento.

Reprodução nos callbacks reais em isolamento: seis casos novos, quatro falhavam antes; seis aprovados depois. Resultado atual: **37 testes de lógica aprovados**, incluindo os casos anteriores. V12 está depois de V11 no manifest. A asserção textual da suíte Bun UF V9 foi atualizada para exigir UF normalizada sem fallback para estado antigo; Bun não está disponível localmente e essa suíte específica não foi executada nesta continuação. Os 37 casos rodaram pelo Node, com a lógica dos handlers, sem escrita real.

A conexão de navegador funcionou nesta continuação. https://apois-entregas-visual-preview.vercel.app renderizou login da Administração de Entregas, não Cliente. Deployment dpl_BYWSBwkQdNWc45DKNHSea3rdKXNF informa origem apoistecnologia-gif/apois-entregas, branch legal/novos-planos-assinatura-homolog-20261103, SHA ccd30fc03cc95119f702ceab27b85fd81e57c88d. Portanto, essa superfície não homologa as alterações desta PR nem o APK Cliente. Não classificamos o modo admin como erro de configuração sem confirmar a intenção desse projeto.

Evidência visual incidental (fase administrativa ainda não iniciada): no desktop, h1 “Controle completo das entregas.” aparece quase invisível; cor computada rgb(24,33,48) sobre painel escuro. O fonte do SHA publicado usa text-white; há conflito efetivo de CSS, mas o seletor vencedor ainda não foi localizado. Não alterado nesta continuação. Em 360×800, não se observou transbordamento horizontal: largura de documento 345, viewport 360. Mostrar senha alternou password → text e foi restaurado. Recuperação sem e-mail exibiu aviso solicitando e-mail; nenhum e-mail ou login foi enviado. Controles medidos: mostrar senha 36×36; recuperação 132×20; entrar 305×48. Não declarar homologação completa da tela por esses recortes.

Lovable Entregas consultado: latest_commit_sha 0a1e0b294f75c97bce903200b57e7a6b482f381a, anterior ao snapshot fixado no superapp e à PR. Não usar essa publicação como substituição silenciosa do Cliente atual.

O bloqueio visual específico anterior por timeout foi superado para a superfície admin publicada. O Cliente da versão auditada continua sem teste de interface, persistência e aparelho. Nenhum build integral, APK novo, merge ou deploy executado.

## Atualização desta continuação

Correção adicional V11 aplicada ao builder: respostas antigas de autocomplete e ViaCEP são descartadas; a rua editada manualmente durante a consulta é preservada. Uma nova seleção de ponto invalida consulta CEP pendente. Antes da alteração, os seis testes de concorrência falhavam; depois, os seis passaram.

A suíte de edição foi ampliada com execução do handleSubmit real em isolamento: os 27 nomes de estados geram payload com UF canônica, CEP numérico e GPS preservado. UF XX e latitude ausente bloqueiam o update. Nenhuma escrita real foi feita: o destino do update foi um objeto de teste.

Resultado atual: **31 testes de lógica aprovados** (18 de lista/edição/envio, 7 de criação e 6 de concorrência). Build integral, renderização, persistência e Android físico permanecem NÃO EXECUTADOS. Os números 22 e 15 nas seções históricas abaixo descrevem o checkpoint anterior.

EM-005 agora tem concorrência ViaCEP reproduzida e corrigida no builder; a combinação de campos antigos com resposta parcial do geocodificador continua pendente. EM-006 tem três cenários reproduzidos e corrigidos. O número de chamadas por tecla não foi alterado e não há alegação de redução de quota.

Leitura adicional do snapshot: sacola, favoritos, CartContext e fingerprint do checkout. Há saneamento de estabelecimento único, proteção de hidratação antes de persistir e callback estável para limpar sacola; não alterados. Os testes de tela, recuperação de favoritos e fluxo de compra não foram executados. O snapshot bruto ainda força Pix na sacola, mas os patches do builder alteram política de pagamento; isso não é classificado como defeito no APK sem examinar o resultado integral do build.

Novos arquivos: scripts/harden-entregas-address-async-v11.mjs e scripts/qa/test-entregas-address-async-v3.mjs. O manifest executa V11 após V10 e inclui a terceira suíte. Não houve deploy, merge, troca de assinatura, escrita no banco ou movimento financeiro.

## 1. Resultado executivo e alcance

Auditoria integral **não concluída**. Arquitetura de integração identificada e investigação funcional de endereços do Cliente Entregas iniciada. Nenhum aplicativo está integralmente homologado por esta sessão. Os 22 testes aprovados são testes de lógica isolada extraída de handlers reais; não são E2E, testes Android, nem prova de persistência em produção.

Foram obtidos 78 arquivos do snapshot Entregas pelo GitHub autenticado. O inventário cobre caminhos de rotas das três árvores fixadas. A matriz contém 103 entradas iniciais; não representa todos os botões, submenus ou abas do ecossistema. Percentual global de cobertura funcional: ainda não calculável, pois o denominador de funções não está completo. Telas integralmente homologadas nesta sessão: zero.

## 2. Arquitetura e versões confirmadas

| Superfície | Fonte real | Versão fixada |
|---|---|---|
| Integração, shell Cliente, shell Parceiro, patches de build, funções backend | apoistecnologia-gif/apois-superapp | audit/ecossistema-20261107; base 18f2fed7e27486f2b3a4170921a246344316a2a4 |
| Cliente Corridas | apoistecnologia-gif/say-hello-buddy-23-84b5dcbf | 7b047f75a1a919a5336c0df6e0d60b14b02f2618 |
| Motorista e Admin Corridas; outras rotas legadas a classificar | apoistecnologia-gif/movvi-go-connect | 9fc171050d8b5703540c49d19a8f1e9f5162775f |
| Cliente, Entregador, Estabelecimento e Admin Entregas | apoistecnologia-gif/apois-entregas | 2f4606e0fb52dffb49f2e6aebbe921ce687ab625 |
| Supabase Corridas | tbbzkrfupmqdywnzgnms | ACTIVE_HEALTHY na consulta |
| Supabase Entregas | ptgkwyyolrdgnqketkjj | ACTIVE_HEALTHY na consulta |

A branch main da integração está defasada em relação às branches recentes: aponta outros proprietários/commits no source-lock e não representa o código atual de homologação. Não usar main como referência silenciosa. `.apois/modules.json` copia e transforma os snapshots em `.work`; é indispensável analisar o resultado dessas transformações, além do fonte original. Nenhum submódulo foi alterado.

Projetos Vercel identificados: apois-site-institucional; apois-corridas-admin-homologacao; apois-corridas-recovery-preview; apois-estabelecimento-visual-preview; apois-entregas-visual-preview; apois-corridas-admin; apois-entregas-estabelecimento; apois-admin. A listagem também retornou oi-talky-time, sem vínculo APOIS comprovado; não auditar por suposição.

Projetos Lovable pertinentes encontrados: Apois Brasil Institucional (d0219036-d6fb-4d41-af57-cd3fa4e92263); APPS Apois (e80e6b6c-bf0d-427b-aa58-96d00d1504fd); APOIS ENTREGAS (e7f82c34-0f40-4f22-ac49-5af1f336cd21); APOIS SITE (11636999-bfd9-4685-82ea-cc053c739682); MOVVI Drive Brasil (0900bef2-57d2-47b9-93b1-0ea5defee501). Nomes e existência confirmados; equivalência entre publicação atual e APK ainda não comprovada.

## 3. Mecanismos a preservar

RLS de customer_addresses habilitada. SELECT/DELETE/UPDATE verificam auth.uid() = user_id; INSERT e UPDATE possuem WITH CHECK de ownership. Há índice único parcial para um endereço padrão por usuário. A RPC set_default_customer_address verifica autenticação, propriedade, usa lock transacional por usuário e atualiza o padrão atomicamente. Esta sessão apenas leu catálogos; não executou escritas nem testes com usuários reais.

Manter autenticação, assinatura Android original, separação dos Supabases, confirmação de ponto após alteração de rua/cidade, normalização das 27 UFs e a política de snapshots preservados. Não interpretar a leitura das políticas como teste adversarial de autorização concluído.

## 4. Defeitos e riscos

| ID | Prioridade / classificação | Evidência e causa | Impacto | Estado |
|---|---|---|---|---|
| EM-001 | P1 / CORRIGIR | enderecos.tsx, hasCoordinates: Number(null) e Number('') retornam 0 e passam nos limites | Endereço sem coordenadas aparece como mapa confirmado e passa pelo handler de confirmação | Reproduzido em execução isolada; correção ligada ao builder; reteste visual/E2E pendente |
| EM-002 | P1 / CORRIGIR | editar/$addressId.tsx, handleChange após address-ux: segundo dígito do número invalida latitude/longitude; mesma rua também invalida | Cliente perde ponto confirmado e precisa repetir localização | Reproduzido; corrigido no builder; aparelho e persistência pendentes |
| EM-003 | P1 / CORRIGIR | UF V9 só normalizava criação e seletor Cliente, deixando edição com validação por comprimento e sem canonicalização do retorno do mapa | Inconsistência criação/edição e aceitação de UF inexistente com 2 caracteres | Correção de edição implementada; cobertura dedicada de todos os caminhos da edição ainda pendente |
| EM-004 | P1 / CORRIGIR | Correção 7ea12970 de número na criação é posterior ao SHA usado no APK #109 | APK #109 não contém preservação de GPS ao digitar número | Divergência de versão comprovada; novo APK não gerado nesta sessão |
| EM-005 | P2 / investigar | ViaCEP assíncrono sem controle da resposta mais recente; callbacks do seletor combinam campos novos com anteriores quando resposta parcial | Risco de campos e ponto de locais diferentes | Risco fundamentado por código, não reproduzido; sem alteração |
| EM-006 | P2 / investigar | Autocomplete dispara por tecla sem descarte de respostas antigas no seletor Cliente | Risco de sugestão antiga substituir resultados atuais e consumo excessivo de quota | Risco por código; execução pela UI não realizada |

EM-001 e EM-002: antes, 6 falhas em 15 casos novos; depois, 15/15 passam. Correção localizada somente nas rotas Cliente. O componente de mapa compartilhado com estabelecimento não foi alterado.

## 5. Correções e regressão

Arquivos novos: scripts/harden-entregas-address-audit-v10.mjs e scripts/qa/test-entregas-address-audit-runtime-v2.mjs. `.apois/modules.json` executa V10 depois de UF V9 e roda o novo teste junto do teste existente de número. Os fontes originais dos submódulos permanecem intactos.

| Verificação | Resultado |
|---|---|
| Nova suíte antes da correção | 15 casos, 9 aprovados, 6 falhas — reprodução |
| Nova suíte depois da correção | 15/15 aprovados |
| Suíte existente de criação/número/GPS | 7/7 aprovados |
| Sintaxe do novo hardener | node --check aprovado |
| Integridade de diff | git diff --check aprovado |
| Build integral, typecheck e APK desta alteração | NÃO EXECUTADO |
| Google OAuth, GPS físico, ViaCEP real, salvar e reler após reabrir | NÃO EXECUTADO |

Comando executado: `node --test scripts/qa/test-entregas-address-number-runtime-v1.mjs scripts/qa/test-entregas-address-audit-runtime-v2.mjs`.

Foram reconstruídas somente as transformações relevantes de endereços em uma cópia local parcial para investigar os handlers. Isso não é uma reconstrução integral do pipeline Android. A suíte usa stripTypeScriptTypes; conferir versão Node no runner antes de disparar build (a suíte anterior já usa essa API).

Reversão: reverter o commit que adiciona V10 e sua ligação ao builder. Nenhum rollback de banco é necessário.

## 6. Android e homologação visual

APK Cliente #109: run 42395581680, SHA b0bc305c217509b37f16f6e42b5beb9028ec7af7, conclusão success. Artefato APOIS-Cliente-TESTE, ID 13583316856, 7.748.672 bytes, não expirado na consulta. Digest do ZIP de artefato informado pelo GitHub: 17f337943057e1ef14e2f9683e63a89540caf9fdaf0bcf30792fbb1ac31b559e. Este digest não é apresentado como hash do APK interno.

Não baixado/descompactado nesta sessão; certificado e manifest internos não revalidados. Workflow na branch examinada declara versionCode 12 e versionName 1.0.11; não afirmar que esses valores foram lidos do APK.

Foi tentada abertura de https://apois-entregas-visual-preview.vercel.app no Chrome conectado. A operação expirou sem retornar DOM. Não há evidência visual de tela renderizada nesta sessão. Não considerar aprovação visual, responsividade, teclado, rolagem, Voltar ou safe area.

## 7. Pendências e condições de lançamento

Fase 1 parcialmente concluída: repositórios, snapshots, shells e serviços identificados; inventário de rotas salvo em INVENTARIO.md; abas internas e composição final por produto pendentes. Fase 2 iniciada pelo endereço. Fases 3–10 não concluídas; correções pontuais autorizadas foram preparadas sem alterar produção.

Clonagem Git local dos submódulos privados não autenticou; leitura pelo conector GitHub funcionou e permitiu obter o recorte. Para build integral, usar checkout autenticado de CI existente ou obter as fontes completas por mecanismo autenticado. Não pedir novos certificados ou usar versões antigas de ZIP como substituição.

MATRIZ.csv registra funções extraídas de rotas disponíveis e casos investigados. NÃO EXECUTADO significa ausência de verificação funcional, mesmo que exista evidência de código. Não estimar percentual total pelo número de testes unitários. Nenhum deploy, merge, migração, cobrança, pagamento ou mudança de saldo executado.

## 8. Continuidade executável

Continuar de audit/ecossistema-20261107, preservando os commits anteriores. Revisar diff de V10 e integração, completar teste da UF na edição, reproduzir os casos EM-001/002 pela interface real em ambiente sintético e confirmar persistência após reabertura. Se a UI estiver indisponível, registrar exatamente o bloqueio e avançar na análise do restante do Cliente Entregas, sem aprovar telas por inspeção.

Depois investigar ViaCEP/seleção parcial e autocomplete com controle de respostas concorrentes; só corrigir após reprodução. Completar inventário de botões, abas e fluxos de cada produto, incluindo os componentes de admin/courier/merchant, antes de calcular cobertura. Seguir a ordem do prompt do usuário. Para Android, usar workflow existente do GitHub Actions, assinatura original e comparar SHA do build ao commit auditado. Não publicar produção nem fazer merge automático. Não movimentar dinheiro. Manter relatórios incrementais com testes reais separados de riscos e hipóteses.
