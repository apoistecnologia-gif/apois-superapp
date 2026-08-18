# APOIS Superapp

Repositório de integração criado para reunir os módulos **APOIS Corridas** e **APOIS Entregas** sem alterar os repositórios originais.

## Regra de segurança

Os projetos de origem permanecem independentes e não devem ser modificados como parte da integração inicial. Todo trabalho de junção acontece neste repositório.

## Fontes preservadas

- APOIS Entregas: `franciel046631/apois-entregas` — branch `main`
- APOIS Corridas — Motorista/Admin: `franciel046631/movvi-go-connect` — branch `fix/apois-corridas-consolidacao`
- APOIS Corridas — Passageiro: `franciel046631/say-hello-buddy-23-84b5dcbf` — branch `feat/apois-passageiro-completo`

## Estrutura alvo

```text
apps/
  corridas-passageiro/
  corridas-motorista-admin/
  entregas/
shared/
  auth/
  ui/
  navigation/
  profile/
superapp/
  shell/
```

## Estratégia

1. Copiar cada módulo para sua própria pasta, sem alterar sua lógica.
2. Validar cada módulo isoladamente dentro deste repositório.
3. Criar a entrada única da APOIS com escolha entre Corridas e Entregas.
4. Unificar autenticação e perfil somente depois dos módulos estarem estáveis.
5. Preservar backends e bancos atuais até a integração estar homologada.

## Estado inicial

O repositório foi inicializado como ambiente seguro de integração. Nenhuma alteração foi feita nos repositórios originais.
