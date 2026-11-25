# Diagnóstico de regressão — Motorista

- Checkpoint acumulado: `6b0d31dcad5be9b7c7b9a8c651deeca98104b65f` (QA290, 23/11/2026).
- Execução Android aprovada: https://github.com/apoistecnologia-gif/apois-superapp/actions/runs/45122027174
- Recuperação atual analisada: `d3fa7c715baf338492d08a26bc867a75dc34213d`.
- Ambos usam o mesmo pin de fonte `9fc171050d8b5703540c49d19a8f1e9f5162775f` (26/08/2026). Não trocar o pin por uma branch de Admin sem provar equivalência funcional.

## Causa

A QA290 usava `scripts/build-partner-release.sh`. A recuperação usa `scripts/build-partner-modules.sh`, que não executa várias transformações acumuladas. A comparação de referências únicas de scripts .mjs entre a exportação do workspace Motorista e o primeiro build:motorista encontrou 199 na QA290, 30 na recuperação, 179 referências da QA290 ausentes na recuperação (inclui testes e verificadores, não equivale a 179 defeitos).

## Evidências de recuperação necessárias

- `scripts/apply-partner-premium-all-screens-v1.mjs` motorista: identidade e telas internas.
- `scripts/fix-partner-qa283-profile-ride-count-v1.mjs`: contagem por RPC autorizada; indisponível deve ser travessão.
- `scripts/fix-partner-qa284-driver-history-ui-v1.mjs`: resumo completo por período, concluídas/canceladas e contraste.
- `scripts/fix-partner-qa289-driver-offer-fallback-v1.mjs`: fallback de ofertas.
- `scripts/fix-partner-qa290-compact-offer-v1.mjs`: oferta compacta.
- Revisar também ordem e dependências dos patches de GPS, navegação externa, autenticação, perfil e segurança; não transplantar scripts isolados sem seus pré-requisitos.

## Restrições

Preservar a Home, boas-vindas e login aprovados, mapa de referência, identidade de assinatura SHA-256 já comprovada, pacote br.com.apois.parceiro e isolamento de Entregas. Sem merge, mutação do Supabase ou alteração do Cliente. Não gerar APK até autorização expressa; a compilação Android continua manual. Recuperação integral da QA290 ainda não executada neste checkpoint.
