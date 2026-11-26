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
