# Fase 1 — integração segura

## Estado

Os três códigos de origem estão presos a commits exatos em `sources/` como snapshots Git somente leitura:

- Entregas: `835772994e2c9828dbcef759016c4fad613090e4`
- Corridas Passageiro: `c25dd67464f0913da3dfbe5504ec018d6ff8dfec`
- Corridas Motorista/Admin: `d10008ec86da135512e70aa6f3c0dc954922af9c`

Esses ponteiros não alteram os repositórios de origem. O desenvolvimento do superapp ocorre exclusivamente aqui.

## Shell inicial

`superapp/shell/index.html` é a primeira entrada neutra do APOIS, com escolha entre Corridas e Entregas. Ainda não muda autenticação, banco, push ou rotas de nenhum módulo.

## Próxima validação

1. materializar cada snapshot em área de trabalho própria;
2. preservar variáveis e backends separados;
3. validar build de cada módulo isoladamente;
4. conectar o shell ao módulo de Corridas e ao módulo de Entregas sem unificar banco;
5. somente depois estudar autenticação compartilhada.
