# APOIS Brand V2 — Preto + Vermelho + Branco + Dourado

## Escopo

A identidade V2 é exclusivamente visual. Ela não altera banco, APIs, autenticação, rotas, pagamentos, mapas enquanto serviço, geolocalização, regras de corrida/entrega ou fluxos funcionais.

A fonte central é:

- `design-system/apois-brand-v2.json`
- `design-system/apois-brand-v2.css`
- `scripts/apply-apois-brand-v2.mjs`

Os repositórios fonte protegidos continuam somente leitura. A marca é aplicada nas cópias `.work` durante cada build.

## Paleta

| Papel | Cor |
| --- | --- |
| Preto principal | `#08090B` |
| Superfície / cards | `#111318` |
| Superfície elevada | `#181A20` |
| Vermelho APOIS | `#F5222D` |
| Vermelho forte | `#FF1F2D` |
| Vermelho escuro | `#9E1018` |
| Branco | `#FFFFFF` |
| Branco secundário | `#F3F3F3` |
| Texto secundário | `#A6A8AE` |
| Dourado | `#D9A520` |
| Dourado claro | `#F4C44E` |
| Dourado escuro | `#A97808` |

Para CTA com texto branco foi criado `--primary: #D91E27`. É um vermelho da mesma família, ligeiramente mais escuro que `#F5222D`, para manter contraste WCAG AA de texto normal. `#F5222D` continua sendo `--primary-brand` para indicadores, seleção e identidade.

## Tokens semânticos

`--background`, `--surface`, `--surface-elevated`, `--primary-brand`, `--primary`, `--primary-hover`, `--primary-foreground`, `--secondary`, `--accent`, `--accent-foreground`, `--text-primary`, `--text-secondary`, `--muted-foreground`, `--border`, `--input`, `--ring`, `--destructive`, `--success`, `--warning` e `--info`.

Verde continua reservado a sucesso/online. Dourado funciona como acabamento/acento e aviso quando semanticamente apropriado. Erro permanece semanticamente separado da cor principal por token próprio.

## Superfícies cobertas

- Superapp Passageiro / Corridas
- Superapp Cliente / Entregas
- Shell Cliente Corridas + Entregas
- APOIS Parceiro
- Motorista
- Entregador
- Painel Admin Corridas
- Painel Estabelecimento / Merchant Entregas

## Build

`apply-apois-brand-v2.mjs` é executado como última camada visual das cópias de build, depois dos hardeners legados. Isso mantém compatibilidade com os snapshots protegidos sem espalhar novos hexadecimais pelos componentes.

## Mapas

Cores próprias de rota/marcadores da Corridas que usavam o amarelo antigo são migradas para vermelho. Estados/markers que precisam de diferenciação semântica não são convertidos indiscriminadamente.

O estilo-base escuro do Google Maps depende também da configuração do Map ID/Cloud Styling de cada projeto. Essa configuração externa não é alterada nesta etapa.

## Ativos binários

Launcher/splash/logos PNG existentes não são redesenhados automaticamente por este Design System. Caso a arte embutida ainda use a paleta anterior, ela deve receber uma versão gráfica V2 separada, preservando dimensões, transparência e requisitos Android/iOS.
