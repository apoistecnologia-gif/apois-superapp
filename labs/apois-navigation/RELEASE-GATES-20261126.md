# Gate de lançamento — APOIS Navegação, 26/11/2026

Meta de lançamento informada: 15/12/2026. A branch de laboratório não constitui autorização de produção. Não há estimativa percentual de conclusão.

## Evidência confirmada antes desta rodada
- 45784332748: ciclo completo da Activity confirmada, emulador, autoridade e GPS sintéticos, retorno e revogação.
- 45784332776: motor Vale com autoridade simulada no Android.
- 45784332884: Vale PE/BA offline e compatibilidade com host Capacitor descartável.
- 45784332809: APK isolado passageiro; preço e criação fictícios.
- 45784332664: armazenamento imutável e assinatura em JVM (antes do piso persistente).
- 45784332980: regressão de verificações de permissões de APK.
- 45784332769: grafo Nordeste compatibilidade Android, não distribuição definitiva.
- 45752277919 e 45752277901: contrato PostgreSQL descartável e broker de autoridade. Sessões/identidades sintéticas.
- 45784332837: dois testes instrumentados passaram; workflow falhou no filtro de resumo antigo. Correção requer novo run.
- 45784332943: geração do APK físico GPS isolado falhou na adaptação de callback duplicado. Correção requer novo run.

## Ordem de bloqueios restantes
| Gate | Evidência necessária | Estado |
|---|---|---|
| Regressões desta rodada | CI verde, inclusive os dois workflows corrigidos | Pendente |
| Pacote físico Vale | mapas, rotas e hashes dentro do APK; render e áudio em telefone ARM64 | Pendente |
| Passageiro oficial | fluxo original preservado, catálogo independente, recuperação de solicitação e geolocalização integrados | Pendente |
| Motorista oficial | sessão autenticada, GPS original, retorno, voz única, PIN/finalização no host | Pendente |
| Autoridade e preço | endpoint privado controlado, política Auth real, métricas de preço server-side independentes, revogação e testes de concorrência | Pendente |
| Distribuição | chave oficial sob controle autorizado, manifesto autenticado, rotação, recuperação, disponibilidade e licenças ODbL/transitivas | Pendente |
| Operação | testes físicos em Petrolina/Juazeiro, perda de sinal, bateria, fallback explícito, monitoramento, rollback de ativação | Pendente |

O piso persistente experimental nesta rodada não equivale a proteção de produção: não houve teste de perda de energia, restauração completa ou API 25. A retenção de mapas e catálogo no CI até 26/12 é temporária; o artefato anterior de replay vence em 02/12, com novo workflow de preservação pendente. Não ativar flags nem fazer deploy enquanto os gates não forem comprovados. Nenhuma cobrança, alteração de produção, chave oficial ou leitura de dados pessoais nesta rodada. Não afirmar que APK isolado é APK oficial.

## Atualização de evidência desta rodada
45787969502 armazenamento/piso persistente JVM, 45787969561 auditoria integral, 45787969361 regressão de permissões/resultados e 45787969611 retenção de replay passaram. Replay preservado até 26/12. Build privado passageiro permanece sem evidência por falha sem logs; acesso de leitura ao repositório está disponível. Novo ensaio WebView isolado e compilação conjunta QA290 nativa com Vale estão preparados, mas CI ainda não validado. Não houve deploy, credenciais ou alteração de app oficial.

## Rodada de continuidade — 26/11/2026
Base: a913ad1c0fceeee941e390b56791fba63b298600. Branch experimental, sem merge/deploy/flags. A rodada reúne correções funcionais, testes, CI e dois registros operacionais (distribuição e este gate).

- Dez runs de entrada: 45788829509, 45788829448, 45788829520, 45788829574, 45788829643, 45788829902, 45788829493, 45788829437 e 45788829519 aprovados. 45788829575 falhou na avaliação inicial da WebView. 45789725166 aprovou após proteção do body; dois runs posteriores falharam no checkpoint de recuperação após encerramento forçado. O servidor sintético passou a usar persistência estrita e serialização de transação, com contagem exata. 45790688633 e 45790765805 aprovados; não é evidência de servidor real.
- APK isolado passageiro: artifact 15103475133 do run 45790765805. APK GPS isolado anterior: 15102406122 do run 45788829902. Ambos expiram 26/12. Não são APKs oficiais nem testes em telefone físico.
- Contrato v21: 45790290290 falhou na verificação de trechos fixados; atualização da verificação e rechecagem da sessão aprovaram 45790534199. Validações adicionais do contrato passaram em 45790940983. Broker com sessão vigente: 45790765775 aprovado. Produção consultada apenas por metadados: request-ride v21 presente; RPCs e endpoints experimentais não implantados. Política real de expiração/inatividade/sessão única e concorrência de revogação ainda exigem ambiente controlado.
- Passageiro privado: e294a96e25f468c4a4202a3bd83db7d549ccf369 tem 25 commits à frente e 418 atrás de b6b87f02066ef62a8d201ef63a3152bb2364f5cd. Runs 45706970616 e 45706970415 reexecutados; falham antes de receber runner, sem steps; logs BlobNotFound. Check-run contém anotação, mas consulta do conteúdo não permitida pelo conector. Não inferir billing ou erro de compilação. Nenhum gitlink, código privado ou configuração oficial modificado.
- PMTiles verificado por bloco, manifesto determinístico, fila de tiles e render Chromium: 45791143617, 45791143645, 45791310262 e 45791310412 aprovados. Mudanças posteriores de snapshot, coalescimento e ciclo de vida MapLibre aguardam novo resultado de CI. Distribuição durável não publicada; ver map-delivery/README.md.
- Motorista: nova tentativa explícita apenas para preparação local fracassada (uma repetição, 30 s, prova atual, sem reabertura de etapa preparada); cálculo local sem concorrência; rechecagem de conectividade no recálculo; prova nativa vinculada à identidade do registro GPS; evitar IO de pacote para host inativo. A auditoria de escopo 45791820449 passou. Runs Android 45791820480, 45791820495, 45791820430, 45791820504, 45791820519, 45791820500 e 45791820514 ainda em execução no momento deste registro. Cancelamentos de CI anterior substituídos por commits novos não equivalem a aprovação.

**Gate de lançamento continua fechado:** integração dos dois apps oficiais, Auth e autoridade reais, preço server-side, prova de origem das coordenadas, distribuição assinada e persistente, teste físico ARM64 com GPS/voz/bateria/PIN/retorno/cancelamento, e verificação final de segurança. Recuperação do motorista após etapa já preparada continua limitada pelo orçamento de uma abertura até estratégia de reentrada com orçamento compartilhado. Nenhuma alteração operacional ou produção autorizada.
