# APOIS — Identidade Visual Unificada

## Escopo

Esta migração é **exclusivamente visual**. Ela não altera banco de dados, Supabase, APIs, autenticação, login Google, rotas, navegação, pagamentos, Safe2Pay, mapas enquanto serviço, geolocalização, realtime, notificações, Capacitor, regras de corrida/entrega, callbacks, contratos TypeScript ou qualquer fluxo funcional.

Os repositórios fonte protegidos continuam somente leitura. A identidade é aplicada nas cópias `.work` durante os builds.

A fonte central existente continua sendo:

- `design-system/apois-brand-v2.json`
- `design-system/apois-brand-v2.css`
- `scripts/apply-apois-brand-v2.mjs`

O nome técnico "Brand V2" dos arquivos foi preservado para não quebrar o pipeline. O conteúdo desses arquivos agora representa a identidade visual APOIS unificada.

## Paleta oficial

| Papel | Cor |
| --- | --- |
| Vermelho APOIS principal | `#E51B23` |
| Vermelho hover/pressed | `#C9141B` |
| Vermelho suave | `#FFF1F2` |
| Preto principal | `#111111` |
| Preto secundário | `#242424` |
| Branco | `#FFFFFF` |
| Fundo principal | `#F7F7F8` |
| Fundo secundário | `#F1F2F4` |
| Bordas | `#E2E4E8` |
| Texto secundário | `#666B73` |
| Texto desabilitado | `#9CA1A9` |

A proporção visual é intencionalmente **branco/cinza claro > preto > vermelho**. Vermelho é usado em identidade, seleção e ações; não como preenchimento indiscriminado de telas ou cards.

## Tokens semânticos

Os tokens centrais incluem `--apois-primary`, `--apois-primary-hover`, `--apois-primary-soft`, `--apois-background`, `--apois-surface`, `--apois-surface-secondary`, `--apois-border`, `--apois-text`, `--apois-text-secondary` e `--apois-text-disabled`.

Os aliases técnicos antigos que contêm "gold" permanecem temporariamente apenas para compatibilidade com hardeners legados. Eles apontam para a nova família vermelho/soft-red e não definem uma segunda identidade dourada.

## Cores semânticas preservadas

A migração não transforma automaticamente toda cor em vermelho.

- verde continua permitido para online, sucesso e estados positivos;
- amarelo/laranja continua permitido para alerta quando semanticamente necessário;
- azul continua permitido para informação quando melhora compreensão;
- erro usa o token destrutivo;
- cores oficiais do Google permanecem intactas;
- Google Maps, Map IDs, tiles e estilos do provedor não são recoloridos;
- marcas de terceiros, bandeiras de cartão e provedores de pagamento mantêm identidade própria;
- gráficos administrativos podem manter cores distintas quando isso protege legibilidade.

## Componentes visuais

### Botões

Primário: `#E51B23` com texto branco. Hover/pressed: `#C9141B`. Disabled: superfície cinza clara e texto `#9CA1A9`.

Secundário: fundo branco, texto `#111111`, borda `#E2E4E8`.

### Inputs

Fundo branco, borda `#E2E4E8`, texto `#111111`, placeholder `#9CA1A9` e foco vermelho APOIS. Validação, máscara e comportamento não são alterados.

### Cards

Fundo branco, borda discreta e sombra preta/cinza de baixa opacidade. Estado selecionado pode receber detalhe vermelho ou fundo `#FFF1F2`.

### Navegação

Item ativo usa vermelho APOIS. Itens inativos usam cinza. Destinos, IDs e eventos de navegação permanecem inalterados.

## Superfícies cobertas

- APOIS Passageiro / Corridas
- APOIS Cliente / Entregas
- Shell Cliente
- APOIS Parceiro
- Motorista
- Entregador
- Painel Admin Corridas
- Estabelecimento / Merchant Entregas
- logins, cadastro e recuperação de senha
- splash e launcher Android

## Logomarca

Os assets oficiais existentes tiveram somente a paleta técnica adaptada, preservando a geometria:

- `superapp/branding/apois-wordmark-v3.svg` — versão principal para fundo claro;
- `superapp/branding/apois-mark-v3.svg` — símbolo reduzido/launcher;
- `apois-wordmark-white-v3.svg` e `apois-mark-white-v3.svg` — variações técnicas para superfícies escuras quando necessárias.

A marca principal usa vermelho no elemento inicial e preto nas demais partes. Launcher e splash usam o mesmo símbolo oficial, sem crop de wordmark.

## Build

`apply-apois-brand-v2.mjs` continua sendo o aplicador central. Em Corridas ele é executado depois dos hardeners de referência para funcionar como última camada visual sem modificar handlers, hooks ou fluxos.

Entregas, Motorista, Entregador, Admin e Merchant recebem a mesma fonte de tokens em seus workspaces descartáveis.

## Mapas

Não há troca de biblioteca, chave, Map ID, câmera, geocoding, autocomplete, polylines ou cálculo de rota.

Somente elementos próprios da APOIS podem receber a marca: overlays, cards, botões e pins próprios. Cores internas do provedor e estilos necessários à leitura do mapa permanecem fora da substituição global.

## Regra de validação

A migração é considerada correta somente quando o comportamento antes/depois é idêntico e apenas a aparência muda. Gates de autenticação, pagamento, mapas, realtime, notificações e lifecycle continuam obrigatórios. Regressões funcionais não podem ser mascaradas por auditorias visuais.
