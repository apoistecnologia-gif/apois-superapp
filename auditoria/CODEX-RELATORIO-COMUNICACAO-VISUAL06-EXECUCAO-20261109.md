# APOIS — Relatório de execução da comunicação visual 06 (RV-06)

**Data:** 09/11/2026  
**Módulo:** APOIS Motorista — anexos, cadastro e central de correções  
**Repositório de integração:** `apoistecnologia-gif/apois-superapp`  
**Única branch alterada:** `audit/continuacao-20261107`  
**Relatório recebido:** `RELATORIO-VISUAL-06-APOIS-DOCUMENTOS-20261109(1).md`  
**Novos IDs visuais:** CV-021 / VIS-022 e CV-022 / VIS-023 (P2)  
**Estado:** código preparatório registrado na branch; não homologado em app real.

## 1. Estado de origem e escopo

- A branch autorizada foi confirmada via GitHub. Antes das alterações, seu HEAD era `c0cc1c0ba874d452f65cc6a7ddb6404a03d381d4`.
- O arquivo protegido `.apois/source-lock.json` foi lido no blob SHA `3f98789f28666ccc052175db10f138208dd0937b`. Não foi editado.
- As fontes `apois-entregas@2f4606e0fb52dffb49f2e6aebbe921ce687ab625`, `say-hello-buddy-23-84b5dcbf@7b047f75a1a919a5336c0df6e0d60b14b02f2618` e `movvi-go-connect@9fc171050d8b5703540c49d19a8f1e9f5162775f` não foram modificadas.
- Foi consultado o componente `src/components/DriverDocumentField.tsx` no snapshot protegido do Motorista, além dos geradores, contrato de cadastro, tela de documentos, central de correção, red-theme e fluxo nativo.
- Nenhum achado técnico histórico foi reaberto ou reclassificado. `VIS-001/INV-047` e a retificação `VIS-007/CV-006` não foram duplicados.

## 2. Correções preparatórias implementadas

### CV-021 / VIS-022 — orientação preventiva dos documentos (P2)

**Antes:** o gerador `fix-partner-driver-photo-capture-v2.mjs` define `PHOTO_ACCEPT`, `DOCUMENT_ACCEPT` e `MAX_BYTES = 8 * 1024 * 1024`, mas não apresenta a lista efetiva de formatos e o limite antes da escolha no próprio `DriverDocumentField`. As orientações de enquadramento na vistoria não substituem a indicação técnica. A central de correções explica o limite após uma rejeição, não antes do seletor.

**Depois:** `fix-partner-driver-document-guidance-visual06-v1.mjs` adiciona uma única linha de ajuda no campo, usando `effectiveAccept` para distinguir **JPG, PNG e WebP** de documentos que também aceitam **PDF**. O texto comunica limite do **arquivo final de 8 MB**, sem afirmar que o original sempre precisa estar abaixo de 8 MB, porque a preparação/compressão vigente pode reduzir imagens. A ajuda mantém a descrição da foto e passa a ter ID acessível associado aos inputs de câmera e galeria.

Na central de correções, o mesmo patch acrescenta orientação curta junto a cada foto solicitada: **“JPG, PNG ou WebP · até 8 MB para envio.”** Não anuncia PDF em campo exclusivo de imagem nem altera a pré-validação existente. As instruções de vistoria do veículo continuam intactas, evitando duplicação em cada tela do formulário.

**Arquivos gerados afetados quando o builder for executado:** `.work/partner-motorista/src/components/DriverDocumentField.tsx` e `.work/partner-motorista/src/components/ApoisDriverCorrections.tsx`. As fontes pinadas e `src/` originais não foram alteradas.

### CV-022 / VIS-023 — mensagem do seletor Android (P2)

**Antes:** `handleNative` lança `A foto precisa ter até 8 MB. Selecione uma imagem menor.` quando a saída processada ultrapassa o limite, mas o `catch` só reconhece `native_photo_size` e converte outros erros em orientação sobre acesso à câmera/fotos, mesmo quando a causa não é permissão.

**Depois:** o patch preserva o texto conhecido de saída acima de 8 MB, conserva o tratamento de `native_photo_size`, informa quando não veio imagem (`empty_native_photo`) e apresenta mensagem **neutra** para causas desconhecidas, sem atribuí-las a permissões. A guarda `if (!isNativePickerCancellation(cause))` permanece intacta: cancelar não deve gerar alerta.

**Não alterados:** uso do plugin Camera/Capacitor, seletor, leitura dos bytes, compressão, `MAX_BYTES`, `onChange(out)`, validações, associação do documento, eventos e chamadas de upload.

## 3. Ordem de montagem e arquivos versionados

Em `scripts/build-partner-release.sh`, o novo overlay é executado **depois** de:
- geradores de vistoria e foto (`vehicle-photo-form-v1`, `vehicle-photo-upload-v1`, `photo-capture-v2` e `native-photo-v3`);
- transformações posteriores de inscrição, correção de documentos, central de correções e identidade vermelha;
- etapa visual anterior `CV-013–015`.

Depois do overlay, o pipeline chama `node --test scripts/qa/test-partner-driver-document-guidance-visual06-v1.test.mjs` e três verificações de presença de marcadores. O patch recusa âncoras ausentes/duplicadas, valida os dois componentes antes de gravar e é idempotente.

**Arquivos versionados:**
1. `scripts/fix-partner-driver-document-guidance-visual06-v1.mjs` — novo patch visual.
2. `scripts/qa/test-partner-driver-document-guidance-visual06-v1.test.mjs` — novos testes de regressão.
3. `scripts/build-partner-release.sh` — integração do patch, teste e gates.
4. `auditoria/CODEX-MATRIZ-COMUNICACAO-VISUAL-20261109.md` — histórico preservado e dois registros acrescidos.
5. `auditoria/CODEX-RELATORIO-COMUNICACAO-VISUAL06-EXECUCAO-20261109.md` — presente registro.

**Commits de código realmente criados:** `1f5e561849dfac4efb22e13c71cbc4290b829513` (patch), `c5acb39931b88a463d079cd44ee15298905ebf14` (testes) e `3157b8919f61a58cff210dfd3e82554fa324ea24` (pipeline). A matriz e o relatório possuem commits posteriores independentes.

## 4. Evidências de validação — sem inflar testes

**Executado:**
- Leitura e comparação estática dos scripts de geração, suas âncoras e sequência, com verificação do componente fonte protegido.
- Extração da string do componente produzida pelo gerador V2 e da central de correções diretamente do código remoto, com confirmação dos pontos de inserção.
- `node --check` dos dois novos scripts em cópia local.
- `node --test` em cópia local usando **fixtures sintéticas que representam os trechos relevantes dos geradores**: **4 testes aprovados de 4**, envolvendo ajuda por formato, associação de descrição, classificação nativa, cancelamento silencioso, preservação de callbacks/contratos, central de correções, idempotência e rejeição de drift. **Esses resultados não são equivalentes a executar todos os geradores reais da branch.**
- Teste versionado foi incorporado ao pipeline, mas sua execução no checkout remoto completo **ainda não ocorreu**. Ele foi projetado para reconstruir o componente a partir dos literais reais V2/V3 e aplicar a transformação visual, sem acessar bancos de dados.

**Não executado:** montagem completa `build-partner-release.sh`, `bun install`, typecheck geral, lint, build web, renderização React/DOM, testes de navegador/WebView, câmera e galeria Android reais, envio de arquivo, cadastro, upload, APK ou homologação física.

## 5. Homologação restante — somente após autorização expressa

Ao começar a homologação final, vincular um APK/commit realmente instalado e validar:
- documento com PDF aceito e campo exclusivo de imagem sem PDF; fotos JPG/PNG/WebP, arquivo vazio, HEIC, formato inválido e original maior que 8 MB cuja saída possa ficar abaixo do limite;
- foto final acima de 8 MB, `native_photo_size`, retorno vazio, erro desconhecido e cancelamento sem alerta;
- erro de upload sem alteração da classificação do arquivo, prévia, status de processamento, identificação de anexo e diferença entre seleção local e documento submetido à análise;
- leitura por TalkBack e teclado, fonte ampliada, contraste, 320/360/390/412 CSS px, paisagem e Android WebView.

O relatório de auditoria original não demonstra falha produtiva do upload, apenas perda de orientação específica no tratamento local. Questões de envio, autorização, armazenamento, persistência, estados operacionais e engenharia permanecem fora deste patch visual.

## 6. Integridade e classificação

**Matriz visual:** 22 registros independentes `CV-001–CV-022` (20 anteriores + 2 desta rodada).  
**Achados técnicos históricos:** 67, sendo A=0, B=46, C=17, D=0, E=1, G=3, **inalterados**.  
**Sem** merge, deploy, APK, migração SQL/RLS, alterações em Supabase, pagamento, Safe2Pay, login/Google, GPS, Maps, estados ou callbacks.

**Conclusão:** CV-021 e CV-022 têm correção visual preparatória implementada e integrada ao builder, com testes de fixture locais aprovados. A compilação e a homologação no produto final permanecem **pendentes**; portanto não declarar funcionalidade aprovada em Android.
