# Lançamento previsto — 15/12/2026 (premissa a confirmar)
Prioridade: operação estável dos aplicativos oficiais. Prazo não é autorização de merge, deploy, custo ou ativação. O lançamento comercial e a aprovação da navegação offline são decisões distintas. Preserve Google Maps/Waze e contratos atuais; não condicione o lançamento à conclusão do laboratório.

## Gates de navegação própria
- V4.1: deslocamento, voz, desvio e chegada aprovados pelo testador; V4.2: busca e início de rota observados. Não é validação de aplicativo oficial.
- Nordeste: 15/15 no servidor 3.6.3; grafo 877.875.200 bytes, mapa 701.367.899 bytes, mesma origem OSM. Run 45747081206 não executou rotas Android (transferência falhou); run 45748051122 falhou no download Geofabrik. Exigir snapshot idêntico, não substituir silenciosamente.
- Até a primeira semana de dezembro: alvo interno, não promessa: validar grafo em Android, capacidade/consumo, integridade dos pacotes, estratégia de entrega e cobertura inicial Vale PE/BA. Priorizar artefato menor na área operacional antes de expansão geral. Sem download público sem autorização.
- Antes de 10/12: alvo interno: build isolado do host real somente se procedência OSM/GPS independente, autoridade de corrida, revogação, lifecycle, ABI/API24 e fallback forem preservados. Teste de dispositivo e licenças obrigatórios. Aprovado em CI não equivale a pronto para produção.
- 10–14/12: janela sugerida de congelamento/QA. Rejeitar regressões de login, cadastro, corridas/entregas, pagamentos, GPS, cancelamento, PIN, finalização e navegação externa. Não migrar configuração existente.
- 15/12: decisão explícita de lançamento. Navegação própria fica desativada se algum gate não tiver evidência e autorização. Não inferir que o superapp comercial já está pronto com base no laboratório.

## Bloqueios
Não há distribuição permanente do mapa/grafo, catálogo completo Nordeste, prova de desempenho ARM64 integral ou integração oficial homologada. A autorização de produção e custos continua separada. Não substituir métricas de cobrança por cálculo local não confiável. O modo offline não dá autoridade para aceitar/concluir corrida sem confirmação do backend.
