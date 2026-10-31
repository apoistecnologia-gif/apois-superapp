# APOIS Corridas — vistoria fotográfica e Central de Ocorrências (QA)

Data: 31/10/2026. Última revisão técnica: 31/10/2026. Branch única: `fix/entregas-homologacao-ajustes-20261030`.
Fontes de Corridas Cliente e Motorista/Admin continuam pinadas somente para leitura. Nenhum APK/AAB gerado, nenhuma publicação, merge ou alteração de produção nesta etapa.

## Escopo e descoberta inicial
- A fonte Motorista já possuía `vehicle_photo_url` e foto única no cadastro, além de `driver_complete_registration_v3` e uploads privados de CNH, selfie, CRLV e veículo.
- O banco Corridas já possuía `passenger_support_tickets` com protocolo único, vínculo a corrida, status e prioridade. O painel `/admin/suporte` já permite alterar status/prioridade, com `admin_update_support_ticket`.
- A nova implementação complementa essas estruturas, sem duplicar cadastros ou substituir o backend de distribuição e pagamento.

## Código implementado em workspaces QA
- `scripts/fix-partner-driver-vehicle-photo-form-v1.mjs`: seis fotos de carros durante cadastro: frente (aproveita campo anterior), lado direito, lado esquerdo, painel, bancos dianteiros e traseiros. Outras categorias mantêm fluxo anterior.
- `scripts/fix-partner-driver-vehicle-photo-upload-v1.mjs`: upload autenticado por pastas individuais; cinco fotos novas em bucket privado `apois-inspections`; associa fotos à conta depois da RPC de registro. Não exclui imagens já associadas no caso de erro pós-cadastro.
- `scripts/fix-partner-admin-vehicle-inspection-v1.mjs`: área administrativa para visualizar as seis fotografias por URLs assinadas temporárias de 10 minutos, analisar individualmente, aprovar/reprovar e registrar motivo.
- `scripts/harden-corridas-case-center-v1.mjs`: Cliente Corridas abre ocorrência vinculada à corrida, recebe protocolo, envia até cinco anexos por lote, consulta eventos e segue andamento. Também cria rota `/ocorrencias` sem substituir histórico de corridas, com entrada a partir da tela da corrida.
- `scripts/fix-partner-support-case-workroom-v1.mjs`: Motorista consulta reclamações vinculadas às suas corridas, responde e apresenta seus arquivos; no Admin Suporte a equipe vê eventos e fotos, publica resposta ou acrescenta nota reservada.
- `scripts/verify-apois-vehicle-incidents-v1.mjs` integrado nos builds Cliente e Parceiro para verificações estáticas de privacidade e regressão.
- As preferências de viagem do Cliente e Motorista, PIN, mapas, preço, cadastro Google, fluxo do Entregador e módulos financeiros não foram alterados por estes scripts.

## Migração SEGURA AINDA NÃO APLICADA
Arquivo: `supabase/corridas-forward-migrations/20261031_vehicle_inspection_and_cases_QA_NOT_APPLIED.sql`.
- Tabela `apois_vehicle_inspection_photos`: seis ângulos, arquivo original, data/hora de submissão, decisão e motivo.
- Tabela `apois_vehicle_inspection_review_events`: log append-only da revisão (inclusive reversões).
- Buckets privados `apois-inspections` e `apois-case-evidence`; políticas por conta e caso, sem SELECT público, nem sobrescrita ou DELETE pelos usuários.
- Coluna `drivers.apois_inspection_required` default false para legados; trigger exige seis ângulos **aprovados** para os novos registros de carros, sem suspender motoristas previamente aprovados.
- `apois_case_events` e `apois_case_evidence`: linha do tempo e anexos sem alteração retroativa, controle de visibilidade e owner checks.
- RPCs `apois_open_ride_case`, `apois_case_reply`, `apois_case_internal_note`, `apois_case_register_evidence`, `apois_case_access` e `apois_submit_driver_vehicle_inspection`; autorização própria da corrida/motorista/equipe. A abertura valida propriedade da corrida; novos protocolos gerados server-side por sequência.
- Trigger registra mudanças de status provenientes da função de suporte canônica. Só equipe autorizada pode ver notas internas.
- SQL testado dentro de `BEGIN ... ROLLBACK` no Supabase Corridas (não houve DDL persistido). Funções e políticas foram compiladas e a checagem sem autenticação resultou em `none`.
- **Justificativa para não aplicar agora**: o trigger impede aprovar novos carros sem as seis fotos. Ativá-lo antes de distribuir e testar o cadastro novo criaria regressão operacional. Aplicar em janela coordenada com a versão atualizada, sob confirmação expressa.

## Segurança e documentação (boa prática, não promessa judicial)
- Evidências privadas com trilha temporal, privilégios separados, acesso temporário e impossibilidade de sobrescrita por usuário não equivalem a perícia; preservar originais, histórico e cadeia de custódia técnica.
- A equipe deve coletar apenas dados necessários, definir política documentada de retenção, exportação, bloqueio jurídico e eliminação, limitar acesso por papéis e registrar consultas sensíveis.
- Fotografia não comprova condições mecânicas. Adicionar inspeção humana e, quando exigível, manutenção e documentos de circulação atualizados.
- Em denúncias graves, ter canal de resposta urgente e procedimento de segurança; ferramenta de chamados não substitui polícia, SAMU ou atuação emergencial.
- Dar prazo razoável para manifestação, sem atrasar medidas de proteção em denúncias graves e sem revelar dados pessoais não necessários. Não fazer decisão automática de culpa.
- Referência orientativa: ANPD, guia de segurança da informação e controles de autenticação, autorização e auditoria: https://www.gov.br/anpd/pt-br/centrais-de-conteudo/materiais-educativos-e-publicacoes/guia-orientativo-sobre-seguranca-da-informacao-para-agentes-de-tratamento-de-pequeno-porte

## Critérios de homologação ainda pendentes
1. Cadastro motorista novo em ambiente controlado com seis fotos, falha/retry de upload e revisão de cada ângulo pelo Admin.
2. Aprovação bloqueada enquanto houver foto pendente/reprovada; aprovar apenas seis revisões, sem afetar 3 motoristas legados aprovados.
3. Cliente abre caso de corrida própria, anexa foto e PDF; protocolo único, consulta das atualizações após reinício.
4. Motorista da corrida responde; motorista estranho e passageiro estranho recebem acesso negado por RLS/RPC.
5. Anotações internas e anexos privados não ficam visíveis fora da equipe; tentativa de UPDATE/DELETE de evidência pelo cliente deve falhar.
6. Corrida cancelada e encerrada mantêm direito à abertura de ocorrência; status final não pode ser alterado pelo passageiro.
7. Notificações, assinatura de APK, login Google, PIN, mapas, ganhos e pagamentos não sofrem regressões.
8. Revisão jurídica das políticas de guarda e acesso antes de colocar dados reais.

**Estado:** código QA escrito; banco de produção intacto; não declarar homologação final sem testes físicos.

## Resultado técnico de build e ressalvas de prova
- GitHub Actions WEB-only `41221945351`: **3/3 jobs SUCCESS** (Cliente, Estabelecimento, auditoria WEB com Motorista/Admin/Entregador). Compilação de bundle não substitui teste Android autenticado.
- Testes automatizados das duas interfaces e RLS a nível de código: `scripts/verify-apois-vehicle-incidents-v1.mjs` executado pelos builds.
- Atualizações de protocolo passam a ser consultadas automaticamente a cada 30 segundos quando o caso está aberto, além de opção manual.
- **Fotos da vistoria:** o app aplica compressão/otimização antes de enviar; são evidências visuais do estado aparente, mas não os arquivos originais brutos da câmera nem laudo mecânico. Fotografias do Cliente ou Motorista anexadas a uma ocorrência são enviadas como arquivos selecionados sem compressão automática nesse fluxo.
- É necessária avaliação sobre arquivamento criptográfico (SHA-256 calculado no servidor), retenção parametrizada, preservação em disputa judicial e relatório de exportação autenticado. Esses recursos probatórios avançados não foram implementados; não alegar que exista cadeia de custódia pericial certificada.
- **Validação de SQL:** esquema completo compilou com `BEGIN;` + `ROLLBACK;`, criou as entidades temporariamente e verificou `apois_case_access(NULL) = none`; nenhum dado persistido.
- Nova migração continua `NOT_APPLIED`, por proteção ao cadastro atual dos motoristas. Não aplicar ou publicar sem testes conjuntos de interface e servidor.
