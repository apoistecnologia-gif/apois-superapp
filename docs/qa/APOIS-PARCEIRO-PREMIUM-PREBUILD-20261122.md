# APOIS Parceiro — Pré-build do visual premium aprovado

## Status: APTO A SOLICITAR O BUILD ANDROID DE HOMOLOGAÇÃO

- Branch isolada: `feat/apois-motorista-premium-visual-20261122`
- Baseline protegido QA281: `9ddc4598522c5578f6381abd414e90d7a1716678`
- Workflow de homologação web completa: [run 45103956514](https://github.com/apoistecnologia-gif/apois-superapp/actions/runs/45103956514) — **sucesso**
- Workflow Android **não foi executado nesta modernização**; ainda não existe APK construído desta branch
- Não houve merge em `main`, alteração dos submódulos protegidos, SQL de produção ou deploy

## Referências de aprovação

1. `APOIS_REDESIGN_PREMIUM_FIEL_A_REFERENCIA.pdf` — Motorista/Entregador com mapa, controle de disponibilidade e painel compacto
2. `GUIA_IDENTIDADE_VISUAL_APOIS_PALETA_E_LOGO.pdf` — logomarca circular, vermelho `#F51D2A`, vermelho profundo `#BB071D`, preto/branco/cinza, “VAMOS JUNTOS.”
3. Capturas originais para preservar fluxos reais

## Alterações isoladas nesta branch

| Superfície | Caminho | Escopo |
| --- | --- | --- |
| Motorista | `scripts/apply-partner-motorista-premium-home-v1.mjs` | Cabeçalho com logo oficial, disponibilidade real, mapa original, indicadores do dia reais e quatro rotas existentes |
| Entregador | `scripts/apply-partner-courier-premium-home-v1.mjs` | Mover **o mesmo** controle de disponibilidade (com proteção de entrega ativa) para cima do mapa e acrescentar resumo usando dados existentes |
| Seletor | `superapp/partner-shell/index.html` | Identidade e slogan aprovados; links, roteamento por função e trava operacional intactos |
| Integração | `scripts/build-partner-release.sh` | Aplicar os dois ajustes por último, somente em `.work/partner-*`, sem editar `sources/` |
| Segurança | `scripts/qa/test-partner-*-premium-home-v1.test.mjs` e auditorias v16/v21/v26 | Testes de âncoras, duplicidade, fluxo operacional e identidade visual |
| CI pré-APK | `.github/workflows/apois-motorista-pdf-qa-no-apk.yml` | `verify:pins`, `audit:partner`, `audit:ui`, build/TS typecheck e navegador com rede externa bloqueada |

## Evidências executadas no GitHub

Run **45103956514** concluiu com sucesso:

- Checkout e verificação dos commits fixados das três fontes protegidas
- Verificação de sintaxe e testes dos dois transformadores premium
- Auditorias de políticas/identidade/layout `audit:partner` e `audit:ui`
- Compilação web de Motorista e Entregador a partir das cópias efêmeras, incluindo verificações do TypeScript
- Verificação de assets e shell do APOIS Parceiro
- Chromium isolado para seletor, login Motorista e login Entregador nas larguras 320, 360, 390 e 1280 px: **12/12 renderizações aprovadas**, sem rolagem horizontal, exceção JavaScript ou erro em asset local
- Capturas do navegador guardadas no artefato GitHub `apois-premium-parceiro-web-captures-ed89312fa3066dcc8ea0cacd0efed6483f518bb4`

**Limites:** testes web anônimos não confirmam aparência de telas autenticadas nem GPS, PIN, Push, mapas ou operação com aparelho físico. O workflow nativo pode detectar falhas próprias de Gradle/Android; não equiparar sucesso web a APK pronto.

## Como gerar o APK de teste quando for solicitado

1. Abrir GitHub → Actions → **APOIS Parceiro Android APK**: https://github.com/apoistecnologia-gif/apois-superapp/actions/workflows/apois-partner-android.yml
2. Selecionar **Run workflow** e a branch `feat/apois-motorista-premium-visual-20261122`
3. Executar o workflow manualmente; manter assinaturas e segredos QA já configurados. Não usar uma nova keystore
4. Conferir o sucesso do `assembleDebug`, certificado SHA-256 pinado, nome/pacote `br.com.apois.parceiro`, versão, serviços nativos de GPS Motorista/Entregador, árvore de assets e saída `APOIS-Parceiro-TESTE.apk`
5. Baixar o artefato `APOIS-Parceiro-TESTE`. **Não promover a produção.**

## Homologação física obrigatória antes de publicação

- Motorista: sessão/login/Google; Online/Offline e permissões; GPS parado e em movimento; mapa e retorno de Maps/Waze; oferta aceitar/recusar; chegada; PIN inválido e válido; cancelamento; corrida ativa e finalização; ganhos e perfil
- Entregador: disponibilidade com proteção durante entrega; ofertas; aceite e coleta; roteamento e retorno; confirmação/PIN; conclusão; ganhos; sessão/Push; teste com GPS sem deslocamento
- Parceiro: troca Motorista/Entregador apenas quando permitido; deep link/Push; Android botão Voltar e safe-area; reinício/bloqueio da tela
- Comparar telas autenticadas com todas as páginas do PDF aprovado e capturas originais. Corrigir visual somente na branch isolada, nunca silenciar erro para promover a build

**Conclusão:** a **etapa web de pré-compilação passou** e a branch está preparada para solicitar uma **compilação Android de homologação**. O APK atual, a aderência visual em estados autenticados e a regressão funcional no aparelho permanecem não verificados até a execução dos passos acima.
