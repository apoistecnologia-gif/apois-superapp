# APOIS — Revisão visual e funcional estática de homologação — 30/10/2026

## Escopo e limites de evidência
Arquitetura: 2 APKs (Cliente e Parceiro), quatro módulos (Cliente Corridas, Cliente Entregas, Motorista, Entregador), painéis Estabelecimento Entregas, Admin Entregas e Admin Corridas.

Fontes: inspeção do código nos snapshots fixados pelo `.apois/source-lock.json`, scripts de consolidação na branch `fix/entregas-homologacao-ajustes-20261030`, logs reais do GitHub Actions e capturas Android apresentadas pelo proprietário em 30/10. **Nenhuma captura nova foi obtida da versão final deste commit.** Portanto os itens de aparência são auditoria estática ou problemas históricos pendentes de nova captura, não homologação visual renderizada.

## Matriz por superfície

| Superfície | Build WEB | Evidência e visual | Risco/pendência |
| --- | --- | --- | --- |
| Cliente Corridas | Aprovado na execução 41140015095 | Estilo de mapa do Passageiro como referência; versão de GPS/cidade correta foi preparada | Testar localização real fora de Petrolina, câmera, destino, ETA, erro de permissão |
| Cliente Entregas | Aprovado na execução 41140015095 | Checkout e pedidos preservados; ajustes de atualização do status do pedido foram versionados | Revalidar status final após PIN com Cliente aberto/segundo plano; mapas Google indisponíveis enquanto pendência de cobrança |
| Parceiro Motorista | Módulo WEB compilou no preflight 41140015095, aprovação global ainda bloqueada por auditoria final | Script usa paleta clara no Google Maps, preserva rotas, GPS e voz; cadastro/perfil com contraste atualizado | Precisão GPS, mapa rural, toque de nova corrida, navegação, assinatura e fluxo de PIN exigem teste físico |
| Parceiro Entregador | Módulo WEB compilou no preflight 41140015095, aprovação global ainda bloqueada por auditoria final | `ActiveDelivery` simplificado: aceite, retirada, rota/cliente e PIN; perfil branco com edição; mapa compacto; trocas de papel preservadas | Confirmar telas renderizadas, área segura Android, estados offline/reconexão, upload de avatar (policy não aplicada), ETA |
| Estabelecimento | Aprovado na execução 41140015095 | Controle de pedidos branco/vermelho atualizado com safe-area; ação de solicitar entregador preservada | Validação visual no celular, teclado, cards abertos e sobreposições |
| Admin Entregas | Empacotado no WEB de Estabelecimento; sem teste manual de login/roles | `WorkspaceShell.tsx` de origem ainda apresenta `bg-black/bg-zinc-950` e seleção antiga `bg-primary text-black` | Revisar visual por componente com captura desktop/móvel antes de mudar tema global |
| Admin Corridas | Faz parte da fonte Motorista/Admin, com rotas existentes | Dashboard e Mapa ao Vivo exibem APOIS em títulos; código ainda tem nomes internos MOVVI | Inspeção visual real da sidebar, mapa, filtros, tabelas, RBAC e erros |

## Critérios não comprovados
1. Capturas renderizadas recentes de login, home, mapa, pedidos, histórico, perfil, erro/empty/loading para as quatro áreas.
2. Responsividade e safe-area em Android reais com teclado aberto e gestos.
3. Pedido teste integral pós-patch: Cliente → Estabelecimento → Entregador → retirada → PIN → pedido entregue no Cliente.
4. Reabertura de app, localização background, push, suspensão e reconexão; dependem de Android real e API Maps.
5. Avatar, RLS e Storage individuais: policy versionada **não executada** em produção.
6. Cobranças/finanças: nenhuma operação real autorizada; não inferir ganho do entregador com base em pedido fictício R$ 0,00.

## Regras de preservação
- Não mexer em APIs, pagamentos, Safe2Pay, Supabase, banco, autenticação, regras de cobertura, emissão de PIN ou corridas.
- No Entregador, os estados intermediários obrigatórios continuam no backend; simplificação é apenas de ações visíveis.
- Nunca mascarar erro de CI ou substituir verificação por skip. A última falha de auditoria antes do commit `821419b570a7` foi teste de estilo de mapa desatualizado; ajustado para exigir exatamente o estilo claro atual.
- Novo teste WEB em execução: https://github.com/apoistecnologia-gif/apois-superapp/actions/runs/41140195643 . **Não marcar aprovado até conclusão**.
