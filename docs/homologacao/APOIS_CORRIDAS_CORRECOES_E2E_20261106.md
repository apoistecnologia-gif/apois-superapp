# APOIS CORRIDAS — CORRECOES DE HOMOLOGACAO E2E (06/11/2026)

## Escopo e isolamento
- Repositorio de integracao: `apoistecnologia-gif/apois-superapp`
- Branch: `fix/apois-corridas-e2e-homologacao-20261106`
- Snapshots pinados: Passageiro `7b047f75a1a919a5336c0df6e0d60b14b02f2618`, Motorista/Admin `9fc171050d8b5703540c49d19a8f1e9f5162775f`
- Nenhuma modificacao no APOIS ENTREGAS. Nenhuma escrita no Supabase producao.
- Nenhum APK, AAB, pacote Android, Web bundle ou deploy foi executado.
- Regras de pagamento: dinheiro e cartao na maquininha diretamente ao motorista, 100% do valor; APOIS sem taxa por corrida. Mensalidade nao alterada.

## Correcoes registradas no codigo-fonte (nao validadas em aparelho)
| ID | Sintoma | Codigo alterado | Situacao |
|---|---|---|---|
| PA-01 | 21,06 vs 21,35 | `supabase/functions/request-ride/index.ts` e `fix-apois-corridas-fare-consent-e2e-v1.mjs`; cotacao enviada em centavos, divergencia devolve novo valor ANTES de inserir corrida, exigindo segundo toque | Implementado em codigo; Edge NAO implantada; nao vale para clientes antigos sem quote |
| PA-02 | Preco invisivel na revisao | `fix-apois-corridas-passenger-e2e-v1.mjs`; estimativa destacada junto ao CTA, novo valor de servidor exibido | Implementado, sem teste fisico |
| PA-03 | CTA sob barra Android | `fix-apois-corridas-passenger-e2e-v1.mjs`; altura da viewport e padding safe-area | Implementado, sem teste fisico |
| PA-04 | Foto motorista quebrada | Mesmo patch; `onError` + fallback seguro | Implementado, sem teste fisico |
| PA-05 | Nota 5,0 inventada | Mesmo patch; mostra media real ou `Novo` | Implementado, sem teste fisico |
| PA-06 | Conteudo sob comandos fixos | Mesmo patch; rolagem e reserva inferior | Implementado, sem teste fisico |
| PA-07 | Cartao direto nao explicado | Mesmo patch; aviso de pagamento direto ao motorista | Implementado, sem teste fisico |
| PA-08 | Passageiro nao avalia apos finalizar | Mesmo patch; formulario 1-5 estrelas via RPC `rate_passenger_ride`, nao auto-retorna antes de avaliar/pular | Implementado; RPC real confirmada somente por leitura |
| PA-09 | Motorista encerra antecipado, passageiro recebe mensagem generica | Texto Motorista deixa de afirmar chegada ao destino; Passageiro informa possibilidade de contestar | Parcial: NAO ha classificacao/auditoria server-side de encerramento antecipado |
| PA-10 | ETA do destino durante viagem | Sem fonte confiavel de ETA dinamico validada | Pendente de projeto + teste com deslocamento |
| PA-11 | Mapa branco transitorio | Sem reproducao tecnica conclusiva | Nao reproduzido; pendente teste Android |
| PA-12 | Nome do passageiro generico | `fix-apois-corridas-driver-e2e-v1.mjs` e `supabase/corridas-forward-migrations/20261029_driver_assigned_passenger_profile_readonly.sql` (dominio/offer/assigned) | Codigo pronto; migration NAO aplicada |
| PA-13 | Rota/ETA antigos no retorno Motorista | Guard de polyline so com corrida ativa; limpar indicadores na chegada/fim; nao desenhar linha reta como rota rodoviaria quando Routes falha | Implementado, sem teste fisico |

## Contratos adicionais e limites
- Rejeicao/cancelamento Motorista trocados de Edge Functions ausentes por RPCs `driver_reject_ride` e `driver_cancel_ride` existentes e autenticadas; **redispatch imediato apos rejeicao/cancelamento ainda NAO comprovado** e deve ser testado/garantido no backend antes do go-live.
- Driver profile RPC `apois_driver_assigned_passenger` depende da migration preparada. Nao liberar acesso global de `public.users` como solucao.
- `request-ride` mantem compatibilidade com clientes antigos sem `expected_price_cents` para nao interromper APKs ja instalados; **nao faz enforcement universal ate rollout coordenado**.
- Contrato de inicio com PIN/aceite/settlement preservados. Nao houve mudanca de tarifas nem de destinatario do pagamento.
- A inspecao obrigatoria de 13 fotos do veiculo continua com bloqueio de lancamento e gates Stage-1/Stage-2 existentes, sem aplicacao nao autorizada.
- Permanecem para homologacao: GPS em background, push em app fechado, cancelamento+redispatch E2E, auth/OTP, SOS, financeiro, mensalidade, RLS e comparacao APK-commit.

## Arquivos de integracao/QA adicionados
- `scripts/fix-apois-corridas-passenger-e2e-v1.mjs`
- `scripts/fix-apois-corridas-driver-e2e-v1.mjs`
- `scripts/fix-apois-corridas-fare-consent-e2e-v1.mjs`
- `scripts/verify-apois-corridas-e2e-v1.mjs`
- `scripts/qa/test-apois-corridas-fare-consent-e2e-v1.mjs`
- `scripts/qa/test-apois-driver-passenger-identity-e2e-v1.mjs`

## Evidencias realmente obtidas
- Leitura do codigo fonte pinado e sequencia dos hardeners.
- Analise visual das duas gravacoes anteriores.
- Consulta SUPABASE SOMENTE SELECT para identificar RPCs `rate_passenger_ride`, `driver_reject_ride`, `driver_cancel_ride`, `mobility_user_id` e seus privilegios.
- Checagem de sintaxe JavaScript dos novos scripts de transformacao (com parser JS) e testes simulados de aplicacao sobre snapshots/superficies sinteticas com guardas.
- Verificacao estatico-textual do guard server-side de tarifa ANTES de inserir corrida; validacao de source-lock e invocacoes dos scripts nas trilhas de integracao.
- **Nao houve** `tsc`, lint de projeto, instalacao de dependencias, suite E2E, build web/Android, captura de APK novo, testes no dispositivo nem deploy. Nao afirmar que tais testes passaram.

## Proximas validacoes necessarias antes de merge/go-live
1. Testes de transformacao na `.work` real e `tsc --noEmit`, testes unitarios de quote e de estados, sem gerar aplicativo.
2. Testar em staging a diferenca entre valor exposto e calculado (mudanca de tarifa) e idempotencia de `request_key`; rodar sem cobranca real.
3. Em staging aplicar e testar migration de leitura limitada do passageiro e verificar RLS.
4. Revisar backend da finalizacao antecipada com sinalizacao auditavel e proibir classificacao falsa de chegada.
5. Homologar redispatch, recusa, cancelamento, cronometro, voz, GPS, push, PIN e pagamentos diretos com contas QA.
6. Somente depois solicitar liberacao da proxima geracao de APKs, sem compilacao nesta entrega.

## Estado
CORRECOES DE FONTE PARCIALMENTE IMPLEMENTADAS, NAO HOMOLOGADAS FISICAMENTE. **NAO APROVADO PARA PRODUCAO**.
