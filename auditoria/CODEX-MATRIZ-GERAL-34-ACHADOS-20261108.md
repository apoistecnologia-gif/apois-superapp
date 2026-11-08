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
| INV-009 | P0 | Entregas financeiro | G | SECURITY DEFINER acessível em produção; SQL ACL não aplicado |
| INV-010 | P1 | Pagamentos | G | Gate Safe2Pay/regras de pagamento eletrônico pendente |
| INV-011 | P2 | Testes | C | Gates expandidos, falta comportamento autenticado |
| INV-012 | P2 | Entregas build | D | Fallback bun install e lint não bloqueante persistem |
| INV-013 | P2 | Entregas | E | Pedidos sem paginação; impacto real a medir |
| INV-014 | P2 | Entregas | E | Avatar cache URL fixa; confirmar regressão |
| INV-015 | P2 | Entregas | E | Imagem de produto órfã após falha do update; confirmar fonte final |
| INV-016 | P2 | Corridas | B | Anexo sem URL mostra erro/retentativa; homologação pendente |
| INV-017 | P2 | Supabase | G | Proteção contra senhas vazadas depende de configuração/testes |
| INV-018 | P2 | Supabase | E | RPCs expostas demandam triagem por privilégio e efeito |
| INV-019 | P1 | Vercel | E | Aliases/previews demandam identificação do commit em publicação |
| INV-020 | P2 | Entregas financeiro | D | Texto mojibake da função SQL ainda não corrigido |
| INV-021 | P1 | Corridas carteira | B | DOMAIN ID e hardener Auth ligados à montagem; teste real pendente |
| INV-022 | P2 | Entregas busca | B | Lojas não dependem dos 40 produtos exibidos |
| INV-023 | P2 | Entregas busca | B | Coordenada ausente não vira 0,0; zero explícito preservado |
| INV-024 | P1 | Entregas horários | C | 24h alinhado; timezone e gates operacionais divergentes |
| INV-025 | P1 | Admin Corridas | B | Período relativo recalculado a cada Atualizar |
| INV-026 | P1 | Admin Entregas | B | Draft ligado à cidade e respostas A/B isoladas; RPC real pendente |
| INV-027 | P1 | Admin Entregas | B | Centro vazio/fora da faixa rejeitado antes da RPC |
| INV-028 | P2 | Login publicado | E | Contraste de deployment não atribuído à fonte pinada |
| INV-029 | P2 | Login Entregas | B | 44px toque no snapshot; publicação ainda não homologada |
| INV-030 | P2 | Login Entregas | B | IDs/htmlFor/name em ambas variantes do snapshot |
| INV-031 | P1 cond. | Promoções | E | Contrato promoção → compra/limite ainda não demonstrado |
| INV-032 | P2 | Cupons | B | Falha de leitura não aparenta zero nem permite exclusão |
| INV-033 | P2 | Sacola | C | Readd atualiza preço; reabertura/checkout ainda sem revalidação |
| INV-034 | P1 cond. | Trigger QA | G | SQL NULL safe preparado, não aplicado em produção |

## Total geral
- A: 0 (nenhuma feature pronta por mera presença da interface ou teste isolado).
- B: 16 — alterações publicadas na branch, mas aguardando validação no produto final.
- C: 4 — medidas parciais com riscos residuais conhecidos.
- D: 3 — defeitos confirmados não resolvidos.
- E: 7 — evidência condicional, ainda não comprovada na versão publicada.
- G: 4 — bloqueio externo, SQL de staging ou configuração de produção.
- Total: 34.

**Bloqueio de produção vigente:** INV-009. As migrações INV-009 e INV-034 estão versionadas como NOT_APPLIED; nenhum banco de produção foi modificado.

**Homologação obrigatória:** preservar AUTH/DOMAIN IDs, checkout/preço server-side, upload privado e permissões, operações diretas/manuais, identidade visual aprovada e os três pins; testar end-to-end antes de release.
