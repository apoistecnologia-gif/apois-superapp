# APOIS — Fase 10 · Cliente Corridas e Motorista em navegador

**Branch:** `audit/continuacao-20261107` · **Playwright 1.65.0 + Chromium** · viewport 390×844
**Servidores:** 4200 (Corridas `dist/` estático), 4201 (Motorista `dist/client/`)

---

## 1. Cliente Corridas — 14 rotas medidas

Build próprio (`bun run build:capacitor`, 523 pacotes instalados), servido como SPA estática — sem Nitro, sem API.

| Rota | Hash final | Texto | Inputs | Resultado |
|---|---|---:|---:|---|
| `/` | `#/login` | 184 | 2 | redireciona para login |
| `/login` | `#/login` | 184 | 2 | **renderiza** "Entrar na sua conta" |
| `/cadastro` | `#/cadastro` | 246 | 6 | **renderiza** "Criar conta" |
| `/recuperar-senha` | `#/recuperar-senha` | 140 | 1 | **renderiza** "Recuperar senha" |
| `/redefinir-senha` | `#/login` | 226 | 2 | redireciona (sem token de reset) |
| `/inicio` | `#/login` | 184 | 2 | exige sessão |
| `/buscar-destino` | `#/login` | 184 | 2 | exige sessão |
| `/revisar-solicitacao` | `#/login` | 184 | 2 | exige sessão |
| `/corridas` | `#/login` | 184 | 2 | exige sessão |
| `/carteira` | `#/login` | 184 | 2 | exige sessão |
| `/notificacoes` | `#/login` | 184 | 2 | exige sessão |
| `/perfil` | `#/login` | 184 | 2 | exige sessão |
| `/admin` | `#/admin` | 9 | 0 | **"Not Found"** |
| `/motorista/app` | `#/motorista/app` | 9 | 0 | **"Not Found"** |

**Zero `pageerror` em 14 rotas.** Um aviso de console em `/inicio`: `[GoogleMapsLoader]` — esperado sem `CORRIDAS_WEB_MAPS_API_KEY`.

### 1.1 Observação sobre `/admin` e `/motorista/app`

Ambas retornam a página 404 do SPA (`"Not Found"`, 47 bytes de HTML). Isso é **correto por desenho**: o build do passageiro não inclui as rotas administrativas nem o app do motorista — elas vivem no snapshot `movvi-go-connect`. Não é defeito; é isolamento de produto funcionando.

## 2. Motorista — build e servidor

`bun run build:motorista` já havia sido executado na Fase 4 (`dist/client/index.html` gerado, typecheck limpo, 31 testes unitários). Servidor estático iniciado na porta 4201.

**O smoke de rotas do Motorista não foi concluído nesta sessão** — o tempo foi consumido pela investigação de autenticação (§3) e pelo build do Corridas. Fica registrado como **NÃO EXECUTADO**, não como aprovado.

## 3. Testes autenticados — o que existe e o que falta

### 3.1 Infraestrutura encontrada no repositório

| Item | Situação |
|---|---|
| `.env.example` | documenta `CORRIDAS_VITE_SUPABASE_URL`, `VITE_SUPABASE_URL`, chaves publicáveis e chaves de mapas — **nenhum valor**, apenas nomes |
| `sources/apois-entregas/supabase/config.toml` | `project_id = "sbvhdgyuuperszlsllji"`, funções de webhook com `verify_jwt = false` — configuração de **deploy**, não de teste local |
| Supabase local (`supabase start`) | **não configurado** — não há `config.toml` na raiz do Superapp |
| Contas de homologação documentadas | **não encontradas** — buscas por "conta de teste", "sintétic", "synthetic" em `docs/` não retornam credenciais nem procedimento |
| Workflow de CI com Supabase | existe build Android, mas **sem** provisionamento de banco de teste |

### 3.2 Caminho seguro proposto (não executado)

1. **Supabase local** (`supabase start`) com as migrations do snapshot — roda em Docker, sem tocar produção. Exige Docker no ambiente, que não está disponível aqui.
2. **Seed determinístico** com usuários sintéticos criados por `auth.admin.createUser` no banco local, nunca no projeto remoto.
3. **Playwright storageState** gerado por login real contra o banco local, reutilizado entre testes — nenhuma autenticação simulada.
4. **Nunca** desativar RLS nem usar `service_role` no cliente.

Nada disso foi executado: falta Docker e o conector Supabase. **Nenhuma credencial foi exposta neste relatório.**

## 4. Matriz — funcionalidades autenticadas pendentes

| App | Tela/Função | Bloqueio |
|---|---|---|
| Corridas | `/inicio` — mapa, origem, categorias, estimativa | sessão + Maps key |
| Corridas | `/buscar-destino` — Places, sugestões | sessão + Maps key |
| Corridas | `/revisar-solicitacao` — confirmar corrida | sessão + Supabase |
| Corridas | `/corrida/$rideId` — acompanhamento, PIN, cancelamento | sessão + 2 atores |
| Corridas | `/corridas` — histórico | sessão |
| Corridas | `/carteira` — saldo, bloqueio | sessão |
| Corridas | `/notificacoes`, `/perfil` | sessão |
| Motorista | login, cadastro, documentos, assinatura | sessão + Supabase |
| Motorista | ficar online, GPS, ofertas, aceite/recusa | aparelho + Supabase |
| Motorista | PIN, navegação, conclusão, ganhos | aparelho + 2 atores |
| Motorista | histórico, notificações, suporte | sessão |
| Admin Corridas | 23 rotas | sessão admin + Supabase |
| Entregas | sacola, checkout, pedidos, endereços salvos | sessão + Supabase |
| Entregador | ofertas, coleta, PIN, entrega | aparelho + Supabase |
| Estabelecimento | produtos, pedidos, financeiro | sessão + Supabase |
| Admin Entregas | pedidos, cobertura, repasses | sessão admin + Supabase |

## 5. Status honesto

- **Rotas públicas**: testadas e aprovadas em Corridas (4 telas) e Entregas (4 modos).
- **Rotas autenticadas**: **zero aprovadas**. Todas param no login.
- **Formulários**: nenhum submetido — sem backend não há prova de persistência.
- **GPS, push, teclado, safe area**: não testados.

## 6. Arquivos desta fase

```
qa-visual/serve-static.mjs        servidor SPA estático para builds sem Nitro
qa-visual/corridas-smoke.mjs      14 rotas do Cliente Corridas
qa-visual/corridas-deep.mjs       investigação de /admin, /motorista/app, /redefinir-senha
qa-visual/corridas-*.png          capturas por rota
```
