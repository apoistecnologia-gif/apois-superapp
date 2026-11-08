# APOIS-004 — Evidência visual confiável (novembro/2026)

Foram encontrados screenshots antigos com SHA idêntico para rotas diferentes (22 arquivos na série \`mot-_*.png\`). Não interpretar estes nomes como prova de tela testada.

## Ferramentas incluídas

- \`node scripts/qa/audit-visual-evidence-v1.mjs\`: imprime agrupamentos de imagens idênticas e quantidades. Use \`--strict\` para falhar diante de duplicidades (o legado **é esperado falhar**).
- \`node qa-visual/motorista-smoke-v2.mjs\`: inspeciona rotas públicas do Motorista com URL efetiva, campos, conteúdo, erros JS e overflow, grava apenas screenshots que passarem; para rotas protegidas sem credenciais, **não cria screenshots indevidamente identificados**.
- \`APOIS_MOTORISTA_BASE_URL=http://127.0.0.1:4202\` aponta para servidor de homologação standalone. \`APOIS_MOTORISTA_ROUTE_MODE=hash\` apenas se servir bundle do Parceiro com hash history.

**NÃO executar com credenciais reais nem considerar isto teste autenticado.** O histórico D-004/D-005 permanece pendente de reteste no bundle efetivo; o login de administrador precisa de testes separados e sessão sintética. Capturas antigas permanecem preservadas e etiquetadas como insuficientes.
