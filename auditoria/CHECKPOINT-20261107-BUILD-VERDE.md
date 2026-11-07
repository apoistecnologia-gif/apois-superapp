# APOIS — Auditoria · Checkpoint 07/11/2026 (build de Entregas fechado)

**Branch:** `audit/continuacao-20261107`
**Estado:** pipeline de Entregas **100% verde**, os **4 modos compilam**, **101 testes passam**. Nada foi mesclado, publicado ou promovido.

---

## 1. O bloqueio que você autorizou corrigir — resolvido

`harden-entregas-customer-address-uf-v9.mjs` foi **reescrito por contrato**, não por marcador. Em vez de procurar texto e falhar, ele agora:

1. **Remove declarações `useRef` duplicadas** antes de começar (o pipeline, rodado duas vezes no mesmo workspace, duplicava `confirmedUfRef` e `cepRequestRef`).
2. **Aplica as substituições** tolerando que o snapshot tenha evoluído por V10–V13.
3. **Verifica o contrato executando o código**, não lendo strings:
   - carrega `src/lib/brazil-uf.ts` de verdade e normaliza 12 entradas (`Pernambuco→PE`, `São Paulo→SP`, `Ceará→CE`, `MG→MG`) e rejeita 5 inválidas (`XX`, `""`, `null`, `Pernambucoo`, `123`);
   - exige `normalizeBrazilUF(` no caminho do GPS, no ViaCEP, na validação e no salvamento;
   - exige lógica de "campo que veio vazio" preservando coordenadas **e** a invalidação quando o lugar muda;
   - exige gravação em `customer_addresses` com CEP só de dígitos e coordenadas obrigatórias;
   - exige que nenhum símbolo de hook seja declarado duas vezes.

Se qualquer um desses contratos falhar, o build para. O marcador, sozinho, não aprova nada.

---

## 2. Dois defeitos reais encontrados no caminho

O build ainda falhava depois do V9 — e **não era problema de hardener**. Era código gerado inválido:

### 2.1 `SyntaxError: Identifier 'hasValidCoordinates' has already been declared`

O callback `onAddressSelected` do cadastro de endereço tinha o bloco de V12 repetido **três vezes**. Três `const hasValidCoordinates` no mesmo escopo. Isso quebra a tela de **novo endereço em runtime** — não só o build.

Correção: novo `harden-entregas-address-callback-dedup.mjs` **reconstrói o callback a partir de um template único**, em vez de deduplicar linha a linha. Resultado sempre sintaticamente válido.

### 2.2 `SyntaxError: Identifier 'missingLocationFieldsRef' has already been declared`

Mesma classe, outro símbolo. Hardener ancorado em texto estável rodando duas vezes.

Correção: novo `harden-entregas-component-symbol-dedup.mjs`, que percorre **todo** `src/` e garante por contrato que nenhum `useRef`/`useState`/`useMemo`/`useCallback` de nível de componente aparece duas vezes.

Esses dois defeitos derrubariam **customer, courier, merchant e admin de uma só vez**.

---

## 3. Resultados medidos (não estimados)

| Verificação | Comando | Resultado |
|---|---|---|
| Pipeline de patches de Entregas | 47 comandos do manifest | **47/47 OK** |
| Build cliente | `VITE_APOIS_PRODUCT_MODE=customer bun run build` | **✓ built in 16.30s** |
| Build entregador | `... courier` | **OK** |
| Build estabelecimento | `... merchant` | **OK** |
| Build admin | `... admin` | **OK** |
| Testes de lógica (Node) | 5 suítes `scripts/qa/*.mjs` | **53 pass / 0 fail** |
| Testes Bun | `bun test` em `.work/entregas` | **48 pass / 0 fail** (108 asserções) |
| Bun instalado | `bun --version` | **1.4.0** (já presente no ambiente) |

**101 testes aprovados, zero falhas.** Isso é teste de lógica extraída dos handlers reais + compilação real dos quatro produtos. **Não é** teste em aparelho.

---

## 4. Matriz — estado real

| Sistema | Função | Status | Gravidade | Evidência |
|---|---|---|---|---|
| Entregas / build | Pipeline completo | **APROVADO** | crítica | 47/47 comandos |
| Entregas / build | customer, courier, merchant, admin | **APROVADO** | crítica | 4 builds verdes |
| Entregas / endereço | UF normalizada (GPS, ViaCEP, digitação) | **APROVADO (teste)** | crítica | 12 entradas + 4 Bun |
| Entregas / endereço | GPS preservado ao completar campo vazio | **APROVADO (teste)** | alta | 14 casos V13 |
| Entregas / endereço | Número/complemento não invalidam o ponto | **APROVADO (teste)** | alta | V10 + suíte |
| Entregas / endereço | Coordenada ausente não vira `0` | **APROVADO (teste)** | alta | `Number(null)===0` coberto |
| Entregas / endereço | Callback sem declaração duplicada | **CORRIGIDO — RETESTE PENDENTE** | crítica | SyntaxError reproduzido e eliminado |
| Entregas / Push | Toque abre `#/pedido/<id>` | **CORRIGIDO — RETESTE PENDENTE** | alta | `pathname` → `hash` |
| Entregas / UI | Rodapé 64px + safe area | **CORRIGIDO — RETESTE PENDENTE** | média | hardener aplicado |
| Supabase (2 projetos) | RLS, RPCs, Edge Functions | **BLOQUEADO POR ACESSO** | — | sem conector |
| Todos | Teste em aparelho/emulador | **NÃO EXECUTADO** | — | sem dispositivo |

**Telas homologadas em aparelho: 0.** A distinção é deliberada — compilação e teste de handler não substituem teste físico.

---

## 5. Pendente

- Commit desta rodada (autorizado) — verificações concluídas, será registrado na branch de auditoria.
- Regressão do Push: testada por código e por build; falta o toque real em notificação no aparelho.
- `process-superapp-refund`: análise autorizada, correção isolada com testes simulados — ainda não iniciada.
- Fases 3–10: não iniciadas.

## 6. Próximo passo

Fase 3 — Cliente Corridas: inventário das 16 rotas, fluxo de login → mapa → destino → estimativa → solicitação → acompanhamento → pagamento, e auditoria de status/realtime contra o app do Motorista.
