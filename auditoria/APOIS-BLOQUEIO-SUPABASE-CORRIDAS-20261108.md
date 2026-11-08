# APOIS — bloqueio de configuração Supabase Corridas (08/11/2026)

## Evidências verificadas

- A conexão Supabase associada ao usuário lista `APOIS CORRIDAS - PRODUÇÃO` com project ref `tbbzkrfupmqdywnzgnms` e estado saudável.
- A mesma conexão lista `APOIS ENTREGAS - PRODUÇÃO` com project ref `ptgkwyyolrdgnqketkjj` e estado saudável.
- O snapshot protegido `apoistecnologia-gif/movvi-go-connect@9fc17105` possui `.env.mobile` apontando para `vqtucstyduxrqjgyigfk`. A chave pública desse arquivo **não corresponde** às chaves públicas ativas listadas para o atual projeto Corridas (comparação realizada sem expor os valores).
- `scripts/build-motorista-module.mjs` ainda exige a referência antiga `vqtucstyduxrqjgyigfk`.
- `scripts/build-partner-modules.sh` exige URL `tbbzkrfupmqdywnzgnms` na entrada, porém compara a chave pública com a do `.env.mobile` antigo e exige `vqtucstyduxrqjgyigfk` no bundle, combinação contraditória.

## Impacto

Não é seguro declarar o login do Motorista homologado, nem publicar APK ou módulo com essas referências divergentes. A falta de ambiente autenticado continua bloqueando a validação de D-004 e D-005.

## Situação da branch de correção

A ponte de sessão gerada por `build-motorista-module.mjs` passou a derivar o nome da chave local do Supabase **da URL efetivamente usada no build**, em vez de usar uma referência fixa. **Isso não substitui a correção da configuração do projeto, nem implica validação de autenticação.**

Nenhuma chave, conta, dado de produção, migration, RLS, pagamento ou serviço Supabase foi modificado.

## Ação segura antes da publicação

1. Conciliar o destino oficial Corridas com todas as configurações do build, Vercel e Codemagic.
2. Substituir somente por variáveis de ambiente autorizadas a URL e a chave pública do mesmo projeto; não transportar credenciais secretas para o frontend.
3. Retirar comparações contra a chave do snapshot antigo somente após escolher uma verificação segura da identidade do projeto e manter o build fail-closed.
4. Executar smoke de login, cadastro, histórico e autorização com contas **sintéticas** e ambiente isolado.
5. Só depois atualizar pins/branch release, com revisão humana e sem deploy automático.

**Status:** BLOQUEADO POR CONFIGURAÇÃO / SEM AUTORIZAÇÃO PARA ALTERAR DESTINO DE PRODUÇÃO. Não declarar corrigido ou homologado.
