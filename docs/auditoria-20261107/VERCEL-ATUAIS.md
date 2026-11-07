# Mapa Vercel verificado — 07/11/2026

Levantamento dos nove projetos disponíveis na conta conectada. Mais recente significa último deploy READY encontrado, não aprovação funcional nem promoção para produção.

| Projeto | Deploy mais recente encontrado | Data (Recife) | Commit | Branch |
|---|---|---|---|---|
| apois-corridas-admin-homologacao | [Abrir](https://apois-corridas-admin-homologacao-bfvtjlfj8.vercel.app) | 07/11/2026, 16:08 | `f7728ae55d5d5796869218b5ec40e39f031371d2` | `audit/ecossistema-20261107` |
| apois-entregas-visual-preview | [Abrir](https://apois-entregas-visual-preview-k0zvtb8yp.vercel.app) | 03/11/2026, 18:49 | `ccd30fc03cc95119f702ceab27b85fd81e57c88d` | `legal/novos-planos-assinatura-homolog-20261103` |
| apois-estabelecimento-visual-preview | [Abrir](https://apois-estabelecimento-visual-preview-4o787emww.vercel.app) | 03/11/2026, 18:49 | `ccd30fc03cc95119f702ceab27b85fd81e57c88d` | `legal/novos-planos-assinatura-homolog-20261103` |

Os três têm target null (preview). A tentativa de ler as páginas com a conexão Vercel retornou 403, no estágio read_protection_bypass. Os metadados de projetos, aliases e deployments puderam ser consultados. Não confundir a proteção Vercel com uma falha de autenticação do aplicativo. CLI Vercel não está disponível no ambiente desta sessão. Proteções não foram alteradas.

## Domínios antigos versus último deploy

O alias apois-entregas-visual-preview.vercel.app aponta para dpl_8RWW46Mi8A6SREn86PU1cpaCp56t, commit 877b5adeb0496a37188d55a6aff8213d63cf5e5b, branch fix/apois-entregas-portals-red-20261027. Não aponta para o último deploy listado no projeto. A inspeção visual anterior se refere a esse alias antigo; a atribuição anterior ao commit ccd30fc03 foi incorreta e fica substituída por esta verificação.

Também há diferença entre aliases estáveis e último preview nos projetos Estabelecimento visual e Corridas homologação. Usar a URL imutável do deploy e conferir seu SHA antes de cada auditoria.

## Produção atualmente vinculada

| Superfície | Domínio | Deployment |
|---|---|---|
| Admin Entregas | https://admin.apoisbrasil.com.br | dpl_7b8u2qKrZdEWiMWAkBaEwXJ65puB |
| Estabelecimento | https://parceiros.apoisbrasil.com.br | dpl_GT6JfV8dJ7MQrydb7Vo2MTde9G2r |
| Admin Corridas | https://admin-corridas.apoisbrasil.com.br | dpl_9XDRkY2RTdEFyS1jd5QKcWt4bE9q |

As duas primeiras produções são publicações CLI com meta Git vazia; não atribuir commit sem outra evidência. O domínio estável de Corridas também difere da homologação mais recente. Não foi realizada promoção, troca de alias nem publicação em produção.

## Previews automáticos

Os pushes anteriores na branch de auditoria acionaram automaticamente previews do projeto apois-corridas-admin-homologacao pela integração Git da Vercel. As frases anteriores de que nenhum deploy havia ocorrido devem ser entendidas/corrigidas: nenhuma publicação manual ou promoção em produção foi executada; houve previews automáticos. Um deploy READY de Admin Corridas não demonstra que o Cliente Entregas foi compilado ou testado.

