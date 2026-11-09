# APOIS — Relatório consolidado das verificações reais pendentes dos Relatórios Técnicos 01–14

**Data-base:** 09/11/2026. **Tipo:** consolidação de pendências; **não é nova auditoria, nova correção nem homologação**.  
**Fonte principal:** matriz histórica \`auditoria/CODEX-MATRIZ-GERAL-51-ACHADOS-20261109.md\` atualizada até o Relatório 14, relatório mestre \`auditoria/01-AUDITORIA-APOIS-RELATORIO-MESTRE.md\`, Relatório 02 e os arquivos \`auditoria/CODEX-RELATORIO03...14-EXECUCAO-20261109.md\` na branch \`audit/continuacao-20261107\`.  
**Baseline:** **67 achados**, classificação **A 0 / B 46 / C 17 / D 0 / E 1 / G 3**. Nenhum dos 67 foi promovido a homologado por esta consolidação.  
**Repositório:** \`apoistecnologia-gif/apois-superapp\`; **única branch de integração autorizada** \`audit/continuacao-20261107\`. \`.apois/source-lock.json\` continua referenciando: Entregas \`2f4606e0fb52dffb49f2e6aebbe921ce687ab625\`, Passageiro \`7b047f75a1a919a5336c0df6e0d60b14b02f2618\` e Motorista/Admin \`9fc171050d8b5703540c49d19a8f1e9f5162775f\`.

## 1. O que significa "verificação física" neste relatório

Três tipos de aceite foram mantidos distintos:

- **F — aparelho/interface real:** APK/test build autorizado em Android físico, WebView/Capacitor, teclado, câmera, GPS, menu Compartilhar, push em foreground/background, aparência, clique, navegação, acessibilidade, conectividade, recebimento e renderização de PDFs; alternativamente navegador real quando o módulo é web/admin. O código preparado ainda precisa de build/typecheck e versão identificável.
- **I — integração real controlada:** sessões e dados **sintéticos** em ambiente de homologação, RPC/Edge/Storage/RLS/Realtime ativos, usuário A/B, validação real de identidade e isolamento, uploads/downloads permitidos, sincronização e condição de erro. **Não** equivale a tocar contas e pedidos de produção.
- **B — bloqueio prévio:** SQL \`QA_NOT_APPLIED\`, Edge ausente, chave/credencial de teste, permissão operacional, versão publicada sem SHA, segurança ou custo de API. Esses itens precisam ser resolvidos/aprovados **antes** de exigir um E2E. Não classificar teste "não executado" como falha funcional comprovada.

**Situação atual:** os relatórios mais recentes registraram simulação V8, inspeção de fonte/catálogo e algumas migrações específicas já implantadas em fases anteriores, **não testes físicos completos das correções acumuladas**. O relatório mestre de 08/11 menciona builds e Playwright públicos de um commit histórico, mas isso não valida automaticamente os geradores e overlays adicionados entre 08 e 09/11. A rota do Motorista /motorista/cadastro vazia (D-004) e /motorista/corridas que some (D-005) continuam exigindo reprodução e correção verificadas no produto preparado; não criar IDs INV extras por isso.

## 2. Checklist de pré-requisitos gerais (antes da homologação física)

| Gate | Preparação exigida | Estado até a data-base |
|---|---|---|
| Base reproduzível | Reconstituir **exatamente** sources pinados, rodar geradores na ordem, Node tests, Bun frozen, TypeScript, lint, Vite/web/partner, checar diferenças pós-visual e isolar vars de ambiente | **Pendente para overlays recentes**, embora tenham ocorrido builds em fases anteriores |
| Artefato rastreável | Identificar repo, branch, commit, SHA de cada APK/web build, packageId, flavor, assinatura de teste e mapa de módulos; nada de download genérico sem rastreabilidade | **Pendente** |
| Contas de homologação | Passageiro, Motorista A/B, Cliente Entregas A/B, Entregador, Estabelecimento, Admin suporte/financeiro; nenhum dado de cliente real | **Não comprovadas como ambiente E2E completo** |
| Backend | Projetos de teste ou staging dos dois Supabase, migrations revisadas, policies, Edge/Realtime/Storage e fixtures permitidas; sem escrita indevida no banco produtivo | **Parcial/bloqueado**, vide relatórios |
| Mapa/quota | Chaves Google Maps separadas, restrição de pacote/domínio, monitoramento de quota/custos, dados urbanos e rurais; nunca testar carga paga sem autorização | **Não homologado** |
| Dispositivo | Android real, permissões GPS precisa/aproximada/negada, câmera/arquivos, clipboard/share, notificações, foreground/background, offline, reconexão, orientação, teclado e safe-area | **Pendente** |
| Responsividade/acessibilidade | Pelo menos 320, 360, 390 e 430 px equivalentes; tamanho de fonte ampliado, zoom, contraste, botões ≥44 px quando aplicável, telas claras/escuras e alvos não obstruídos | **Pendente nos fluxos autenticados** |
| Financeiro | Sandbox do provedor efetivamente aprovado/configurado; preservar Safe2Pay e regras/valores oficiais. **Não movimentar Pix nem pagar assinatura/corrida reais** | **Pendente** |
| Segurança | Login real de papéis sintéticos, RLS/ACL efetivas, isolamento por identidade, tokens e links assinados, casos adversariais sem exfiltração | **Pendente** |
| Evidência | Para cada cenário: PASS/FAIL/BLOQUEADO, modelo e Android, versão/build/commit, projeto test, passos, print/vídeo com dados ocultos, estado esperado/obtido, log sanitizado e possível regressão | **Iniciar na homologação autorizada** |

**Não iniciar builds/APKs/publicação por este documento.** A regra acordada permanece: **"ACABOU OS RELATÓRIOS. AGORA VAMOS PARA A HOMOLOGAÇÃO FINAL."** Até lá, a sequência de relatórios de **comunicação visual** pode ser auditada separadamente.

## 3. Pendências organizadas por cada um dos 14 relatórios técnicos

### RELATÓRIO TÉCNICO 01 — INV-001 a INV-020 (20 achados)
**Áreas:** atendimento, contratos privados, build, financeiros, histórico, avatar/imagens, GPS, autenticação, versão publicada.  
**F — verificar nas interfaces/Android:**
- [ ] Cliente Entregas: abrir/listar/responder chamado, abrir detalhes diretos por protocolo, **mais de 51 protocolos** sem sumiço/truncamento e atualização das mensagens; anexar/abrir arquivo, visualizar erro/retry de URL assinada e garantir que nota interna não seja exibida.
- [ ] Corridas: alternar rapidamente entre protocolos A/B, isolar mensagens, rascunho e arquivos, lidar com retorno de requisição antiga, upload parcial e retorno perdido; botão de ocorrência e link do histórico legíveis e navegáveis no Android (INV-002–007/016).
- [ ] Cliente Entregas: histórico paginado **51+**, sem duplicações; avatar alterado em duas telas e após logout/login, URL nova sem avatar antigo; upload e permanência de logo/capa de loja, fotos de produto e documentos privados com seletor/câmera.
- [ ] Motorista: histórico **mais de 50 corridas** e botão de carregar mais, retorno ao histórico e filtro, sem dados de outro motorista; reproduzir especialmente **D-004 tela de cadastro vazia e D-005 histórico que desaparece** em sessão autenticada. D-004/D-005 são defeitos históricos, não novos números INV.
- [ ] Troca de módulos do Superapp, login Google, páginas públicas/privadas, inicialização de sessão, telas que ficam brancas, foco e acessibilidade do Android; endereço GPS/geocodificação inversa urbano/rural e falha sem chave/quota.
**I — validar em staging:** IDOR (dono A vs B) dos chamados e anexos, assinatura/expiração de arquivo; RLS buckets merchant-assets, merchant-documents, courier-documents, support-attachments, avatar e product-images; recusa para conta sem gerência. E2E financeiro controlado de ACL INV-009 e mensagem INV-020; validação de saques/service-only e RPCs restantes INV-018.
**B — antes do aceite:** build Bun frozen/Capacitor INV-012, credencial fora dos logs/argv INV-008, teste autenticado dos gates INV-011, Safe2Pay/fluxos monetários INV-010, proteção de senha vazada INV-017, mapear deployment real/SHA Vercel INV-019. INV-005 exige reconciliação de órfãos antigos sem exclusão cega. Migrações de Storage específicas já aplicadas não devem ser reaplicadas sem diagnóstico.

### RELATÓRIO TÉCNICO 02 — INV-021 a INV-034 (14 achados)
**F:**
- [ ] Corridas: entrar com AUTH ID diferente do identificador de domínio e conferir carteira/taxas sem tela vazia ou dados cruzados (INV-021).
- [ ] Entregas: busca em catálogo com **mais de 40 produtos e múltiplas lojas**; nenhuma loja some por limite de cards; coordenada ausente não mostra distância fictícia, ponto 0,0 numérico explícito permanece válido (INV-022/023).
- [ ] Entregas/Estabelecimento: aberto 24h, horário partido, virada de meia-noite, fuso da cidade, fechado temporariamente, cidade inativa e atualização entre Home, busca e loja; refletir horário no Android sem UI contraditória (INV-024).
- [ ] Admin Corridas: deixar filtro relativo 7/30 dias aberto, aguardar virada de data e tocar Atualizar; observar período consultado e preservar período personalizado (INV-025).
- [ ] Admin Entregas: trocar cidade A→B durante edição de cobertura e resposta atrasada; draft não deve migrar; testar coordenadas vazias/fora da faixa e vírgula decimal; só cidade autorizada pode ser salva (INV-026/027).
- [ ] Login publicado: identificar URL/commit **antes** de medir contraste e comparar com código (INV-028); medir alvos de toque e labels de login nas variantes Cliente/Entregador, teclado, autofill e leitor de tela (INV-029/030).
- [ ] Cupons: falha de leitura não aparece como "0", não permite excluir com informação incompleta, exibe retentativa; sacola reaberta após preço/opção removida ou alteração de estoque, falha de rede e total revisado no checkout (INV-032/033).
**I/B:** promoções INV-031 ainda exigem migração **não aplicada**, testes de limite/cancelamento, preço produto/categoria e aceitação de preço novo pelo cliente; teste de trigger QA INV-034 em staging sem pagamentos reais; dados e autorizações da RPC de cobertura. INV-033 ainda parcial. Deployment/login INV-028 não tem fonte publicada univocamente rastreada.

### RELATÓRIO TÉCNICO 03 — INV-035 a INV-043 (9 achados)
**F — Motorista/Android e navegador:**
- [ ] Notificação quando app aberto, background, fechado e reiniciado; tocar notificação abre a rota correta, sem troca de usuário/ride.
- [ ] Permissões Android permitida/negada, desligada por Configurações e religada, registro e atualização do token após novo login ou reinstalação, mudanças de preferências/categorias (INV-035/037/041).
- [ ] Som/vibração: falha em storage local após persistência de categoria no servidor mostra **salvamento parcial**, não "salvo completamente"; mudar conta não recupera cache da anterior (INV-038).
- [ ] Web Notifications: concedida, negada, construtor com falha, navegador não compatível; nunca indicar enviada se não foi exibida pela API (INV-040).
**I/B — servidor/Admin:** validar separação DOMAIN/AUTH e FKs, token FCM \`UNREGISTERED\` vs 400/403/transiente, logs de aceite/falha/supressão por destinatário, enum/FK e atualização real de token (INV-035/036/039); endpoint administrativo Vercel autenticado e RBAC sem segredo no frontend (INV-042). Broadcast INV-043 testar **0, 1, 100 e 101 destinatários sintéticos** sem envio real em massa; 101+ deve rejeitar sem corte silencioso, e reenvios não devem duplicar. Exige Firebase/FCM de homologação e infraestrutura Admin apropriada.

### RELATÓRIO TÉCNICO 04 — INV-044 a INV-048 (5 achados; VIS-001 é alias de INV-047)
**F — Motorista/Admin:**
- [ ] Selecionar foto real JPEG/PNG/WebP com MIME do sistema correto/vazio e PDF documental; PDF como foto ou arquivo disfarçado deve falhar de forma específica, preservando o arquivo escolhido até processamento concluído (INV-048).
- [ ] Abrir **Central de Pendências** em tela compacta/completa, fazer erro de rede, tocar **Tentar novamente**, manter lista anterior e não mostrar vazio falso; verificar teclado, rolagem, botões e identidade visual (INV-047).
- [ ] Trocar foto frontal do veículo, CNH, selfie, CRLV e ano; reenviar todos os itens exigidos, tentar sem alterar item, revisar situação \`pending_review\` e resposta do Admin; testar troca de aparelho, app offline e retorno de upload perdido (INV-045/046).
**I/B:** reconciliação de Storage do documento e objetos órfãos, conta diferente, documento vinculado, fila service-only/ownership (INV-044). **Edge e SQL de INV-044–046 QA_NOT_APPLIED**: testar somente depois de revisão/migração de staging, sem apagar arquivos reais, não ativar a migração STAGE2 das 13 fotos por engano.

### RELATÓRIO TÉCNICO 05 — INV-049 a INV-051 (3 achados)
**F — Motorista Android:**
- [ ] Permissão GPS **precisa, aproximada e negada**, GPS desligado, timeout, mudança em Configurações, retorno ao app; mensagem deve diferenciar precisão e não inventar localização (INV-049).
- [ ] SOS com GPS indisponível/aproximado, sem afirmar disparo automático de alerta a contatos; testar UI de segurança com dados sintéticos.
- [ ] Contato de emergência: números 8–15 dígitos, \`+\` internacional, longo, inválido, vazio, edição de valor legado; não truncar nem acionar \`tel:\` inválido (INV-050).
- [ ] Compartilhar localização no menu nativo: sucesso, Cancelar/\`AbortError\`, share indisponível, clipboard negada; somente botão **Copiar link** copia após falha, cancelar não copia e link continua selecionável (INV-051).
**I/B:** RPC \`driver_add_emergency_contact\` com números sintéticos em staging; **SQL INV-050 QA_NOT_APPLIED**. Não testar ligação real nem notificação a contatos não participantes.

### RELATÓRIO TÉCNICO 06 — INV-052 a INV-053 (2 achados)
**F — Motorista:**
- [ ] Abrir recibo PDF em Android e compartilhar/visualizar; verificar valores finais **ausente vs zero**, estimativa identificada, distância/duração ausentes sem zero fictício, descrição longa, quebras de página e correspondência cartão/detalhe/PDF (INV-052).
- [ ] Histórico de 0/1/50/51/500+ corridas sintéticas, paginação, carregar mais, filtros Hoje/7/30/customizado, intervalo cruzando meia-noite/fuso Recife e atualização; totais do **período inteiro** mesmo sem carregar todas as páginas (INV-053).
- [ ] Diferença entre valor bruto e saldo de carteira; quando o total exceder o teto de 10.000 linhas, aviso **Resumo parcial**; busca textual só na lista carregada (não fingir busca global).
**I:** RLS e \`driver_id\` da sessão, concorrência entre lotes, corridas adicionadas/atualizadas enquanto o resumo carrega, custo de PostgREST e estabilidade de cursor.

### RELATÓRIO TÉCNICO 07 — INV-054 a INV-056 (3 achados)
**B — NÃO COMEÇAR E2E FÍSICO de redispatch como se o backend estivesse pronto.** As Edge \`driver-cancel-redispatch\`, \`driver-reject-redispatch\`, \`dispatch-ride\` estavam **ausentes em produção** na auditoria; \`driver-finish-redispatch\` em produção ainda seguia fluxo v12 sem continuação revisada. Motivo de ausência do passageiro exige SQL INV-056 \`QA_NOT_APPLIED\`.
**I após autorização/implantação em staging:** recusa, cancelamento pelo motorista, substituição A→B, finalização com fila aguardando, fila liberada, concorrência de ofertas, perda de resposta depois de commit, reconsulta, recuperação limitada e cron/dispatcher; testar direitos da sessão, nenhuma oferta dupla e snapshots de push/estado. Para \`passenger_no_show\`, testar antes de chegada, antes e depois dos **2 minutos** definidos pelo backend (ou tempo configurado), motivos acentuados/legados e outros motivos, sem alterar parâmetros comerciais.
**F somente quando I aprovado:** Motorista vê erro honesto se endpoint ausente; depois vê cancelar/recusar/concluir, fila/status e avaliação; Passageiro vê retorno à busca e novo motorista. **Não solicitar corrida real em produção**.

### RELATÓRIO TÉCNICO 08 — INV-057 (1 achado)
**F — Passageiro:** cenário com corrida sintética A a caminho/chegou → retorno legítimo a \`procurar_motorista\` → B aceitou/a caminho/chegou; interface abandona A e apresenta B/ETA, sem fantasma, repetição ou tela travada. Testar também B direto sem evento intermediário, app em background/foreground, Realtime atrasado ou fora de ordem, refresh, perda/reconexão de internet, troca de corrida/conta, viagem iniciada e estado terminal. Capturar 320/360/390 px e teclas de navegação Android.
**B:** depende do Redispatch real do **Relatório 07**, ausente; simulação do hook não comprova E2E.

### RELATÓRIO TÉCNICO 09 — INV-058 a INV-060 (3 achados)
**F — Passageiro:** com endereços/categorias/paradas de teste, calcular preço da rota A, falhar e tentar novamente **a mesma rota** (INV-058); mudar para rota B durante resposta lenta de A e impedir preço antigo sobrepor B (INV-059). Alterar origem, destino, paradas, distância, categoria e posição GPS (jitter pequeno vs mudança material) e verificar se a tela desabilita **Confirmar** até ter preço/rota atuais e compatíveis (INV-060).
**I/B:** rede lenta, requisições concorrentes, timeout, taxas e valores de checkout do servidor de homologação, confirmação de corrida sintética somente após preço autoritativo; GPS **tolerância 85 m** validada no aparelho. Não efetuar Pix nem corrida real em produção. Revisar impacto conjunto dos Relatórios 07/08 e do mapa do Relatório 12.

### RELATÓRIO TÉCNICO 10 — INV-061 e INV-062 (2 achados)
**F — Motorista e Passageiro (conta compartilhada):** no modal de exclusão, mostrar com clareza que a conta APOIS Corridas afeta **ambos** os perfis; testar layout, leitura e botão cancelar em Android pequeno; não excluir conta pessoal real (INV-062).
**I/B:** usar **contas descartáveis de homologação** com corrida \`procurar_motorista\`, \`motorista_a_caminho\`, viagem, sem corrida, concorrência criação/aceite vs exclusão, autenticação expirada e retentativa. \`request_own_account_deletion\` deve bloquear estados ativos, registrar solicitação correta e não permitir reutilizar conta excluída indevidamente. **Migração INV-061 QA_NOT_APPLIED** — não afirmar proteção ativa; verificar locks e backend em staging antes de qualquer teste destrutivo.

### RELATÓRIO TÉCNICO 11 — INV-063 (1 achado)
**F — Motorista:** redefinição de senha via **OTP** em conta e caixa postal de teste; enquanto envia/verifica, campo de e-mail não muda; não anunciar código enviado ao endereço B quando o pedido era A. Alterar e-mail após término, cooldown de 60s, envio falho, rate limit 429, rede instável, respostas fora de ordem, OTP inválido/expirado, recuperar sessão, definir senha e novo login, teclado Android, voltar/retomar e deep link. Confirmar que mensagens não revelam existência de conta.
**I/B:** template real de e-mail com código, expiração, parâmetros do Auth, redirect/relay e entrega em homologação autorizada. Nenhum e-mail real foi enviado durante a auditoria.

### RELATÓRIO TÉCNICO 12 — INV-064 e INV-065 (2 achados)
**F — Passageiro Android e web:** abrir "Escolher no mapa", verificar **mapa realmente arrastável** sob pin fixo, câmera nativa Capacitor e JS; mover A→B, aguardar câmera parar, confirmar B como destino; confirmar B como **parada**; reutilizar no modo salvar Casa/Trabalho/Outro favorito; voltar sem selecionar; botão indisponível sem posição estável (INV-065).
- [ ] Validar GPS indisponível, centro falso, atualização de câmera, loading/erro de geocodificação, erro de rede, endereço não identificável, duplo toque, troca de destino durante reverse em andamento e mapa em 320/360/390 px, teclado/safe-area.
- [ ] Places responde \`lat/lng\` realmente numéricos; dados nulos, vazios, strings ou fora de faixa são rejeitados; **0,0 numérico válido** não se confunde com falta de posição (INV-064).
**I/B:** verificar Edge real de detalhes e reverse geocoding, autenticação e quotas/cobrança de Maps antes de chamadas de teste. Não assumir que os adaptadores de evento da câmera compilam só por simulação.

### RELATÓRIO TÉCNICO 13 — INV-066 (1 achado)
**F — Passageiro (WebView/Android):** após seleção válida, simular **falha de gravação de histórico** (quota, storage negado) em teste controlado e comprovar que destino/parada continua, com aviso verdadeiro sobre o histórico e sem falsa falha Places. Reabrir a lista quando storage volta, histórico não duplica, limite de **20 recentes** e dedup permanecem, sessão A/B não cruza favoritos. Histórico corrupto e leitura negada devem ser recuperáveis.
- [ ] Favoritos Casa/Trabalho/Outro: salvar com sucesso, substituir Casa/Trabalho de forma correta, sair/entrar, conferir persistência. Se storage não grava, **não mostrar "salvo"** nem fechar indevidamente o mapa; manter opção de tentar novamente.
**I/B:** confirmar continuidade dos fluxos de sugestão, histórico e mapa com RLS/autenticação ativa e endereço validado; a validação V8 não substitui armazenamento/WebView real.

### RELATÓRIO TÉCNICO 14 — INV-067 (1 achado, segurança P1)
**B — MIGRAÇÃO DE AUTORIZAÇÃO AINDA NÃO APLICADA.** A política viva do Supabase Corridas ainda concedia acesso ao motorista pelo \`rides.driver_id\` **atual** ao final da fase 14. Não testar com relatos ou anexos reais nem presumir que o defeito foi corrigido.
**I — somente após migração revisada em staging e contas A/B sintéticas:**
- [ ] A recebeu pedido de esclarecimento; reassociar a corrida a B. A mantém o acesso previsto ao ticket, eventos visíveis, metadados, arquivos e resposta; B permanece negado até **inclusão explícita e auditada**.
- [ ] Passageiro dono e staff autorizado continuam acessando o caso; terceiro e motorista não convidado recebem negativa; \`internal_note\` somente para staff; testes de \`apois_case_reply\`, \`apois_case_register_evidence\`, Storage upload, SELECT e signed URLs.
- [ ] Conceder B com justificativa, revogar A com justificativa, verificar trilha append-only, reconsultar cada camada; URL assinada previamente emitida pode continuar até sua expiração, que precisa ser medida. Caso legado com destinatário desconhecido fica fechado para motorista até triagem manual.
- [ ] Testar permissão de staff, concorrência entre convite e redispatch, caso fechado, usuário excluído, regrant, dupla concessão, erro de rede, privilege escalation e rollback fail-closed.
**Dependência crítica:** migração \`20261109_report14_case_driver_participants_QA_NOT_APPLIED.sql\`, revisão de \`SECURITY DEFINER\`/permissão \`support.read\` e plano para legados. Há procedimento emergencial \`QA_NOT_APPLIED\`, mas **nenhum desses SQL foi executado**. A UI sozinha não demonstra segurança.

## 4. Priorização da futura homologação (não é autorização para executá-la)

| Ordem | Bloco de aceite | Motivo |
|---|---|---|
| 0 | Reproduzir builds, pins e gates; fixar SHA de artefatos e ambiente | Sem versão identificada, qualquer "passou no meu celular" não prova o código auditado |
| 1 | Segurança RLS, perfis e permissões em **staging**; gates de SQL/Edge ainda ausentes | Evita risco de exposição (INV-067), dados reais e falsas confirmações |
| 2 | Cadastro e sessão nos 6 perfis; D-004/D-005; login/OTP/exclusão apenas com contas descartáveis | Libera os testes sem risco para usuários reais |
| 3 | Motorista e Passageiro: Maps/GPS, destinos, histórico, preço, documentos, notificações, recibos e fluxo de corrida com driver A/B | Integração de maior impacto; depende de Redispatch e backend |
| 4 | Entregas: endereço, catálogo/busca, pedidos e histórico, sacola, cupons, imagem/avatar, documentos, horário e aprovação | Corrigir UI e persistência sem ocultar erros |
| 5 | Admin, financeiro e operações: RBAC, cobertura, push, campanhas limitadas, reconciliação e transações em sandbox | Evitar pagamentos/notificações reais e testar fronteiras |
| 6 | Varredura **visual** final em todas as telas autenticadas, dispositivos e estados de erro; regressão após correção visual | Último gate antes do go-live e só após correção funcional demonstrada |

## 5. Roteiro mínimo de evidências para quem testar fisicamente

Registrar por cenário: **Relatório/INV, módulo, versão/commit e build, aparelho/Android ou navegador/viewport, perfil sintético, pré-condição, passos concretos, esperado, obtido, logs sanitizados, screenshot/vídeo, PASS/FAIL/BLOQUEADO, gravidade, responsável e issue/commit do reparo.** Evitar nomes, números de telefone, protocolos, relatórios ou documentos reais nos anexos de evidência.

**Regras de regressão:** cada falha visual deve mostrar como reproduzir e qual tela/estado é afetado; não corrigir UI removendo funcionalidade ou substituindo o backend. Alterações de identidade visual devem manter autenticação, fluxo de destino, tarifa, dispatch, Safe2Pay, políticas, assinatura, GPS, OTP e acessibilidade.

**Marco seguinte:** começar a sequência independente de **Relatórios de Comunicação Visual**, numeração **Visual 01, Visual 02...**, achados **CV-001, CV-002...**, matriz separada. **Não somar CV automaticamente aos 67 INV técnicos.** A referência histórica \`VIS-001\` do Relatório 04 é apenas alias de INV-047; preservar sua identidade sem conflito.

## 6. Conclusão

- **Relatórios técnicos 01–14:** implementação e auditoria documentadas, 67 achados, **A 0**; ainda há verificações em aparelho e integração controlada, além de bloqueios de SQL/Edge/credenciais.
- **Este documento:** consolidação da fila de testes, não execução de testes nem alteração de código; não altera contagens, estados nem estrutura funcional.
- **Não autorizados neste ciclo:** gerar/instalar APK, rodar pagamentos, criar usuário real, enviar SMS/e-mail/push real, acessar tickets/anexos privados, implantar SQL, publicar, fazer merge ou alterar \`main\`.
- **Instrução permanente:** prosseguir agora apenas nos relatórios visuais incrementais. A homologação final permanece condicionada à ordem expressa **"ACABOU OS RELATÓRIOS. AGORA VAMOS PARA A HOMOLOGAÇÃO FINAL."**
