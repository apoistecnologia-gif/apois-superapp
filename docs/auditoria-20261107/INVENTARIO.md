# Inventário técnico inicial — APOIS — 07/11/2026

Base de integração: `18f2fed7e27486f2b3a4170921a246344316a2a4`, branch `audit/ecossistema-20261107`.

Inventário de caminhos não equivale a telas homologadas. Rotas de diagnóstico e legado são candidatas à análise de inclusão no build. Abas internas ainda precisam ser inventariadas nos componentes.

| Repositório | Entradas na árvore | Arquivos de rota TSX |
|---|---:|---:|
| apois-entregas | 498 | 37 |
| movvi-go-connect | 980 | 73 |
| say-hello-buddy-23-84b5dcbf | 656 | 16 |

## apois-entregas

| Arquivo de rota | Estado |
|---|---|
| `src/routes/__root.tsx` | NÃO EXECUTADO — inventário de código |
| `src/routes/admin.tsx` | NÃO EXECUTADO — inventário de código |
| `src/routes/apois-plus.tsx` | NÃO EXECUTADO — inventário de código |
| `src/routes/auth.callback.tsx` | NÃO EXECUTADO — inventário de código |
| `src/routes/buscar.tsx` | NÃO EXECUTADO — inventário de código |
| `src/routes/chamado-suporte.$ticketId.tsx` | NÃO EXECUTADO — inventário de código |
| `src/routes/checkout.tsx` | NÃO EXECUTADO — inventário de código |
| `src/routes/configuracoes-estabelecimento.tsx` | NÃO EXECUTADO — inventário de código |
| `src/routes/courier.tsx` | NÃO EXECUTADO — inventário de código |
| `src/routes/enderecos.tsx` | NÃO EXECUTADO — inventário de código |
| `src/routes/enderecos/editar/$addressId.tsx` | NÃO EXECUTADO — inventário de código |
| `src/routes/enderecos/novo.tsx` | NÃO EXECUTADO — inventário de código |
| `src/routes/estabelecimento.$merchantId.tsx` | NÃO EXECUTADO — inventário de código |
| `src/routes/favoritos.tsx` | NÃO EXECUTADO — inventário de código |
| `src/routes/index.tsx` | NÃO EXECUTADO — inventário de código |
| `src/routes/inicio.tsx` | NÃO EXECUTADO — inventário de código |
| `src/routes/login.tsx` | NÃO EXECUTADO — inventário de código |
| `src/routes/merchant.tsx` | NÃO EXECUTADO — inventário de código |
| `src/routes/notificacoes.tsx` | NÃO EXECUTADO — inventário de código |
| `src/routes/pedido/$orderId.tsx` | NÃO EXECUTADO — inventário de código |
| `src/routes/pedido/$orderId/avaliar.tsx` | NÃO EXECUTADO — inventário de código |
| `src/routes/pedido/$orderId/index.tsx` | NÃO EXECUTADO — inventário de código |
| `src/routes/pedido/confirmado.tsx` | NÃO EXECUTADO — inventário de código |
| `src/routes/pedidos.tsx` | NÃO EXECUTADO — inventário de código |
| `src/routes/perfil.tsx` | NÃO EXECUTADO — inventário de código |
| `src/routes/perfil/ajuda.tsx` | NÃO EXECUTADO — inventário de código |
| `src/routes/perfil/ajuda/chamado/$ticketId.tsx` | NÃO EXECUTADO — inventário de código |
| `src/routes/perfil/dados-pessoais.tsx` | NÃO EXECUTADO — inventário de código |
| `src/routes/perfil/index.tsx` | NÃO EXECUTADO — inventário de código |
| `src/routes/perfil/legal.tsx` | NÃO EXECUTADO — inventário de código |
| `src/routes/perfil/notificacoes.tsx` | NÃO EXECUTADO — inventário de código |
| `src/routes/perfil/pagamentos.tsx` | NÃO EXECUTADO — inventário de código |
| `src/routes/privacidade.tsx` | NÃO EXECUTADO — inventário de código |
| `src/routes/redefinir-senha.tsx` | NÃO EXECUTADO — inventário de código |
| `src/routes/register.tsx` | NÃO EXECUTADO — inventário de código |
| `src/routes/sacola.tsx` | NÃO EXECUTADO — inventário de código |
| `src/routes/termos.tsx` | NÃO EXECUTADO — inventário de código |

## movvi-go-connect

| Arquivo de rota | Estado |
|---|---|
| `src/routes/__root.tsx` | NÃO EXECUTADO — inventário de código |
| `src/routes/admin.administradores.tsx` | NÃO EXECUTADO — inventário de código |
| `src/routes/admin.analytics.tsx` | NÃO EXECUTADO — inventário de código |
| `src/routes/admin.assinaturas.tsx` | NÃO EXECUTADO — inventário de código |
| `src/routes/admin.backups.tsx` | NÃO EXECUTADO — inventário de código |
| `src/routes/admin.categorias.tsx` | NÃO EXECUTADO — inventário de código |
| `src/routes/admin.configuracoes.tsx` | NÃO EXECUTADO — inventário de código |
| `src/routes/admin.corridas.tsx` | NÃO EXECUTADO — inventário de código |
| `src/routes/admin.cupons.tsx` | NÃO EXECUTADO — inventário de código |
| `src/routes/admin.dashboard.tsx` | NÃO EXECUTADO — inventário de código |
| `src/routes/admin.financeiro-motoristas.tsx` | NÃO EXECUTADO — inventário de código |
| `src/routes/admin.financeiro.tsx` | NÃO EXECUTADO — inventário de código |
| `src/routes/admin.login.tsx` | NÃO EXECUTADO — inventário de código |
| `src/routes/admin.logs.tsx` | NÃO EXECUTADO — inventário de código |
| `src/routes/admin.mapa.tsx` | NÃO EXECUTADO — inventário de código |
| `src/routes/admin.motoristas.tsx` | NÃO EXECUTADO — inventário de código |
| `src/routes/admin.notificacoes.tsx` | NÃO EXECUTADO — inventário de código |
| `src/routes/admin.operacoes.tsx` | NÃO EXECUTADO — inventário de código |
| `src/routes/admin.pagamentos.tsx` | NÃO EXECUTADO — inventário de código |
| `src/routes/admin.passageiros.tsx` | NÃO EXECUTADO — inventário de código |
| `src/routes/admin.precos.tsx` | NÃO EXECUTADO — inventário de código |
| `src/routes/admin.relatorios.tsx` | NÃO EXECUTADO — inventário de código |
| `src/routes/admin.seguranca.tsx` | NÃO EXECUTADO — inventário de código |
| `src/routes/admin.suporte.tsx` | NÃO EXECUTADO — inventário de código |
| `src/routes/debug.motorista-auth.tsx` | NÃO EXECUTADO — inventário de código |
| `src/routes/dev-diagnostics.tsx` | NÃO EXECUTADO — inventário de código |
| `src/routes/dev.rating-test.tsx` | NÃO EXECUTADO — inventário de código |
| `src/routes/diagnostico.tsx` | NÃO EXECUTADO — inventário de código |
| `src/routes/download.tsx` | NÃO EXECUTADO — inventário de código |
| `src/routes/index.tsx` | NÃO EXECUTADO — inventário de código |
| `src/routes/map-test.tsx` | NÃO EXECUTADO — inventário de código |
| `src/routes/motorista.app.tsx` | NÃO EXECUTADO — inventário de código |
| `src/routes/motorista.assinatura.tsx` | NÃO EXECUTADO — inventário de código |
| `src/routes/motorista.cadastro.tsx` | NÃO EXECUTADO — inventário de código |
| `src/routes/motorista.carteira.tsx` | NÃO EXECUTADO — inventário de código |
| `src/routes/motorista.configuracoes.tsx` | NÃO EXECUTADO — inventário de código |
| `src/routes/motorista.corridas.$id.tsx` | NÃO EXECUTADO — inventário de código |
| `src/routes/motorista.corridas.tsx` | NÃO EXECUTADO — inventário de código |
| `src/routes/motorista.documentos.tsx` | NÃO EXECUTADO — inventário de código |
| `src/routes/motorista.ganhos.tsx` | NÃO EXECUTADO — inventário de código |
| `src/routes/motorista.login.tsx` | NÃO EXECUTADO — inventário de código |
| `src/routes/motorista.notificacoes.tsx` | NÃO EXECUTADO — inventário de código |
| `src/routes/motorista.perfil.tsx` | NÃO EXECUTADO — inventário de código |
| `src/routes/motorista.preferencias-notificacoes.tsx` | NÃO EXECUTADO — inventário de código |
| `src/routes/motorista.privacidade.tsx` | NÃO EXECUTADO — inventário de código |
| `src/routes/motorista.recuperar-senha.tsx` | NÃO EXECUTADO — inventário de código |
| `src/routes/motorista.redefinir-senha.tsx` | NÃO EXECUTADO — inventário de código |
| `src/routes/motorista.regalias.tsx` | NÃO EXECUTADO — inventário de código |
| `src/routes/motorista.seguranca.tsx` | NÃO EXECUTADO — inventário de código |
| `src/routes/motorista.status.tsx` | NÃO EXECUTADO — inventário de código |
| `src/routes/motorista.suporte.tsx` | NÃO EXECUTADO — inventário de código |
| `src/routes/motorista.termos.tsx` | NÃO EXECUTADO — inventário de código |
| `src/routes/passageiro.agendar.tsx` | NÃO EXECUTADO — inventário de código |
| `src/routes/passageiro.app.tsx` | NÃO EXECUTADO — inventário de código |
| `src/routes/passageiro.cadastro.tsx` | NÃO EXECUTADO — inventário de código |
| `src/routes/passageiro.carteira.tsx` | NÃO EXECUTADO — inventário de código |
| `src/routes/passageiro.configuracoes.tsx` | NÃO EXECUTADO — inventário de código |
| `src/routes/passageiro.corridas.tsx` | NÃO EXECUTADO — inventário de código |
| `src/routes/passageiro.envios.tsx` | NÃO EXECUTADO — inventário de código |
| `src/routes/passageiro.favoritos.tsx` | NÃO EXECUTADO — inventário de código |
| `src/routes/passageiro.guincho.tsx` | NÃO EXECUTADO — inventário de código |
| `src/routes/passageiro.login.tsx` | NÃO EXECUTADO — inventário de código |
| `src/routes/passageiro.mudancas.tsx` | NÃO EXECUTADO — inventário de código |
| `src/routes/passageiro.notificacoes.tsx` | NÃO EXECUTADO — inventário de código |
| `src/routes/passageiro.perfil.tsx` | NÃO EXECUTADO — inventário de código |
| `src/routes/passageiro.preferencias-notificacoes.tsx` | NÃO EXECUTADO — inventário de código |
| `src/routes/passageiro.privacidade.tsx` | NÃO EXECUTADO — inventário de código |
| `src/routes/passageiro.seguranca.tsx` | NÃO EXECUTADO — inventário de código |
| `src/routes/passageiro.servicos.tsx` | NÃO EXECUTADO — inventário de código |
| `src/routes/passageiro.sobre.tsx` | NÃO EXECUTADO — inventário de código |
| `src/routes/passageiro.suporte.tsx` | NÃO EXECUTADO — inventário de código |
| `src/routes/passageiro.termos.tsx` | NÃO EXECUTADO — inventário de código |
| `src/routes/t.$token.tsx` | NÃO EXECUTADO — inventário de código |

## say-hello-buddy-23-84b5dcbf

| Arquivo de rota | Estado |
|---|---|
| `src/routes/__root.tsx` | NÃO EXECUTADO — inventário de código |
| `src/routes/_authenticated.buscar-destino.tsx` | NÃO EXECUTADO — inventário de código |
| `src/routes/_authenticated.carteira.tsx` | NÃO EXECUTADO — inventário de código |
| `src/routes/_authenticated.corrida.$rideId.tsx` | NÃO EXECUTADO — inventário de código |
| `src/routes/_authenticated.corridas.tsx` | NÃO EXECUTADO — inventário de código |
| `src/routes/_authenticated.inicio.tsx` | NÃO EXECUTADO — inventário de código |
| `src/routes/_authenticated.notificacoes.tsx` | NÃO EXECUTADO — inventário de código |
| `src/routes/_authenticated.perfil.tsx` | NÃO EXECUTADO — inventário de código |
| `src/routes/_authenticated.revisar-solicitacao.tsx` | NÃO EXECUTADO — inventário de código |
| `src/routes/_authenticated.tsx` | NÃO EXECUTADO — inventário de código |
| `src/routes/_public.cadastro.tsx` | NÃO EXECUTADO — inventário de código |
| `src/routes/_public.index.tsx` | NÃO EXECUTADO — inventário de código |
| `src/routes/_public.login.tsx` | NÃO EXECUTADO — inventário de código |
| `src/routes/_public.recuperar-senha.tsx` | NÃO EXECUTADO — inventário de código |
| `src/routes/_public.redefinir-senha.tsx` | NÃO EXECUTADO — inventário de código |
| `src/routes/_public.tsx` | NÃO EXECUTADO — inventário de código |
