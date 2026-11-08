# 07 — DUPLICIDADES

Investigação sistemática no commit `96732c55`. Cada item distingue duplicidade prejudicial de reutilização legítima.

---

## 1. Código React

| Item | Resultado | Método | Classificação |
|---|---|---|---|
| Hooks (`useRef`/`useState`/`useMemo`/`useCallback`) declarados 2× no mesmo componente | **0** | `harden-entregas-component-symbol-dedup.mjs` percorre todo `src/` | corrigido em `7c1b6c00` |
| `handleChange` duplicado | **0** | contrato do `address-uf-and-number-v16` | corrigido |
| `hasValidCoordinates` duplicado no callback | **0** | `address-callback-dedup` reconstrói o callback | corrigido em `7c1b6c00` |
| `useEffect` com dependências | 4 em `novo.tsx`, 1 em `editar/$addressId.tsx` | inspeção | legítimo — cada um com propósito distinto |
| `useEffect` duplicado (mesmo efeito, mesma dep) | **0** após correção do `auto-delivery-address` | diff de duas passadas | corrigido |

## 2. Listeners e chamadas

| Item | Resultado | Evidência |
|---|---|---|
| `App.addListener("backButton")` duplicado no Entregador | **0** | `courier.tsx` com `backHandle.remove()` no cleanup |
| `stopCourierNativeLocation()` em sequência | **0** após `-block-dedup` | contrato do hardener |
| `appStateHandle` declarado 2× | **0** após `ae92f1ba` | 16 erros de parse eliminados |
| Chamadas `setDeliveryHistory` aninhadas | **0** após `-operation-states` | idempotência em 2 passadas |

## 3. Rotas e telas

| Item | Resultado | Classificação |
|---|---|---|
| Rotas duplicadas entre produtos | **não encontradas** | `routeFileIgnorePattern` remove rotas de outro produto da árvore |
| `/admin` e `/motorista/app` no build do passageiro | retornam 404 do SPA | **isolamento correto**, não duplicidade |
| `/courier`, `/merchant`, `/admin` no build do Cliente | redirecionam à landing | **isolamento correto** |
| Telas equivalentes entre apps | **não confirmadas** | telas autenticadas não observadas |

## 4. Menus e navegação

| Item | Resultado | Evidência |
|---|---|---|
| Atalhos "Meus pedidos"/"Favoritos" duplicados no Perfil | removidos pelo `harden-superapp-module-mobile-ui` | contrato exige ausência |
| Menu hambúrguer duplicado no AppShell de Corridas | **0** | contrato lança erro se `MainHamburgerMenu` voltar |
| Abas do rodapé do Cliente | 4 + botão central | legítimo |

## 5. Hardeners não idempotentes

Todos corrigidos. Lista completa:

`address-uf-v9`, `address-async-v11`, `address-selection-v12`, `address-missing-fields-v13`, `auto-delivery-address`, `auto-address-cep-v1`, `component-symbol-dedup`, `uf-and-number-v16`, `partner-entregador-operation-states`, `partner-entregador-background-location`, `partner-entregador-journey`, `partner-entregador-gps-resume`, `partner-entregador-block-dedup`, `admin-guard-navigation`, `partner-admin-legacy-brand`.

**Verificação:** `courier.tsx` e `novo.tsx` byte-idênticos após duas passadas consecutivas.

## 6. Operações de banco

| Item | Resultado |
|---|---|
| `set_default_customer_address` chamada 2× | **0** — RPC única com fallback removido pelo `address-confirmation` |
| Inserção duplicada em `customer_addresses` | **0** — `count` antes do insert com `is_default` |
| Requisições repetidas ao Supabase | **não medidas** — exigiria instrumentar rede com sessão ativa |

## 7. O que permanece sem resposta

- Duplicidades **dentro de telas autenticadas** (menus, botões, abas) não puderam ser observadas.
- Chamadas de rede repetidas exigem sessão e instrumentação de `page.on('request')`.
- Componentes antigos ainda montados em telas logadas não foram inventariados visualmente.

Nenhuma remoção foi recomendada sem demonstrar impacto.
