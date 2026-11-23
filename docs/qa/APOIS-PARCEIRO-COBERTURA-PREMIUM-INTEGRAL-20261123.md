# APOIS Parceiro — Cobertura integral dos PDFs de redesign premium

**Escopo:** APOIS Motorista + APOIS Entregador + seletor do Parceiro. **Cliente não redesenhado.**

**Branch única de trabalho:** `feat/apois-motorista-premium-visual-20261122`.

**Evidência da versão integral:** [GitHub Actions run 45106246859](https://github.com/apoistecnologia-gif/apois-superapp/actions/runs/45106246859) — **concluída com sucesso**, incluindo compilação dos dois módulos, verificação de todas as telas estruturais e captura automatizada de seletor/logins.

**Referências obrigatórias:** `APOIS_REDESIGN_PREMIUM_FIEL_A_REFERENCIA.pdf` (páginas 1–6, especialmente a fidelidade aprovada da p. 5) e `GUIA_IDENTIDADE_VISUAL_APOIS_PALETA_E_LOGO.pdf` (paleta e PNG oficial).

## Cobertura visual aplicada nos workspaces efêmeros

| Jornada | Tela / estado | Implementação | Regra operacional preservada |
| --- | --- | --- | --- |
| Compartilhada | Seletor Motorista/Entregador | `superapp/partner-shell/index.html` | Bloqueio de troca de papel durante atividade |
| Motorista | Login/recuperação/cadastro já existentes | Identidade original aprovada e QA de login | Autenticação Google/e-mail real, sem simular CPF |
| Motorista | Início Offline/Online | `apply-partner-motorista-premium-home-v1.mjs` | GPS, estado Online/Offline, mapa vivo e métricas reais |
| Motorista | Nova corrida/aceite/recusa | `apply-partner-premium-all-screens-v1.mjs` | Preço e endereços recebidos, cronômetro, aceite e recusa |
| Motorista | Navegação, chegada e início por PIN | Mesmo patch, `driver-active` | GPS, retorno de Maps/Waze, status e PIN |
| Motorista | Em viagem e finalizar corrida | Mesmo patch, `driver-active` | Finalização server-backed; não cria atalhos para pular etapas |
| Motorista | Corrida concluída e avaliação | Mesmo patch, `driver-rating` | Valor real e avaliação/dispensa do passageiro |
| Motorista | Ganhos | Mesmo patch, `driver-finance` | Saldo e saques condicionados à política existente |
| Motorista | Corridas/histórico | Mesmo patch, `driver-rides` | Consulta original ao histórico |
| Motorista | Perfil e navegação 4 abas | Mesmo patch, `driver-profile` + `ApoisPremiumDriverNav` gerado | `DriverActiveRideRecovery` continua montado |
| Entregador | Login/recuperação/cadastro já existentes | Layout de identidade e QA de login | E-mail/Google e cadastro atuais |
| Entregador | Início Offline/Online com mapa | `apply-partner-courier-premium-home-v1.mjs` | Um único switch, trava durante entrega ativa |
| Entregador | Novo pedido/aceite/recusa | `apply-partner-premium-all-screens-v1.mjs` | Ofertas reais, aceite e recusa originais, expiração |
| Entregador | Coleta, rota e confirmação | Mesmo patch, `courier-active` e `courier-active-overlay` | Etapas autenticadas, GPS, PIN, navegador externo |
| Entregador | Entrega concluída/suporte | Mesmo patch, `courier-completion` | Finalização e suporte originais |
| Entregador | Ganhos/financeiro | Mesmo patch, `courier-finance` | Sem saque fictício; valores ausentes como “—” |
| Entregador | Histórico e perfil | Mesmo patch, `courier-history` e `courier-profile` | Histórico, foto, contatos e ações existentes |

## Identidade e fidelidade

- Mapa real como protagonista nos estados de trabalho (não imagem/cartografia fictícia)
- Logo circular **original** preservada, sem redesenho ou recoloração
- Vermelho `#F51D2A`, vermelho profundo `#BB071D`, preto `#0D0F12`, branco `#FFFFFF`, cinza `#F3F4F6`
- Cabeçalhos e cartões claros, cantos suaves, controles de tamanho adequado, abas com indicador vermelho
- Não misturar ações de motorista e entregador nem exibir saldos/saques não homologados

## Arquitetura preservada

- Sem edição de `sources/apois-corridas-motorista-admin`, `sources/apois-entregas` ou `sources/apois-corridas-passageiro`
- Todos os transformadores são executados em `.work/partner-motorista` ou `.work/partner-entregador` antes de compilar, após hardeners funcionais
- O build do app Parceiro continua único, `br.com.apois.parceiro`, integrando os dois módulos
- Não foi realizado deploy, merge na main, migração SQL ou alteração de segredos

## Gatilhos de qualidade

Workflow de pré-APK: [QA web e visual do Parceiro](https://github.com/apoistecnologia-gif/apois-superapp/actions/workflows/apois-motorista-pdf-qa-no-apk.yml).

Executa conferência de pins, auditorias de interface e Parceiro, TypeScript e build dos dois módulos, verificador `verify-partner-premium-all-screens-v1.mjs` sobre 15 arquivos/categorias, navegador Chromium isolado com rede externa bloqueada em 320, 360, 390 e 1280 px (seletor e logins) e publicação de capturas de QA.

**Atenção:** as capturas automatizadas são de estados públicos/anônimos; não substituem comparação das telas autenticadas com o PDF num aparelho físico. O APK de teste ainda precisa passar por build Android, pin do certificado QA original e regressão de GPS, PIN, push, ofertas, navegação, entrega e fundos seguros.

## Uma única geração de APK de homologação

Quando a última rodada de pré-build terminar com status **success**, abrir [APOIS Parceiro Android APK](https://github.com/apoistecnologia-gif/apois-superapp/actions/workflows/apois-partner-android.yml), escolher **Run workflow** com a branch `feat/apois-motorista-premium-visual-20261122` e gerar **um** `APOIS-Parceiro-TESTE.apk`.

Não alterar assinatura/keystore original. Não publicar na Play Store nem produção sem homologação física.
