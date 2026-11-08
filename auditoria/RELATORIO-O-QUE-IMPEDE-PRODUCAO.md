# APOIS: o que impede os apps de irem para produção

**Versão parcial 1. A varredura continua.**
Repositório `apoistecnologia-gif/apois-superapp`, branch `audit/continuacao-20261107`.

---

## Como ler este relatório

- **CONFIRMADO**: verifiquei no código, e a linha está indicada.
- **PROVÁVEL**: o código aponta para o problema, mas só um teste no celular ou no banco real confirma.
- **DESCARTADO**: parecia problema, mas na verificação não era. Fica registrado para ninguém perder tempo com isso.

Cada item tem uma parte **"Para o ChatGPT corrigir"**. Copie essa parte e cole no agente.

---

## 🔴 1. Anexos e fotos sem lugar para serem guardados (Entregas)

**Em palavras simples:** o app deixa o estabelecimento enviar foto de produto e logo, e deixa o entregador e o estabelecimento enviarem documentos. Todo arquivo enviado precisa de uma "pasta" no Supabase, chamada *bucket*. O código usa essas pastas, mas **nenhum arquivo do projeto cria essas pastas**. O único bucket que o projeto Entregas cria é `avatars`.

Pastas que o app usa:

| Pasta (bucket) | Usada em | É criada no projeto? | Tem regras de acesso? |
|---|---|---|---|
| `product-images` | `src/components/MerchantProductEditor.tsx:180` (foto do produto) | ❌ não | ❌ não |
| `merchant-assets` | `src/routes/merchant.tsx:788` (logo e capa da loja) | ❌ não | ❌ não |
| `merchant-documents` | `src/routes/merchant.tsx:477` (documentos da loja) | ❌ não | ✅ sim |
| `courier-documents` | `src/routes/courier.tsx:450` (documentos do entregador) | ❌ não | ✅ sim |
| `support-attachments` | `src/components/AdminSupportPanel.tsx:10` (anexo de chamado) | ❌ não | ✅ sim |

**Status:** CONFIRMADO no código. O impacto em produção depende do banco real:
- Se alguém criou essas pastas à mão no painel do Supabase, funciona hoje. Mas o projeto não se reconstrói sozinho, e um ambiente novo de teste nasce quebrado.
- Se ninguém criou, o envio de foto de produto, de logo e de documentos **falha**.
- `product-images` e `merchant-assets` não têm regra de acesso. Mesmo que a pasta exista, o upload provavelmente será recusado.

**Para o ChatGPT corrigir:**
> No repositório `apois-entregas`, crie uma migration que faça `insert into storage.buckets ... on conflict (id) do nothing` para `product-images`, `merchant-assets`, `merchant-documents`, `courier-documents` e `support-attachments`, com limite de tamanho e tipos MIME. Use como modelo `supabase/migrations/20260818014500_customer_avatar_google_profile.sql`. Para `product-images` e `merchant-assets`, crie também as políticas de `storage.objects`: o dono da loja (via `merchant_members`) pode enviar, e a leitura é pública. Não altere as políticas já existentes dos outros três buckets.

---

## 🔴 2. Tabelas principais que o projeto não cria (Entregas)

**Em palavras simples:** o app usa tabelas como **entregadores**, **entregas**, **endereços do cliente**, **avaliações** e **configurações da plataforma**. Nenhuma migration do projeto cria essas tabelas. Elas só aparecem em arquivos de teste (`scripts/qa/*.sql`). As migrations até *alteram* algumas delas, então essas tabelas existem no banco real, criadas por fora do código.

| Tabela | Menções no backend | Criada por migration? |
|---|---:|---|
| `couriers` (entregadores) | 103 | ❌ |
| `delivery_jobs` (entregas) | 110 | ❌ (apenas alterada) |
| `merchant_members` (equipe da loja) | 44 | ❌ |
| `platform_settings` (configurações) | 36 | ❌ |
| `customer_addresses` (endereços) | 10 | ❌ |
| `reviews` (avaliações) | 3 | ❌ |
| `notification_preferences` | 3 | ❌ |

Há um segundo problema ligado a esse. O arquivo de tipos do banco (`src/integrations/supabase/types.ts`) conhece só **9 tabelas**. Por isso o código usa **139 conversões forçadas** (`as any` / `as unknown as`). Na prática, o verificador de erros do código fica desligado: um nome de coluna errado não aparece na compilação, só quebra no celular. Isso explica em parte o "corrige uma coisa e aparece outra".

**Status:** CONFIRMADO. É um risco de produção, não um defeito visível hoje. Não é possível recriar o banco a partir do código, e não é possível detectar erros de coluna antes de publicar.

**Para o ChatGPT corrigir:**
> 1. Com acesso ao Supabase de Entregas (`ptgkwyyolrdgnqketkjj`), rode `supabase db dump --schema public` e crie uma migration *baseline* com o `CREATE TABLE` de `couriers`, `delivery_jobs`, `merchant_members`, `platform_settings`, `customer_addresses`, `reviews` e `notification_preferences`, usando `if not exists`.
> 2. Rode `supabase gen types typescript --project-id ptgkwyyolrdgnqketkjj > src/integrations/supabase/types.ts`.
> 3. Remova gradualmente os `as any` das chamadas `.from(...)`.

---

## 🟠 3. Função "ponto de referência próximo" não existe (Corridas, Passageiro)

**Em palavras simples:** quando o GPS dá um endereço impreciso, o app do passageiro tenta mostrar um ponto de referência ("perto do Mercado X"). Para isso, chama uma função do servidor chamada `passenger-geocode-nearest-poi`. **Essa função não existe** no projeto. Existe só a `passenger-geocode-reverse`. O erro é engolido sem aviso, então nada aparece para o usuário: o recurso simplesmente nunca funciona.

- Arquivo: `sources/apois-corridas-passageiro/src/services/geocoding/geocoding-service.ts:195`
- **Status:** CONFIRMADO.

**Para o ChatGPT corrigir:**
> Escolha um dos caminhos:
> - (a) crie a Edge Function `passenger-geocode-nearest-poi`, com Google Places Nearby Search e o mesmo padrão de chave e rate limit da `passenger-geocode-reverse`;
> - (b) remova a chamada em `geocoding-service.ts:193-212`.
>
> Não deixe uma chamada para função inexistente.

---

## 🟠 4. Download no Admin aponta para arquivo e pasta inexistentes (Motorista/Admin)

- Arquivo: `sources/apois-corridas-motorista-admin/src/lib/adminDownloads.functions.ts:25`, usado em `src/routes/download.tsx`.
- O código busca `movvi-drive-source.zip` na pasta `downloads`. Nenhuma migration cria a pasta `downloads`. O nome "movvi" é da marca antiga.
- O nome do arquivo sugere que o Admin distribui o **código-fonte** do app. Se for isso, é um risco de segurança.
- **Status:** CONFIRMADO que a pasta não é criada. A finalidade precisa ser confirmada por você.

**Para o ChatGPT corrigir:**
> Confirme com o dono do produto a finalidade de `/download`. Se não for necessária, remova a rota e `adminDownloads.functions.ts`. Se for necessária, crie o bucket `downloads` privado e troque o arquivo para o APK oficial com a marca APOIS.

---

## 🟠 5. Botões escondidos no rodapé da tela do celular (Entregas, Cliente)

**Em palavras simples:** 15 telas do cliente usam altura fixa de "tela inteira" (`h-screen`, que equivale a 100vh) junto com "esconder o que passar" (`overflow-hidden`). Em muitos celulares, 100vh é **maior** que a área visível, porque a barra do navegador, a barra de gestos e o teclado ocupam espaço. O que fica embaixo é cortado e não dá para rolar até lá. É exatamente o sintoma "página grande demais que esconde botões".

O app do Passageiro já usa a forma correta (`100dvh`). O de Entregas, não.

Telas afetadas (todas em `sources/apois-entregas/src/routes/`):

| Tela | Linha |
|---|---:|
| `inicio.tsx` | 173 |
| `buscar.tsx` | 384 |
| `favoritos.tsx` | 119 |
| `pedidos.tsx` | 148 |
| `pedido/$orderId/index.tsx` | 326 |
| `pedido/$orderId/avaliar.tsx` | 201 |
| `perfil/index.tsx` | 85 |
| `perfil/dados-pessoais.tsx` | 300 |
| `perfil/pagamentos.tsx` | 46 |
| `perfil/notificacoes.tsx` | 168 |
| `perfil/legal.tsx` | 65 |
| `perfil/ajuda.tsx` | 154 |
| `perfil/ajuda/chamado/$ticketId.tsx` | 285 |
| `chamado-suporte.$ticketId.tsx` | 180 |
| `apois-plus.tsx` | 51 |

**Status:** PROVÁVEL. O padrão está confirmado no código; o corte precisa ser confirmado num celular. A tela de **avaliar pedido** e a de **dados pessoais** são as mais arriscadas, porque abrem o teclado.

**Para o ChatGPT corrigir:**
> Nos 15 arquivos listados, troque `h-screen` por `h-[100dvh]` no container raiz. Garanta que o conteúdo central tenha `overflow-y-auto` e que o rodapé fixo use `pb-[env(safe-area-inset-bottom)]`. Como a pasta `sources/` é travada por política do repositório, a mudança deve ser feita por um script *hardener* em `scripts/`, no mesmo padrão de `harden-entregas-touch-targets-v17.mjs`.

---

## 🟠 6. Chave do Google Maps não documentada (Motorista/Admin)

O código lê `VITE_APOIS_GOOGLE_MAPS_BROWSER_KEY`, `VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_BROWSER_KEY`, `VITE_ENABLE_NATIVE_PUSH` e `VITE_APP_ROLE`. Nenhuma delas está no `.env.example`. Quem for publicar não vai saber que precisa configurar essas variáveis, e o resultado é **mapa em branco** e **notificação push desligada**.

- **Status:** CONFIRMADO.
- **Para o ChatGPT corrigir:** adicione as 4 variáveis ao `.env.example` com comentário explicando cada uma, e remova a variante `LOVABLE_CONNECTOR`, que é resto da ferramenta de geração.

---

## 🔴 7. Telas quebradas do Motorista (já encontradas antes)

| Código | Tela | Sintoma medido | Arquivo |
|---|---|---|---|
| D-004 | `/motorista/cadastro` | tela totalmente em branco | `motorista.cadastro.tsx` |
| D-005 | `/motorista/corridas` | aparece e depois some | `motorista.corridas.tsx:238-262` |

Detalhes no arquivo `AUDITORIA-APOIS-90-ROTAS-PENDENTES.md`.

---

## ✅ Itens verificados e DESCARTADOS (não precisa corrigir)

| O que parecia | Por que não é problema |
|---|---|
| Funções `admin_get_settings`, `create_passenger_sos` e outras 4 "não existem" | Existem, em `motorista-admin/supabase/baseline/*.sql` |
| Pastas `driver-cnh`, `vehicle-documents` e `profile-photos` "não existem" | São criadas em `baseline/004_storage_triggers_seed.sql` |
| Tabelas do Admin "faltando" | Estão no `baseline/001_canonical_schema.sql` |
| Tabelas admin com `min-w-[900px]` "maiores que a tela" | Estão dentro de `overflow-x-auto`: rolam de lado, como esperado |
| Containers `max-w-[430px]`/`[460px]` | É limite máximo, não largura fixa: não estoura no celular |
| "Texto branco em fundo branco" (8 casos) | Falso alarme: era `bg-black text-white` ou estado de *hover* |
| Cupons e Backups no Admin "sem função" | Desligados de propósito, com explicação na própria tela |
| Links para páginas inexistentes | 0 encontrados nos 3 apps |

---

## O que ainda falta varrer (próximas etapas)

1. **Cores e contraste de verdade:** medir a combinação texto/fundo nas telas já abertas no navegador. A busca por texto só pega casos óbvios.
2. **Cadastro e documentos do motorista:** seguir o upload de ponta a ponta até `driverRegistration.mobile.ts`.
3. **Pagamentos:** conferir se cada botão de pagar chama a função correta e se o *webhook* existe (Mercado Pago, Asaas, Safe2Pay).
4. **Notificações push:** Firebase, `notification_push_outbox`, gatilho nativo.
5. **Duplicidades:** telas e menus com a mesma função em lugares diferentes.
6. **Corridas, mapa e GPS:** fluxo passageiro → motorista → finalização.
