# Corridas — Google OAuth no Superapp

## Fluxo efetivo

O login nativo do Passageiro usa Supabase Auth com **PKCE**:

`signInWithOAuth → Browser → callback → appUrlOpen/getLaunchUrl → exchangeCodeForSession`.

Callback canônico:

`br.com.apois.app://auth/callback`

Callback legado aceito somente para compatibilidade:

`br.com.apois.app://auth/corridas-google`

## Requisitos de robustez

A implementação efetiva do Superapp deve:

- configurar `flowType: "pkce"` no cliente Supabase usado pelo módulo;
- deduplicar a mesma URL de callback para não executar `exchangeCodeForSession` duas vezes;
- observar `browserFinished` para liberar o estado de loading quando o usuário fechar/cancelar o navegador;
- remover listeners no cleanup;
- manter `App.getLaunchUrl()` para cold start;
- encerrar loading e exibir feedback quando o OAuth falhar.

## Implementação de integração

Como o source de Corridas está protegido, `scripts/harden-corridas-superapp-google-auth.mjs` materializa a implementação no snapshot `.work/corridas` durante o build. Não deve existir uma segunda implementação concorrente no Superapp.

Após a homologação, a correção deve ser promovida ao source canônico em alteração própria, preservando histórico e pins do repositório de integração.
