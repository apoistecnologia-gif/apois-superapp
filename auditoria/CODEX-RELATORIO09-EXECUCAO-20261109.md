# APOIS — Relatório 09 | Estimativa de preço, consistência e confirmação

**Execução:** 09/11/2026. **Entrada:** `RELATORIO-09-APOIS-ESTIMATIVA-E-CONFIRMACAO-20261108.md` (08/11/2026).  
**Escopo:** somente `apoistecnologia-gif/apois-superapp`, branch `audit/continuacao-20261107`.  
**Fonte Passageiro read-only:** `apoistecnologia-gif/say-hello-buddy-23-84b5dcbf@7b047f75a1a919a5336c0df6e0d60b14b02f2618`.

## 1. Integridade do ponto de retomada

Conferidos na branch, antes das correções:
- `.apois/source-lock.json`: Entregas `2f4606e0fb52dffb49f2e6aebbe921ce687ab625`; Passageiro `7b047f75a1a919a5336c0df6e0d60b14b02f2618`; Motorista/Admin `9fc171050d8b5703540c49d19a8f1e9f5162775f`.
- `auditoria/CODEX-RELATORIO08-EXECUCAO-20261109.md`: INV-057 B, 20 ensaios sintéticos, sem build/E2E.
- `auditoria/CODEX-MATRIZ-GERAL-51-ACHADOS-20261109.md`: 57 registros (A 0 / B 38 / C 15 / D 0 / E 1 / G 3). Nome histórico mantido.
- Relatório 09 confrontado com `use-pricing.tsx`, `use-route.tsx`, `use-checkout-preparation.tsx`, serviço de preços, Home, revisão, `use-ride-request.tsx` e scripts de montagem. O ramo de investigação `audit/ecossistema-20261107` citado pelo auditor **não** foi usado para gravações.

**Preservação:** o hardener de geração de rota do Relatório 08 e os anteriores continuam na sequência. Os arquivos de fontes fixadas, Supabase, regras financeiras, comercial, identidade visual e Entregas NÃO foram alterados.

## 2. Correções versionadas

### INV-058 — P2 — retry da mesma estimativa bloqueado

**Antes:** `lastRequestRef` era gravado antes de aguardar o backend e permanecia preenchido após erro. Nova tentativa idêntica retornava sem consultar o serviço.

**Depois:** `PricingProvider` da cópia integrada diferencia entrada atual, operação em andamento e resposta válida. A mesma solicitação em andamento é compartilhada, evitando duplicação. Falha deixa retry disponível; sucesso só é reutilizado se o resultado exibido corresponder à mesma entrada e a idade for inferior a 30 s. O TTL do `PricingService` original permanece intacto. `FareDetails` apresenta botão acessível **Tentar novamente** após falha. Não há retry automático infinito.

**Estado B:** correção versionada, sem homologação integral.

### INV-059 — P1 — resposta antiga sobrescrevendo preço da rota nova

**Antes:** A e B diferentes podiam correr em paralelo; resposta/erro de A concluído depois atualizava `estimates`, `status` e `error` mesmo após mudança da escolha.

**Depois:** a assinatura de requisição inclui origem, destino, paradas, distância, duração e categorias, derivada do snapshot de rota calculado. O resultado e o erro só podem ser aplicados se a assinatura ainda for atual e a tentativa ainda for a mais recente. Sucesso aplicado é marcado com a assinatura; a interface não expõe `estimate` ou `success` de outra entrada. `clear` ou rota incompatível invalidam imediatamente a seleção apresentada. Fluxo A→B→A protegido também contra cache de sucesso antigo mantendo a interface em loading.

**Estado B:** correção versionada, sem homologação integral. Não há tarifa criada no cliente ou alteração da função financeira.

### INV-060 — P1 condicional — confirmar com rota/preço retidos

**Antes:** `checkout.readiness` verificava a presença de rota e estimativa com status success, sem vínculo entre origem, destino, paradas e preço atuais. O hook de rota retém a rota anterior durante debounce. O auditor comprovou o snapshot permissivo, **não** um clique real incorreto.

**Depois:** `useRoute` fornece `isCurrent`, comparando destino, paradas ordenadas e origem atual com a rota aplicada; variação de GPS inferior a 85 m tem tolerância específica, sem mascarar mudança relevante. Uma falha de recálculo mantém um latch de bloqueio até novo sucesso; repetir o cálculo não libera a rota antiga durante loading. `usePricing` só oferece a estimativa vinculada a uma rota atual. `useCheckoutPreparation` mantém os gates anteriores e exige `routeIsCurrent` + `pricingIsCurrent`; Home valida readiness antes da navegação.

Na revisão, `handleConfirm` recupera primeiro corrida ativa, como antes, depois revalida readiness. `use-ride-request` faz uma **segunda conferência síncrona imediatamente antes do request-ride**, comparando o snapshot vivo com o snapshot iniciado (categoria, pagamento, origem, destino e paradas confirmadas); callbacks retidos que não correspondam ao estado atual são recusados. O envio único, `request_key`, recuperação de corrida já criada, dívida/carteira e cálculo server-side permanecem preservados. A revisão sinaliza carregamento/desatualização sem redesenho da tela.

**Estado B (implementação preventiva de risco fundamentado):** não houve reprodução do clique ponta a ponta no React nem solicitação real. Teste físico/React obrigatório antes de considerar fechamento de comportamento.

## 3. Arquivos alterados na branch

- **Novo:** `scripts/fix-report09-pricing-checkout-v1.mjs` — aplica correção à cópia isolada `.work/corridas` de sete arquivos de Passageiro: `src/hooks/use-route.tsx`, `src/hooks/use-pricing.tsx`, `src/hooks/use-checkout-preparation.tsx`, `src/components/pricing/FareDetails.tsx`, `src/routes/_authenticated.inicio.tsx`, `src/routes/_authenticated.revisar-solicitacao.tsx`, `src/hooks/rides/use-ride-request.tsx`.
- **Novo:** `scripts/qa/test-report09-pricing-checkout-v1.test.mjs` — suíte Node preparada com mock de serviço e extração do callback real materializado.
- **Modificado:** `scripts/build-isolated-module.mjs` — chamada ao gerador e à suíte Node **depois** dos hardeners e verificadores existentes de Corridas.
- **Documentação:** este relatório e acréscimo de INV-058 a INV-060 à matriz original.

`use-pricing.tsx` só é substituído na cópia de trabalho se o blob ainda coincidir com o SHA do pin `f941ac7431c53bf7d58cea636f354ee577cb97fd`. Os demais patches abortam quando faltam âncoras ou dependências; marcador evita reaplicação. Não há edição direta do snapshot ou integração paralela.

## 4. Evidência de validação realmente executada

**Execução isolada em JavaScript V8 (sem Node/React montados, sem rede):**

1. **21 verificações aprovadas:** seis conjuntos de substituições contra conteúdos reais do pin (com marcadores anteriores simulados para representar o pipeline), seis verificações de marcador/idempotência, extração do callback realmente versionado e oito verificações de concorrência/estados: primeira falha, retry idêntico, duplicação simultânea, conclusão conjunta, A lenta/B rápida, erro antigo após sucesso novo, clear durante cálculo e volta A→B→A.
2. **7/7 cenários do comparador de rota aprovados:** escolha atual, mudança de destino em debounce, alteração de parada, jitter pequeno de GPS, deslocamento relevante, latch após falha e status failed.
3. **7/7 snapshots de checkout aprovados:** caso válido, rota desatualizada, erro de rota, preço desatualizado, erro de preço, dívida e falta de pagamento.
4. Código do gerador inspecionado e sintaxe JavaScript avaliada no runtime V8. Os sete arquivos integrais transformados **não** foram compilados.

Essas verificações são sintéticas/isoladas e **não comprovam renderização, compilação, redes verdadeiras, Supabase ou Android**.

**Preparado mas NÃO EXECUTADO:** `node --test scripts/qa/test-report09-pricing-checkout-v1.test.mjs`, que exige `.work/corridas` materializada. Não houve `build-isolated-module`, instalação de dependências, `tsc`, lint, Vite/build, teste React com atraso controlado, teste Android, APK, chamada paga de mapas, corrida, cobrança, migração, webhook, push ou deploy.

## 5. Commits realizados na branch autorizada

- `020ee1263e45bbc9bb1b6a1dfbac1a543dae4617` — transformação inicial dos três achados.
- `7b76b40919fa4cb0cc75f0013e735b7d1e0a9f64` — correção da verificação Git blob no gerador.
- `28826544c04d4e6988c9487211095d353c06adcf` — ligação ao builder isolado de Corridas.
- `fab16c3c5c2d740dd5f7c8f762e981cc8c955de4` — ajuste do reuso de sucesso no ciclo A→B→A.
- `0e06cba9c8dd1a29929a2897d9bf59dd98c512dc` — inclusão da suíte Node de mocks.
- `198f65566c37bacab65cee71f46d1916b88fbb8b` — trava de recálculo anterior após falha até novo sucesso.
- `c9a1c3d9974e4ed4ca8a3400e3f05c14d38e7e86` — casos adicionais de rota e GPS na suíte.
- `4031e0da8dad3a3159e0ab7ace8b84825b29fb4c` — guardas atualizadas via `useLayoutEffect` e latch de erro migrado para estado React, evitando mutação de referências durante a renderização.
- `a6d62312001caf90bb03a85883c915bf98d7f734` — suíte de rota alinhada ao latch React; os sete cenários foram repetidos e aprovados no V8 isolado.

Todos no repositório integrador; `main` e repositórios-fonte protegidos não foram modificados.

## 6. Riscos, reversão e homologação pendente

- O raio de tolerância de GPS de 85 m é uma escolha de proteção contra jitter a testar em aparelhos e condições reais. Mudanças relevantes bloqueiam prontidão até nova rota.
- É necessário executar o builder para verificar a ordem **real** de todas as transformações, os testes Node e o typecheck; a validação em V8 testou conteúdo do pin e transformações relevantes simuladas, não um aplicativo montado.
- Validar em React com chamadas retardadas/fora de ordem, debounce, edição de paradas, categoria, erro, retry, início da revisão, navegação, solicitação já confirmada e recuperação. Verificar no backend de homologação sob autorização posterior.
- **INV-054 G, INV-055 C e INV-056 C continuam pendentes**; migração `20261109_report07_no_show_reason_code_QA_NOT_APPLIED.sql` continua **NÃO APLICADA**.
- Para reverter: reverter os commits do Relatório 09 na branch de auditoria, removendo gerador/teste/chamada. Não há rollback de banco ou serviço externo porque nenhum foi alterado.

**Total após este relatório:** 60 achados — **A 0 / B 41 / C 15 / D 0 / E 1 / G 3**. Os três novos são B por código versionado sem homologação. Os 57 históricos não foram reclassificados.

**Bloqueio permanece:** NÃO gerar APK, NÃO iniciar homologação física, NÃO implantar, NÃO executar `QA_NOT_APPLIED`, NÃO fazer merge até autorização explícita: **ACABOU OS RELATÓRIOS. AGORA VAMOS PARA A HOMOLOGAÇÃO FINAL.**
