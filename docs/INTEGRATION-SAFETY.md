# Segurança da integração

## Regra principal

Os repositórios originais de Corridas e Entregas são fontes protegidas. Nenhuma integração deve fazer push neles.

## Cópias locais

`scripts/bootstrap-sources.sh` copia cada fonte para `apps/` e renomeia o remote para `source-origin`, com push desativado. Assim, desenvolvimento e testes acontecem somente no superapp.

## Ordem de homologação

1. Copiar fontes sem modificar lógica.
2. Registrar commit de origem de cada módulo.
3. Validar build isolado de cada módulo.
4. Criar shell/entrada única.
5. Integrar autenticação e perfil somente após os três módulos abrirem isoladamente.
6. Não migrar banco de dados na fase inicial.

## Rollback

Qualquer falha no superapp não afeta os repositórios originais. O superapp pode ser descartado sem perda do trabalho já homologado.
