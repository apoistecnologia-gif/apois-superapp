# APOIS — Pendências reais após os achados Codex (08/11/2026)

Este arquivo registra somente os riscos e testes que NÃO foram encerrados. Não confundir correção em gerador, simulação ou commit com build aprovado, tela aberta ou homologação.

## P0 — Bloqueio antes da abertura ao público

### INV-009 — Liquidação financeira com EXECUTE excessivo
- Supabase Entregas: ptgkwyyolrdgnqketkjj, PROJETO DE PRODUÇÃO.
- A inspeção somente de leitura confirmou SECURITY DEFINER na função public.settle_delivered_order_financials(uuid), EXECUTE por anon e authenticated, e ausência de verificação de auth.uid/role no próprio corpo.
- Os chamadores identificados são complete_delivery_with_pin(uuid,text) e complete_pickup_with_pin(uuid,text), ambos SECURITY DEFINER e de propriedade do papel postgres como a rotina de liquidação.
- Migration restritiva NÃO APLICADA: supabase/entregas-forward-migrations/20261108_restrict_settle_delivered_order_financials_QA_NOT_APPLIED.sql.
- A PRÓXIMA AÇÃO É TESTAR EM BANCO ISOLADO o acesso direto de anon/authenticated (deve falhar), os dois wrappers legítimos (devem funcionar quando autorizados) e casos de concorrência, rollback, pagamento direto/manual versus eletrônico e idempotência do ledger.
- Só após validação e autorização específica considerar rollout. Nenhum comando de alteração foi enviado ao banco.
- Mesmo após corrigir ACL, auditar payment_status e a separação entre liquidação de pagamento direto/manual e saldo de carteira: não lançar crédito eletrônico fictício.

## P1 — Bloqueios de lançamento e homologação

### INV-008 — Token de checkout
- Código corrigido. Rodar build isolado do merchant com variável sintética e inspecionar stdout/stderr de sucesso/erro. Não divulgar segredos.
- Verificar se alguma execução histórica continha token e, apenas com evidência, coordenar revogação; não rodar rotação automática.

### INV-002/003/004/005/006/007/016 — Ocorrências e anexos
- Código atualizado em geradores de Cliente Corridas e Workroom; 8 reproduções isoladas passaram, mas nenhuma sessão real foi testada.
- Testar troca A→B com B rápido/A lento, incluindo fase createSignedUrl, polling, fechamento e reabertura.
- Testar nota interna staff, rascunhos, arquivos selecionados antes de troca, cadastro de novo chamado e usuário com outro papel; nenhum envio pode ser direcionado a protocolo errado.
- Upload: falha no 2º de 5 arquivos, conflito por objeto já presente, timeout depois do RPC, login/reinício e arquivo reescolhido. Web Crypto SHA-256 permite reidentificar conteúdo; fallback de randomUUID NÃO recupera após reinício sem o mesmo objeto File.
- Identificar órfãos anteriores à correção e definir retenção; sem exclusão automática de provas. Confirmar que RLS SELECT permite a reconciliação exata e que Storage signedUrl funciona no Android.
- Testar histórico depois de finalizar/cancelar e sem corrida ativa, tela 320/360/390/412, aumento de fonte, teclado, Voltar e safe area; medir contraste renderizado.
- Rodar os testes do checkout e os verificadores no produto transformado antes de compilar APK.

### INV-010 — Safe2Pay / pagamentos
- Gate reportado falhou 5/6. Manter Pix eletrônico sem aprovação de produção até contratos de criação, webhook autenticado, reserva, conciliação, duplicação, estorno e rollback serem testados em ambiente isolado.
- Modo direto/manual requer mensagens fiéis à operação real e NÃO deve fingir que o gateway confirmou pagamento.

### INV-019 — Versão sob teste
- Reconsultar deployment Vercel/alias, produto exibido, SHA do integrador, SHA dos módulos e versão do pacote. Não comparar screenshot do Admin antigo com Cliente atual.
- Sem deploy ou promoção de alias nesta execução.

## P2 — Pendências confirmadas ou hipóteses

- INV-001: código pinado Cliente Entregas limita chamados a 50 e tenta localizar detalhe nessa lista. Confirmar função implantada, adicionar endpoint get por ID com autorização e paginação; testar mais de 50 chamados e isolamento A/B.
- INV-011: verificador foi fortalecido, mas ainda são necessários testes comportamentais automatizados e E2E; nenhum checker textual pode certificar a aplicação.
- INV-012: o fallback bun install --no-save e lint de fixture não bloqueante permanecem. Definir gate rígido de release sem mudar dependências de forma massiva.
- INV-013: o histórico de pedidos do Cliente Entregas não tem paginação no snapshot; testar limite real, implementar paginação estável e não perder pedidos durante realtime.
- INV-014: atualizar avatar, alternar entre telas/sessões e reiniciar; cache 3600 s e URL fixa ainda não foram reproduzidos em aparelho. Evitar política de Storage permissiva.
- INV-015: verificar se o handler MerchantProductEditor em .work é sobreposto; reconciliar imagem após falha de update e preservar imagens ainda referenciadas. Nenhuma limpeza em massa.
- INV-017: validar disponibilidade da proteção contra senhas comprometidas nos dois Supabase e testar senha, OAuth Google e recuperação, sem mexer em produção durante auditoria.
- INV-018: inventariar RPC SECURITY DEFINER com owner/privilege/guard/efeito; advisors não representam uma contagem de falhas comprovadas. Não revogar todas as funções nem criar RLS permissiva.
- INV-020: corrigir futuros literais financeiros com mojibake no SQL canônico e validar em staging; avaliar eventual tratamento do histórico separadamente.

## Pendências anteriores que não desaparecem com este relatório
- D-004: tela branca do cadastro Motorista não homologada na versão atual.
- D-005: histórico Motorista recebeu captura de rejeições/retentativa na Fase 3; reteste Android ainda necessário.
- OBS-011: histórico Motorista limitado às 50 corridas antes dos filtros locais.
- Storage Entregas: políticas anteriores stage-only; não aplicadas em produção.
- Testes físicos: GPS real, background/lock screen, Google Auth, PIN, push, documentos, corrida/pedido completo, carteira, painel Admin e suporte.

## Critério para mudar B/C para A
Registrar sempre: ID, SHA integrador e pins, ambiente, aparelho/navegador, conta sintética, ação, resultado observado, screenshot/log sem PII e resultado do build/typecheck. Só classificar A com comportamento e ausência de regressão no fluxo correspondente. Uma compilação aprovada não comprova pagamento, segurança, GPS, navegação ou responsividade.

## Segurança operacional
- NÃO fazer merge na main, deploy manual, mudança de secrets, migração/RLS de produção, pagamentos ou saques reais a partir destas pendências.
- Manter os três repositórios de origem intactos até decisão explícita de atualização de pins.
- Registrar e conciliar commits de outros agentes antes de cada nova escrita na branch.
