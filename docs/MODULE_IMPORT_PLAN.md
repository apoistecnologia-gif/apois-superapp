# Importação segura dos módulos

O Superapp mantém os três produtos de origem protegidos. A integração inicial usa commits fixados, sem alterar os repositórios originais.

## Commits de referência

- Entregas: `835772994e2c9828dbcef759016c4fad613090e4`
- Corridas Passageiro: `c25dd67464f0913da3dfbe5504ec018d6ff8dfec`
- Corridas Motorista/Admin: `d10008ec86da135512e70aa6f3c0dc954922af9c`

## Ordem de validação

1. Fixar os três módulos em `apps/`.
2. Validar dependências e build de cada módulo sem alterações funcionais.
3. Validar que cada módulo continua apontando para seus backends atuais.
4. Somente então conectar o shell do Superapp aos módulos.
5. Autenticação compartilhada será uma fase posterior.
