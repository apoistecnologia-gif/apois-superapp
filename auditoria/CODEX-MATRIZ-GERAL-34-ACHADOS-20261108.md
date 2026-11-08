# APOIS — Matriz geral consolidada (34 achados, 08/11/2026)

**Base executora:** apoistecnologia-gif/apois-superapp, branch audit/continuacao-20261107.
**Referências:** Relatório 01, Relatório 02, auditoria/CODEX-MATRIZ-CONSOLIDADA.md, auditoria/CODEX-RELATORIO02-EXECUCAO-20261108.md.
**Não substituir:** mantém 20 achados da fase 1; inclui 14 da fase 2; nenhum encerrado por aparecer outro relatório.

## Semântica de status
A = corrigido, build e E2E validados; B = correção implementada no código, sem homologação integral; C = correção parcial; D = confirmado, ainda não corrigido; E = risco/impacto/versão a comprovar; G = depende de produção, autorização externa ou staging.

| ID | Prioridade | Área | Estado | Síntese e aceite restante |
|---|---|---|---|---|
| INV-001 | P2 | Entregas | D | Atendimento localiza protocolo só entre 50 resultados; falta endpoint por ID/QA |
| INV-002 | P1 | Corridas | B | Troca de protocolo protegida contra resposta antiga; E2E pendente |
| INV-003 | P1 | Corridas | B | Rascunho/arquivos isolados por protocolo; E2E pendente |
| INV-004 | P1 | Corridas | B | Upload reconciliado por arquivo; verificar Storage real |
| INV-005 | P2 | Corridas | C | Recuperação de falha RPC implementada; órfãos antigos pendentes |
| INV-006 | P1 | Corridas | B | Botão de ocorrência legível no código; Android pendente |
| INV-007 | P1 | Corridas | B | Link para protocolos no histórico atual; navegação real pendente |
| INV-008 | P1 | Entregas | B | Credencial fora de argv/log; build real com token sintético pendente |
| INV-009 | P0 | Entregas financeiro | B | Migração `apois_inv009_restrict_financial_settle_direct_execute_20261108` aplicada e ACL verificada no banco: `anon=false`, `authenticated=false`, `service_role=true`; faltam testes de operação autenticada/integração financeira (não reaplicar). |
| INV-010 | P1 | Pagamentos | G | Gate Safe2Pay/regras de pagamento eletrônico pendente |
| INV-011 | P2 | Testes | C | Gates expandidos, falta comportamento autenticado |
| INV-012 | P2 | Entregas build | D | Fallback bun install e lint não bloqueante persistem |
| INV-013 | P2 | Entregas | E | Pedidos sem paginação; impacto real a medir |
| INV-014 | P2 | Entregas | E | Avatar cache URL fixa; confirmar regressão |
| INV-015 | P2 | Entregas | E | Imagem de produto órfã após falha do update; confirmar fonte final |
| INV-016 | P2 | Corridas | B | Anexo sem URL mostra erro/retentativa; homologação pendente |
| INV-017 | P2 | Supabase | G | Proteção contra senhas vazadas depende de configuração/testes |
| INV-018 | P2 | Supabase | C | Identificadas 113 funções `SECURITY DEFINER` inicialmente executáveis por `anon`. ACL de 20 RPCs administrativas `admin_*` corrigida na produção via `apois_inv018_restrict_anon_admin_rpc_execute_20261108` e verificada (anon 0/20; auth/service 20/20). Demais funções exigem triagem individual e testes. |
| INV-019 | P1 | Vercel | E | Aliases/previews demandam identificação do commit em publicação |
| INV-020 | P2 | Entregas financeiro | D | Texto mojibake da função SQL ainda não corrigido |
| INV-021 | P1 | Corridas carteira | B | DOMAIN ID e hardener Auth ligados à montagem; teste real pendente |
| INV-022 | P2 | Entregas busca | B | Lojas não dependem dos 40 produtos exibidos |
| INV-023 | P2 | Entregas busca | B | Coordenada ausente não vira 0,0; zero explícito preservado |
| INV-024 | P1 | Entregas horários | B | Ajuste 24h e RPC autoritativa `apois_visible_merchant_order_status(uuid[])` aplicada; conectores de Home/Busca/Estabelecimento no builder. Falta homologação funcional 24h/fuso/cidade inativa/fechamento temporário e atualização em tempo real. |
| INV-025 | P1 | Admin Corridas | B | Período relativo recalculado a cada Atualizar |
| INV-026 | P1 | Admin Entregas | B | Draft ligado à cidade e respostas A/B isoladas; RPC real pendente |
| INV-027 | P1 | Admin Entregas | B | Centro vazio/fora da faixa rejeitado antes da RPC |
| INV-028 | P2 | Login publicado | E | Contraste de deployment não atribuído à fonte pinada |
| INV-029 | P2 | Login Entregas | B | 44px toque no snapshot; publicação ainda não homologada |
| INV-030 | P2 | Login Entregas | B | IDs/htmlFor/name em ambas variantes do snapshot |
| INV-031 | P1 cond. | Promoções | C | Geradores client e SQL versionados; revisão de elegibilidade produto+categoria e limite com cancelamento sem pagamento; 9 casos SQL sintéticos em TEMP/ROLLBACK passaram. Migração **não aplicada**, sem E2E, sem desconto/cobrança real. Consentimento cliente quando preço do backend diverge em ambos os sentidos. |
| INV-032 | P2 | Cupons | B | Falha de leitura não aparenta zero nem permite exclusão |
| INV-033 | P2 | Sacola | C | Novo addItem atualiza preço; gerador de sacola persistida consulta produtos/opções e sinaliza indisponibilidade; checkout confere total autoritativo. Falta typecheck, testar falha de rede durante revalidação, reabertura e dispositivo. |
| INV-034 | P1 cond. | Trigger QA | B | Migração `apois_inv034_qa_order_guard_null_safe_20261108` aplicada no Supabase Entregas; trigger `apois_qa_never_real_payment` ativo e função NULL-safe confirmada. Testes reais de âncora ausente/renomeada e fluxos QA ainda pendentes. |

## Total geral
- A: 0 (nenhuma feature pronta apenas por presença de interface ou teste isolado).
- B: 19 — correções implementadas e/ou aplicadas, sem homologação integral do produto.
- C: 5 — medidas parciais, inclusive promoções mantidas desativadas.
- D: 3 — defeitos confirmados ainda não resolvidos.
- E: 5 — evidência/versão ainda a comprovar.
- G: 2 — bloqueios externos ou de configuração.
- Soma conferida: 0 + 19 + 5 + 3 + 5 + 2 = 34.
- Total: 34.

**Estado de produção em 08/11/2026:** as migrações INV-009, INV-034, INV-024 e o reforço parcial INV-018 foram confirmadas aplicadas no Supabase Entregas (`ptgkwyyolrdgnqketkjj`). INV-009 deixou de ser bloqueio por ACL de execução direta; **INV-031 permanece NÃO APLICADA**. Não declarar produção homologada: restam E2E de pagamento, permissões e apps. Nenhum pagamento real foi efetuado nesta continuação.

**Homologação obrigatória:** preservar AUTH/DOMAIN IDs, checkout/preço server-side, upload privado e permissões, operações diretas/manuais, identidade visual aprovada e os três pins; testar end-to-end antes de release.

## Evidências adicionais desta continuação — 08/11/2026

- HEAD inicial verificado no GitHub: `8a87a091ccc32b0f4368779426109e6a199c16e5`, branch `audit/continuacao-20261107`; fontes pinadas permanecem intocadas.
- **Produção / publicado no banco:** migrações em `supabase_migrations.schema_migrations`: INV-009, INV-034, INV-024. INV-018 aplicada posteriormente: `apois_inv018_restrict_anon_admin_rpc_execute_20261108`; pós-teste ACL de 20 RPCs: anon 0, authenticated 20, service_role 20. São alterações reais de banco, não publicação de aplicativo.
- **Implementado em GitHub, sem APK/deploy:** versão de promoções mais restrita (produto E categoria quando ambos definidos), limite de usos que desconsidera pedido cancelado sem pagamento, badge âmbar da marca, confirmação explícita de **qualquer** discrepância no total servidor versus tela antes de gerar PIX, verificador de integridade atualizado.
- **Testado:** migração promocional compilada com `BEGIN/ROLLBACK`; função da migração clonada para `pg_temp` e exercitada em 9 pedidos e promoções sintéticos, com 9 asserções de desconto/total e 5 resgates únicos. Todas passaram, sem escrita persistente em pedidos reais. ACL INV-018 testada em `BEGIN/ROLLBACK` e depois verificada após aplicação. Migração de promoções ainda ausente do catálogo de produção.
- **Não realizado:** instalação de dependências, typecheck completo, lint, testes full, build completo, E2E autenticado de pagamentos, Android físico, implantação Vercel. `INV-028` não pode ser atribuída com segurança a commit: listagem de deploys Vercel retornou HTTP 403 para projetos relevantes; nenhuma alteração especulativa de contraste foi feita.
- **Permanecem pendentes:** demais `SECURITY DEFINER` executáveis por anon, falhas `INV-001`, `INV-012`, `INV-020`, contrato Safe2Pay, validações de regressão de horários/sacola/cupons/carteira/login/cobertura e bloqueios do Relatório 01. O estágio `A` requer E2E e release validados.
