# Edge Functions — source of truth, cópias e pipeline

Revisão: 2026-09-13.

Este documento governa **proveniência e deploy** das Edge Functions do APOIS Superapp. Ele não altera comportamento de função, regra financeira, segredo, configuração de provedor ou schema.

## Evidência no HEAD

A premissa da auditoria foi confirmada: existem múltiplas árvores `supabase/functions` com slugs iguais e conteúdo diferente. Isso não significa que todas devam ser sincronizadas. Há três situações distintas:

1. **projetos Supabase diferentes**: um slug igual em Entregas e Corridas é um homônimo de outro domínio e não deve ser sincronizado por nome;
2. **release overlay**: `supabase/functions` na raiz do Superapp contém a política de release, inclusive stubs `410` de provedores retirados; ele é intencionalmente diferente das fontes históricas/upstream;
3. **mesmo projeto Corridas**: os dois submódulos Corridas apontam para `vqtucstyduxrqjgyigfk` e possuem 11 unidades lógicas sobrepostas no HEAD. Esse é o caso perigoso: não é permitido escolher a cópia pelo diretório em que o comando foi executado.

As 11 sobreposições Corridas atualmente classificadas estão em `docs/edge-function-source-of-truth.json`. O verificador falha se surgir uma nova sobreposição do mesmo projeto sem classificação.

## Fontes canônicas

A fonte canônica é **por domínio/slug**, não “qualquer pasta `supabase/functions`”.

| Escopo | Fonte | Regra |
| --- | --- | --- |
| Entregas upstream | `sources/apois-entregas/supabase/functions` | Fonte upstream do projeto `sbvhdgyuuperszlsllji`, salvo slug explicitamente supersedido pelo release overlay. |
| Corridas passageiro-only | `sources/apois-corridas-passageiro/supabase/functions` | Canônica para slugs que só existem no backend do passageiro, como `request-ride`, `delete-my-account` e `admin-actions`. |
| Corridas compartilhado/driver | `sources/apois-corridas-motorista-admin/supabase/functions` | Canônica para slugs Corridas compartilhados que também existem no snapshot passageiro, como `send-ride-push`. |
| Release atual | `supabase/functions` | Overlay de release. É canônico para os slugs explicitamente classificados/selecionados nessa camada, especialmente endpoints de provedor retirados e fail-closed. Não é uma árvore de “deploy all”. |

### Funções destacadas pela auditoria

- `mercadopago-webhook`: **release overlay** na release atual; cópias históricas/upstream não substituem o stub fail-closed.
- `request-driver-payout`: **release overlay** na release atual.
- `create-cancellation-fee-charge`: **release overlay** na release atual.
- `send-ride-push`: **Corridas motorista/admin** para o backend compartilhado; a cópia do passageiro é snapshot protegido.
- `dispatch-push-outbox`: **release overlay** para a release atual de Entregas.
- `delete-my-account`: **Corridas passageiro**.
- `admin-actions`: **Corridas passageiro**.
- `request-ride`: **Corridas passageiro**; o build do Superapp troca a invocação do passageiro para esse roteador.
- `_shared/cors.ts`: não existe um CORS global canônico. O helper pertence à árvore da função que o importa. Para o backend Corridas compartilhado, a autoridade é a árvore motorista/admin; outras árvores podem divergir intencionalmente.

O arquivo JSON é a fonte legível por máquina para owner, finalidade, pipeline e relação de cada cópia perigosa.

## O que builda e o que faz deploy

`prepare-workspace.mjs` copia os submódulos pinados para `.work/*`. Os builds e hardeners operam nessas cópias. Isso **não é deploy de Edge Function**. O pipeline do Superapp/Codemagic inspecionado não contém um `supabase functions deploy` automático.

O repositório passageiro conserva um runbook histórico que manda executar `supabase functions deploy`; por causa das cópias divergentes do mesmo projeto, essa forma não qualificada não é mais uma fonte segura de release. Para Corridas, o deploy deve ser **por slug explícito** a partir da fonte declarada no manifesto. Para o release overlay, vale a mesma regra: nunca executar deploy-all da árvore mista.

`.work/*/supabase/functions` é derivado. Imediatamente após `prepare:modules` e antes dos hardeners, deve ser byte-equivalente à fonte pinada, desconsiderando CRLF/LF. O CI verifica essa paridade. Hardening posterior pode alterar a cópia de trabalho; isso não promove `.work` a source of truth.

## Verificação automática

Execute:

```bash
npm run verify:edge-function-source-of-truth
npm run prepare:modules
npm run verify:edge-function-source-of-truth -- --check-generated
```

O verificador falha quando:

- uma raiz declarada ou canonical assignment some;
- uma nova cópia do **mesmo projeto Supabase** surge sem política explícita;
- uma relação `must-match` diverge;
- uma cópia `.work` que deve ser idêntica logo após `prepare:modules` diverge;
- owner, finalidade ou pipeline ficam sem documentação.

A checagem também entra em `audit:release-integrity` e em GitHub Actions.

## Regra de mudança

Ao alterar uma Edge Function:

1. identifique `projectRef` e canonical assignment antes de editar;
2. não copie implementação somente porque o slug é igual;
3. se o slug existe em duas fontes do mesmo projeto, atualize primeiro a política de ownership ou prove que a relação é `must-match`;
4. não transforme snapshot/legado em fonte de deploy por conveniência;
5. funções financeiras/provedor retiradas continuam obedecendo `docs/edge-function-release-classification.json` e `docs/legacy-provider-runtime-state.json`;
6. mudança de ownership não autoriza mudança financeira.

Snapshots e implementações históricas permanecem preservados; esta tarefa não apaga nenhuma cópia.
