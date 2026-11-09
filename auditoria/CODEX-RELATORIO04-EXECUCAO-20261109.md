# APOIS — Relatório 04 | Correções de documentos, reenvio e reanálise (09/11/2026)

**Relatório recebido:** `RELATORIO-04-APOIS-DOCUMENTOS-E-REANALISE-20261108(1).md`. Cinco achados: INV-044…048; VIS-001 é alias do INV-047, **não** um sexto achado.

**Repositório exclusivo:** `apoistecnologia-gif/apois-superapp`, branch `audit/continuacao-20261107`. O relatório observava `audit/ecossistema-20261107`, mas a instrução de continuidade oficial nesta conversa escolheu `audit/continuacao-20261107`. Os blobs centrais ainda coincidiam com o relatório. Sem merge, alteração dos pins, publicação, APK, chamadas financeiras, objetos privados ou exclusão real.

## Preservação

- Motorista/Admin: `movvi-go-connect` pin `9fc171050d8b5703540c49d19a8f1e9f5162775f`; passageiro `7b047f75a1a919a5336c0df6e0d60b14b02f2618`; Entregas `2f4606e0fb52dffb49f2e6aebbe921ce687ab625`.
- Supabase Corridas: `tbbzkrfupmqdywnzgnms`. **Somente leitura de catálogo** nesta fase, nenhuma migração aplicada.
- Não desativar upload privado, validação de MIME, propriedade, trilha de auditoria, suspensão/bloqueio, motorista offline após substituição, revisão administrativa, paleta vermelha, captura nativa e estado de publicação da etapa 2.
- A antiga diferença 12/10 MiB era tratada por `harden-motorista-document-boundary.mjs` e **não** foi recriada como novo defeito.

## Matriz de implementação

| Item | Estado | Implementação real no integrador | Aceite/limitação |
|---|---|---|---|
| **INV-044 · P2** | **C — parcialmente corrigido** | Biblioteca do motorista removeu `storage.remove()` sem permissão e reconcilia falha/retorno perdido por Edge autenticada `driver-document-reconcile`. Em caso de vínculo confirmado, reconstrói resposta de sucesso sem segundo upload; em objeto não vinculado, registra pendência no backend preparado. Fila e RPC de inspeção de ownership por `public.users`/Storage/auditoria preparadas em SQL service-only. | O cliente mostra mensagem sem alegar sucesso ao perder resposta. **Edge e fila não implantadas**: pendência rastreável depende do deploy posterior; limpeza efetiva continua operacional/manual, nenhum DELETE automático. Falta testar conta diferente, objeto já referenciado, timeout real e fila em staging. |
| **INV-045 · P1** | **C — parcialmente corrigido** | Migração isolada prepara trigger `apois_snapshot_front_on_vehicle_change` chamando a função existente de snapshot da frente; usa exatamente o nome reaplicado pela futura migração STAGE2, sem incluir os gates de 13 fotos/idade/aprovação. Função de reenvio preparada exige o snapshot recente correspondente ao `drivers.vehicle_photo_url`. | **SQL não aplicada**. Falta testar transação, idempotência, motorista legado e revisão administrativa após reenvio. |
| **INV-046 · P1** | **C — parcialmente corrigido** | Migração isolada prepara tabela privada de revisões por pedido/item e trigger somente para alterações efetivas de CNH, selfie, CRLV e ano, pelo dono autenticado; novo RPC `apois_driver_resubmit_corrections` exige revisão posterior à solicitação para todos os itens e preserva `pending_review` e auditoria. | **SQL não aplicada**. Requer testar staging com pedidos mistos, históricos legados, correções sem mudança, reenvio repetido, fotos de inspeção e autorização; não há aprovação automática nem dados de produção alterados. |
| **INV-047 / VIS-001 · P2** | **B — implementado no código, sem homologação** | `fix-report04-driver-center-v1.mjs` passa a renderizar erro e **Tentar novamente** antes do vazio, em tela compacta/completa; mantém lista já carregada quando a atualização falha, descarta resposta antiga pelo contador de requisições e limpa erro após sucesso. | Geradores executados com fixture de arquivos reais; falta build/typecheck, renderização autenticada e Android. |
| **INV-048 · P2** | **B — implementado no código, sem homologação** | Preparação única em `prepareDriverPickedFile.ts` gerada sobre fonte fixada: lê assinatura de JPG, PNG, WebP ou PDF; normaliza MIME vazio/octet-stream, rejeita conteúdo disfarçado ou PDF em foto; usada pelo campo de cadastro, página de documentos e correções. Inputs não são resetados antes do processamento assíncrono. | Oito fixtures sintéticas da função real transformada passaram; falta câmera/gerenciador de arquivos real, Android e typecheck. |

**Nota de segurança:** os RPCs `driver_update_document` e `apois_driver_resubmit_corrections` lidos no banco confirmaram os contratos apontados. O trigger de snapshot não existia. As correções SQL foram **somente gravadas no GitHub** como arquivos `QA_NOT_APPLIED`; não reproduzi transações reais PostgreSQL nem ativei a migração STAGE2.

## Arquivos novos e editados

**Geradores e build:**
- `scripts/fix-report04-driver-center-v1.mjs` (novo)
- `scripts/fix-report04-driver-document-reconciliation-v1.mjs` (novo)
- `scripts/verify-report04-documents-v1.mjs` (novo; teste integrado ao build Parceiro)
- `scripts/build-partner-release.sh` (modificado)
- `scripts/build-motorista-module.mjs` (modificado: reconciliação do documento isolado)

**Servidor/SQL, preparados sem publicação:**
- `supabase/functions/driver-document-reconcile/index.ts` (novo)
- `supabase/corridas-forward-migrations/20261109_report04_document_cleanup_queue_QA_NOT_APPLIED.sql` (novo)
- `supabase/corridas-forward-migrations/20261109_report04_correction_proofs_QA_NOT_APPLIED.sql` (novo)

**Em workspace gerado, não alterando os repos pinados:** `src/lib/driverDocuments.mobile.ts`, `src/routes/motorista.documentos.tsx`, `src/lib/prepareDriverPickedFile.ts`, `src/components/DriverDocumentField.tsx`, `src/components/ApoisDriverCorrections.tsx` e integração visual. Os transformadores preservam as importações e só alteram o workspace descartável.

## Validações realizadas

1. **Banco lido sem escrita:** definições das funções `driver_update_document`, `apois_driver_resubmit_corrections`, `apois_driver_correct_inspection_photo`, `apois_driver_correct_manufacture_year`, `private.apois_snapshot_front_on_document_change`, trigger `enforce_driver_document_objects`; colunas e triggers de drivers/inspeções; Storage owner/políticas. A política de upload de documentos é INSERT, sem DELETE ampla.
2. **Execução isolada real dos geradores:** cinco scripts exatos do integrador (captura anterior, central, visual vermelho, correção do Relatório 04, reconciliação) executados contra cinco arquivos reais do snapshot Motorista em filesystem simulado. Resultado: **5/5 geradores aprovados**; sete arquivos gerados/alterados no mock; nenhum objeto externo tocado.
3. **Casos de arquivo:** **8/8** imagens/documentos sintéticos passaram o helper gerado, incluindo JPEG sem MIME, PNG octet-stream, WebP, PDF documental, PDF em foto, JPEG disfarçado, formato inválido e arquivo vazio.
4. **Reconciliação isolada:** gerador INV-044 aplicado **duas vezes** sobre biblioteca e tela pinadas; idempotência preservada e nenhuma chamada Storage DELETE no resultado.
5. **Estado do banco de produção (09/11):** `inv044_queue_deployed=false`, `inv046_revisions_deployed=false`, `inv045_front_trigger_active=false`, `inv046_revision_trigger_active=false`. A consulta foi somente leitura.

**Não executados:** Node gate `verify-report04-documents-v1.mjs` no checkout completo, `bun install`, typecheck, Deno check, compilação Vite/Android, transações das migrações em PostgreSQL staging, E2E de login/upload/reanálise, captura de tela autenticada, instalação física. Os ensaios V8 de código não provam compilação. Acesso GitHub conectado permite leitura/escrita, mas o terminal local desta conversa não resolve `github.com` para clonar o repositório.

## Ordem segura de futura ativação (NÃO AUTORIZA DEPLOY)

1. Conferir diff/schema/RLS de ambas as migrações em staging. Exercitar rollback e casos adversariais com documentos sintéticos; revisar `auth.jwt()`, privilégios service-only e não extrapolar `public`.
2. Implantar separadamente a fila de INV-044 e a correção de revisão INV-045/046 **somente após autorização específica de staging/release**, sem executar `20261031_vehicle_13_photos_STAGE2_ONLY_AFTER_APP_RELEASE.sql`.
3. Disponibilizar a Edge e o pacote compatível juntos; durante o intervalo sem Edge, o cliente informa resultado não confirmado e não tenta excluir o objeto. Não realizar limpeza automática em massa.
4. Na homologação final, após comando expresso do usuário, exercitar corrida e documentos em Android, 320/360/390px, câmera, cancelamento, offline, reanálise e painel Admin.

## Registro e continuidade

- Não houve edição em `main`, Supabase ou repositórios-fonte.
- Rever commits individuais na branch; reversão consiste em reverter os scripts/SQL da fase, sem migração inversa em produção (nada publicado).
- **A implementação preparatória do Relatório 04 foi concluída quanto ao código versionado e testes isolados disponíveis.** INV-044/045/046 continuam **parciais porque seus componentes servidores exigem staging/implantação**; INV-047/048 são código implementado, **não homologado**. Receber próximo relatório não depende de APK, teste físico nem ativação do banco.
