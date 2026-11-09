# APOIS — RV-12 | Relatório de execução: operação Estabelecimento e Admin

**Data:** 09/11/2026  
**Entrada:** RELATORIO-VISUAL-12-APOIS-OPERACAO-ADMIN-20261109(1).md  
**Repositório e única branch de escrita:** apoistecnologia-gif/apois-superapp — audit/continuacao-20261107.  
**Baseline RV-11:** commit 718294f9ad9c71aea119da30511a3b5ab7c6c9b5; 38 registros visuais.  
**Novos IDs:** VIS-040–044 / CV-039–CV-043 (5); ampliações de VIS-027, VIS-032, VIS-034 e VIS-022 (4), sem novos IDs.  
**Estado real:** overlays e testes preparados; inspeção + simulação de scripts, sem build full, impressão física, pedido, cupom, upload ou publicação.

## 1. Versões, inspeção e preservações

O relatório do auditor externo foi gerado a partir da branch audit/ecossistema-20261107. Ela não foi alterada. A execução manteve a branch audit/continuacao-20261107. O arquivo .apois/source-lock.json permanece protegido pelo blob SHA 3f98789f28666ccc052175db10f138208dd0937b, com fontes pinadas:
- Entregas: 2f4606e0fb52dffb49f2e6aebbe921ce687ab625;
- Corridas / Passageiro: 7b047f75a1a919a5336c0df6e0d60b14b02f2618;
- Corridas / Motorista/Admin: 9fc171050d8b5703540c49d19a8f1e9f5162775f.

Foram inspecionadas diretamente as fontes pinadas de MerchantOrderControlCenter, merchant.tsx, MerchantCouponsPanel, MerchantProductEditor, AdminOrdersPanel, AdminCoveragePanel, AdminReviewsPanel, AdminCourierSettlementsPanel, a apresentação de adicionais na tela de pedido e o SQL de criação atômica de pedidos. No integrador, foram inspecionados os geradores fix-entregas-merchant-order-review-v1.mjs, fix-entregas-coupon-metrics-v2.mjs, harden-entregas-merchant-image-mime.mjs, fix-merchant-order-control-visual-v1.mjs, demais etapas dos dois builders e a matriz RV-11.

**Diferença crítica entre builders:** build-isolated-module.mjs executa fix-entregas-merchant-order-review-v1.mjs, que consulta order_items(*) e cria a revisão da Central. O builder separado build-merchant-panel.mjs aplica a apresentação da Central, mas **não** executa esse gerador de revisão enriquecida. Não se pode afirmar que essa Central mostre opções, sequer os itens completos, no artefato Merchant até identificar a versão distribuída. O RV-12 não introduziu nova consulta a pedidos ou alterou autorização para mascarar essa diferença.

## 2. CV-039 / VIS-040 — P1: adicionais do pedido omitidos

**Causa confirmada:** a rota Merchant carregava orders com order_items(*), mas o card detalhado renderizava apenas quantidade, produto e valor. printMerchantOrder formatava cada item apenas como quantidade, produto e valor; por ser impresso via textContent, nenhuma escolha aparecia se não fosse adicionada à string. O gerador de revisão MerchantOrderControlCenter também listava quantidade e produto, mas não selected_options.

**Contrato verificado sem tocar no banco:** o SQL supabase/migrations/20260808060000_create_order_atomic.sql acrescenta ao JSONB selected_options do item o groupId, groupName, optionId, optionName e priceDelta, sem alterar o valor financeiro em apresentação. A tela Cliente de pedido já usa optionName como evidência do formato. A coluna order_items.selected_options é um array JSONB; não depende de tabela adicional no renderizador.

**Implementação preparada:**
- Novo scripts/templates/formatMerchantSelectedOptions.ts, instalado no workspace gerado como src/lib/formatMerchantSelectedOptions.ts. Recebe dados somente para apresentação, com suporte ao array de snapshots; em objeto legado, usa valores; se o formato for inesperado, informa que detalhes de adicionais não estão disponíveis em vez de adivinhar escolha.
- Novo scripts/fix-entregas-merchant-options-visual12-v1.mjs, overlay idempotente/fail-closed. Em src/routes/merchant.tsx adiciona lista de escolhas sob o item detalhado. Na impressão, cada item mantém a linha original de quantidade/nome/valor, seguida das opções individuais, antes da linha de item seguinte. Mantém receipt.textContent e totais intactos.
- No MerchantOrderControlCenter, quando a revisão enriquecida já estiver presente, seu item também lista grupo/opção com as escolhas. Preserva observação geral, destino, estado de aceite e botão desabilitado se os itens não carregaram.
- No mesmo painel enriquecido, substitui apenas a expressão de apresentação para cash/pending de “Pagamento direto de teste — não recebido” por “Pagamento direto — ainda não confirmado”, sem transformar pending em paid.
- O overlay **não** ativa revisão enriquecida no builder Merchant que não a contém. Isso exige autorização técnica se for necessária uma nova consulta/contrato; P1 não está homologado em produção.

**Verificação realmente efetuada:** o código do patch foi aplicado em V8 aos snapshots pinados da rota Merchant e à revisão gerada pela execução em memória do gerador existente, com idempotência. Na Central original sem esse gerador houve skip explícito. O formatador puro foi exercitado em V8 com dois itens de nome idêntico e escolhas distintas (“Ponto: Bem passado” versus “Ponto: Mal passado”), ausência de opções e formato inesperado. Não foi construído nem impresso um pedido.

**Pendência bloqueante de homologação operacional:** identificar o bundle efetivamente utilizado, conferir todas as superfícies de preparo (Central, card, comanda) com pedido autorizado de teste, verificar duas linhas do mesmo produto com opções diferentes, observação geral separada, e imprimir/visualizar no papel real. Não considerar CV-039 encerrado até a conclusão dessa validação.

## 3. CV-040 / VIS-041 — badge de cupom com vigência futura

**Antes:** a cor e o texto Ativo eram associados a is_active e não expirado; um início no futuro não era verificado.

**Depois:** scripts/fix-entregas-merchant-coupons-image-visual12-v1.mjs acrescenta comparação somente de apresentação de starts_at com new Date e mostra **Agendado** se o cupom estiver habilitado e ainda não tiver iniciado. Mantém os demais estados Expirado, Pausado e Ativo. A cor de sucesso fica reservada a cupom habilitado, não expirado e já iniciado. O overlay não edita os campos, fuso, vigência no checkout, regras de desconto, permissões ou endpoint.

O estado foi analisado por leitura de JSX e expressão em teste sintético; falta verificar horário local/UTC, cadastro real e render.

## 4. CV-041 / VIS-042 — usos desconhecidos não são zero

**Achado confirmado no snapshot bruto, mas já mitigado pelo integrador:** o hardener preexistente scripts/fix-entregas-coupon-metrics-v2.mjs tem marcador APOIS_COUPON_USE_READ_STATUS_V2 e cobre falha na consulta de coupon_redemptions com usageState=failed. Apresenta Uso: Indisponível em vez de zero, bloqueia exclusão na interface e em deleteCoupon quando a leitura não foi confirmada. Essa proteção também já foi vinculada a INV-032 técnico; não foi substituída.

**Ampliação nesta rodada:** quando a consulta principal da lista de cupons falha, o componente ainda podia apresentar “Nenhum cupom cadastrado” enquanto exibisse uma mensagem genérica de falha. O novo overlay acrescenta couponListFailed para mostrar a falha e retry separadamente do estado vazio. Para não gerar dois avisos redundantes, o alerta de indisponibilidade dos usos do hardener V2 não é repetido enquanto a própria lista principal falhou. Não são inventadas contagens; não houve exclusões, checagem real de RLS ou alterações de privilégios.

**Validação:** overlay aplicado em V8 sobre o output real do script V2, com idempotência. Testes Node de regressão versionados. Não foi testada resposta real de cupons ou backend.

## 5. CV-042 / VIS-043 — sem chamar pedido real de “teste”

**Antes:** o gerador de revisão MerchantOrderControlCenter exibia “Pagamento direto de teste — não recebido” para todo pedido com payment_method cash e payment_status pending, sem avaliar o ambiente.

**Depois:** apenas a frase se torna **“Pagamento direto — ainda não confirmado”** nesse mesmo caso. Nenhum outro resultado de pagamento, marcação como paid, cobrança, status de pedido, bloqueio, callback ou modalidade foi alterado. A transformação ocorre somente onde o gerador de revisão está montado.

**Limite:** não se comprovou qual UI Merchant está publicada e tampouco se outra cópia de texto contém uma identificação de homologação correta. Essa última não deve ser suprimida indiscriminadamente.

## 6. CV-043 / VIS-044 — input de imagem alcançável por teclado

**Antes:** o MerchantProductEditor envolve input type=file em label visível, porém o próprio input tinha className hidden, excluindo-o do foco sequencial. O accept é image/jpeg,image/png,image/webp.

**Depois:** a mesma instância de input passa a className sr-only (focável por Tab); o label recebe estado visual focus-within e mensagem **“Formatos aceitos: JPG, PNG e WebP.”** Não foram acrescentados outros botões/onClick, não há abertura duplicada planejada, e onChange continua obtendo apenas o primeiro arquivo, chamando uploadImage(file) e redefinindo event.currentTarget.value. MIME e busy estão inalterados.

**Pendente:** teste físico/browser de Tab/Espaço, cancelamento sem envio, foco durante busy e formatos; nenhum arquivo foi enviado nesta execução.

## 7. Ampliações sem novos IDs

**VIS-027 / CV-026 — AdminOrdersPanel e lista MerchantCouponsPanel:** adicionados estados locais de apresentação para erro de consulta e timeline, aviso com retry e bloqueio do falso vazio. Em falha de atualização de pedidos, a lista anteriormente carregada pode continuar com aviso de que os dados podem estar desatualizados. Em falha de timeline, erro e retry têm prioridade sobre “Nenhum evento adicional registrado”. No cupom, falha inicial mostra erro em vez de “Nenhum cupom cadastrado”. Queries, filtros, status e eventos não mudaram.

**VIS-032 / CV-031 — filtros e cobertura Admin:** selects de status, pagamento e cidade do AdminOrdersPanel recebem aria-label. O Input auxiliar de AdminCoveragePanel recebe nome acessível pelo label específico quando disponível, com placeholder como fallback; o campo GeoJSON recebe aria-label. Os outros campos anteriormente corretamente envolvidos por label continuam sem refatoração funcional.

**VIS-034 / CV-033 — avaliações e repasses Admin:** botões de filtro recebem aria-pressed={filter===id}. Valores, onClick, setFilter, consultas e ações de repasse não foram alterados.

**VIS-022 / CV-021 — instrução de arquivo:** a orientação JPG/PNG/WebP do editor vem estritamente do accept existente. Não é reutilizada a política de 8 MB/documentos do Motorista. A alteração é a mesma de CV-043, sem dupla contagem.

## 8. Arquivos versionados

| Tipo | Caminho | Finalidade |
|---|---|---|
| Novo | scripts/templates/formatMerchantSelectedOptions.ts | Formatar JSONB de adicionais por item, sem alterações de preço |
| Novo | scripts/fix-entregas-merchant-options-visual12-v1.mjs | Card, comanda, Central enriquecida e mensagem cash/pending |
| Novo | scripts/fix-entregas-merchant-coupons-image-visual12-v1.mjs | Agendado, falha/zero e teclado/upload |
| Novo | scripts/fix-entregas-admin-visual12-v1.mjs | Erro/vazio Admin, nomes de campos, filtros pressed |
| Novo | scripts/qa/test-entregas-visual12-v1.test.mjs | Regressões Node para os componentes gerados |
| Modificado | scripts/build-isolated-module.mjs | Aplicação tardia e gates RV-12 no modo Entregas |
| Modificado | scripts/build-merchant-panel.mjs | Aplicação tardia e gates RV-12 no painel Merchant |
| Modificado | auditoria/CODEX-MATRIZ-COMUNICACAO-VISUAL-20261109.md | Registros CV-039 a CV-043; ampliações sem renumerar |
| Novo | auditoria/CODEX-RELATORIO-COMUNICACAO-VISUAL12-EXECUCAO-20261109.md | Relatório independente e limites desta execução |

Commits de criação das correções e gates: formatador 3538d7e9de97e6109898e2acdcd4a05efd627616; overlay de pedidos 4c58a479a83dd1badf5196dcc3a7798f0593278c; cupons/imagem 8414132daa9059a6be2a888f1ccf8d217019b5d4; Admin 6b30d395ccfc30a94312f0ed5d2c016df21b258b, ajustado em 67b1b0b1cd535687caeecbba9d9187beca4c8bad e 8df04595f4065cb659147ba1d0df033bbef32ab4; testes 6f598eeb62d3e31d182867ce31a10d47741eb6a5; builder isolado b3a1bec4c6634150f1d1b64b5cc6bbbf9aa5fd99; builder Merchant 0b6599aedbdc830c54c6d6985d1229300102323d; matriz c50e7998b7ce02815c83ec9eb20f017fdf9ec46f.

## 9. Evidências executadas e pendências

**Efetivamente executado:**
- inspeção remota da fonte pinada, tipos/SQL de opções, scripts dos geradores e ordem dos dois builders;
- avaliação em V8 do novo overlay sobre a rota merchant.tsx pinada e MerchantOrderControlCenter após gerar em memória a versão de revisão enriquecida, inclusive reaplicação idempotente e reconhecimento de skip na Central não enriquecida;
- avaliação em V8 do script de cupons contra a saída de fix-entregas-coupon-metrics-v2.mjs, e transformação do MerchantProductEditor;
- avaliação em V8 dos quatro módulos Admin sobre snapshots pinados, com correção de âncora de recuo nos selects e marcador JSX válido no componente Input;
- avaliação sintética do formatador com dois itens de nome idêntico e escolhas distintas, arrays vazios, entrada inesperada e opção sem nome;
- parsing de sintaxe dos três scripts JS de overlay e do arquivo de testes;
- integração do teste versionado em ambos builders com markers obrigatórios.

**Não foi executado:** node --test em checkout completo, bun run typecheck/lint, build web, render React/browser/árvore acessível, impressão física, testagem real de papel 58/80 mm, mock React com dados carregados, pedidos/cuponagem/upload, SQL/RLS, avaliações de segurança de exclusão, backend/Supabase, pagamentos, integração real, deploy ou APK.

**Próximos gates reais obrigatórios:** executar suíte Node, typecheck/lint/build e corrigir regressões comprovadas; identificar artefato Merchant distribuído e analisar a lacuna da Central entre builders; testar pedido personalizado de homologação sem cobrança real (mesmo produto duas vezes com opções diferentes), preview/print por tipo de comanda, notas, total e estado de pagamento; verificar cupons futuros/vigentes/pausados/expirados, falha de coupon_redemptions/lista e retry; testar Tab/Espaço no input de foto sem upload; avaliar tela 320/360/390/412, desktop/tablet e TalkBack. Não realizar ações destrutivas de teste em produção.

## 10. Conclusão e integridade

**Contagem consolidada: 43 registros visuais CV-001–CV-043**, dos quais cinco adicionados nesta rodada e quatro anteriores ampliados. CV-041 tem proteção principal preexistente (INV-032) e não deve ser anunciado como solução nova da mesma causa. CV-039 P1 ainda depende de comprovação da Central usada e de teste impresso; CV-037/038 de RV-11 e CV-030 de RV-10 mantêm seus status anteriores.

**Técnicos históricos intactos:** 67, A=0, B=46, C=17, D=0, E=1, G=3.

**Nenhuma operação de produção:** sem merge, deploy, APK, pedidos, cupons, pagamentos, uploads, alteração de banco, SQL/RLS, APIs, auth, valores, source-lock, commits das três origens pinadas ou publicação. A preparação não equivale a homologação concluída.

**Próximo ID visual:** CV-044, se houver RV-13.
