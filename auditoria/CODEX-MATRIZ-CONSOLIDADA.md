# APOIS — Matriz consolidada dos achados Codex (08/11/2026)

**Origem:** RELATORIO-ACHADOS-APOIS-20261108(1).md, 20 achados (INV-001 a INV-020).
**Base antes desta execução:** branch audit/continuacao-20261107, commit c2c7864d6ef696d88c02ae2a7cffbcfb0a7eb431.
**Escopo de alterações:** exclusivamente apoistecnologia-gif/apois-superapp, branch citada; submódulos fixados e bases de produção preservados.
**Regra de evidência:** tests isolados com doubles de banco/rede não são teste autenticado nem homologação Android.

### Legenda de estados
A = já corrigido e validado; B = corrigido no código, aguardando teste integrado; C = parcialmente corrigido; D = defeito confirmado e não corrigido; E = suspeita/impacto ainda não comprovado no produto final; F = falso positivo/desatualizado; G = bloqueado por dependência externa, produção ou homologação.

| ID | Produto / gravidade | Evidência original e conferência nesta etapa | Estado | Ajuste, commit e validação | Falta |
|---|---|---|---|---|---|
| INV-001 | Cliente Entregas / P2 | Fonte pinada: customer-support/index.ts:69 limita lista a 50; chamado/$ticketId.tsx:89–105 localiza ID somente na lista | D | Nenhum deploy nem patch; fonte pinada consultada ao vivo no GitHub | Endpoint de detalhe autorizado e paginação; comparar Edge Function implantada; teste 51+ usuários A/B |
| INV-002 | Passageiro Corridas, Motorista e Admin / P1 | Handlers de detail/refreshCase do gerador aceitavam resposta A tardia após seleção B | B | Sequência + identidade + guarda pós-signed URL; commits 12d23fa, be959e4; dois testes isolados A lento/B rápido aprovados | Build, polling real, mudança durante URL assinada, desmontagem e login |
| INV-003 | Ocorrências Corridas / P1 | draft/arquivos/nota de um protocolo podiam atravessar troca | B | Rascunhos por ID no Workroom e no Center; arquivo de novo caso separado; commits 12d23fa, be959e4 | UI e envio reais staff/motorista/passageiro; preservar nota interna |
| INV-004 | Ocorrências Corridas / P1 | Após sucesso de arquivo 1 e falha de 2, retry criava novo caminho para arquivo 1 | B | Caminhos estáveis SHA-256 por arquivo/caso/usuário, conferência do registro e confirmação item a item; commits c944c53, e51db9a; testes isolados de retry aprovados em ambos | RLS autenticada, Android, duplo clique e recuperação com novo File; fallback sem subtle não é persistente entre reinícios |
| INV-005 | Ocorrências Corridas / P2 | Upload seguido de erro RPC deixava objeto sem registro confirmado | C | Reconsulta por object_path; retry recupera tentativa sem duplicar registro; commits c944c53, e51db9a; simulação de resposta perdida e falha de indexação aprovada | Inventário/retensão de objetos órfãos históricos e recuperação sem reanexar; nenhuma remoção destrutiva |
| INV-006 | Passageiro Corridas / P1 | Botão branco sobre rodapé claro no gerador e APK anterior | B | text #991B1B em fundo #FFF1F2; contraste nominal calculado 7,56:1; commit 6245f39 | Contraste computado em aparelho, fontes grandes, larguras 320/360/390/412 |
| INV-007 | Histórico Corridas / P1 | Hardener inseria Link em placeholder removido pela restauração anterior | B | Link inserido por âncora da navegação atual com pré/pós-condição; commit ea0cf42; gerador executado 2x em fixture sem duplicação | Testar navegação e voltar no Android sem corrida ativa |
| INV-008 | Build Estabelecimento / P1 | Argumentos de Git expunham Basic auth reversível nos logs | B | Logs omitem valores e credencial vai via GIT_CONFIG_* env; commit 2522228; função real de log testada com credencial sintética sem vazamento | Build completo em ambiente isolado e revisão de logs históricos se houver indício |
| INV-009 | Financeiro Entregas / P0 | Catálogo PROD reconfirmado: SECURITY DEFINER, EXECUTE anon/authenticated, sem autorização do chamador no corpo; dois wrappers internos identificados com mesmo owner | G | Migration de ACL restritiva PREPARADA, NÃO APLICADA: commit 2918f18 | URGENTE: testar wrappers/ACL/pagamento direto e obter autorização específica antes do rollout. Exposição real ainda existe em PROD |
| INV-010 | Financeiro / P1 condicional | Gate Safe2Pay do relatório falhou 5/6; não repetido neste checkout | G | Sem ativar provider ou pagamentos reais | Validar necessidade comercial de Pix eletrônico; E2E isolado de webhook, reservas, conciliação e estornos |
| INV-011 | Qualidade / P2 | Verificador verificava só a presença de textos/rotas | C | Verificador final ampliado para link, contraste, guards e uploads, commit 37c769e; fixtures de scripts adicionadas em 183ca70 | Cobertura comportamental automatizada completa, TypeScript e E2E |
| INV-012 | Pipeline Entregas / P2 | build-merchant-panel.mjs ainda permite install --no-save após falha frozen e lint não bloqueante | D | Código confirmado, política de fixture não alterada para não quebrar entregas | Política distinta para release rígido e fixture, lock/gerenciador alinhados e teste determinista |
| INV-013 | Cliente Entregas / P2 | src/routes/pedidos.tsx pinado consulta lista sem range; truncamento efetivo não medido | E | Fonte consultada; sem correção ainda | Teste com massa acima do limite, paginação por cursor e realtime sem duplicação |
| INV-014 | Cliente Entregas / P2 | Avatar em caminho fixo, cacheControl 3600; versão local só no editor no snapshot | E | Evidência no código pinado; sem reprodução em dispositivo | Cache em duas telas/sessões, versionamento e políticas Storage |
| INV-015 | Estabelecimento / P2 | MerchantProductEditor.tsx cria objeto antes de atualizar produto, sem reconciliação de falha | E | Fonte pinada conferida; transformação final ainda não verificada | Confirmar handler final, RLS DELETE, retenção e simular resposta perdida |
| INV-016 | Workroom Motorista/Admin / P2 | Falha de URL assinada produzia âncora sem href | B | Renderização condicional com aviso e tentativa de nova carga; commit 12d23fa | Android/URL expirada/permissão/reabertura de arquivo privado |
| INV-017 | Auth nos dois Supabase / P2 | Advisors anteriores sinalizaram proteção de senha vazada desativada; não implica vazamento | G | Sem mudar settings de produção | Verificar disponibilidade/plano, homologar senha e Google/recuperação |
| INV-018 | Funções e RLS / P2 | Advisors relatam contagens de funções expostas, não 204 vulnerabilidades confirmadas | E | Triagem iniciada apenas em INV-009 | Revisar ACL, owner, chamadores e guarda função por função |
| INV-019 | Publicação Vercel / P1 QA | Relatório aponta diferença histórica de alias vs preview, sem reconsulta atual | E | Sem deploy, promoção ou alteração de alias | Identificar SHA, produto, preview e URL no próximo QA |
| INV-020 | Entregas financeiro / P2 | Literal com mojibake reconfirmado na função REAL de liquidação | D | Sem modificar função/data de produção | Corrigir fonte canônica, versionar em staging e tratar histórico separadamente |

### Resultado da triagem
- A: 0; B: 7; C: 2; D: 3; E: 5; F: 0; G: 3. Total: 20.
- Corrigidos no código mas sem homologação: INV-002, 003, 004, 006, 007, 008, 016.
- Parciais: INV-005 e INV-011.
- Nenhum novo falso positivo foi provado nesta etapa; o relatório não foi tratado como verdade automática.
- Nenhum achado recebeu categoria A, pois não houve E2E autenticado nem build integral do novo commit.
- INV-009 é bloqueio de produção mesmo que haja migration preparada; código versionado NÃO equivale a ACL aplicada.

### Preservação
- Não houve merge na main, deploy, geração de APK, pagamento real, escrita/DDL em Supabase de produção nem atualização dos submódulos de origem.
- Não revertidas as correções anteriores registradas em auditoria/FASE-2-CORRECOES-E-BLOQUEIOS-20261108.md e auditoria/FASE-3-CORRECOES-MOTORISTA-20261108.md.
- Sempre conferir SHA integrador, pins e pipeline .work antes de retomar.
