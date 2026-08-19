# APOIS Superapp

Aplicativo Android unificado da APOIS que reúne **Corridas** e **Entregas** em um único package (`br.com.apois.app`) sem reescrever nem alterar diretamente os projetos de origem.

## Arquitetura atual

O repositório funciona como uma camada de integração segura:

```text
sources/
  apois-corridas-passageiro/   # snapshot protegido por submodule
  apois-corridas-motorista-admin/
  apois-entregas/              # snapshot protegido por submodule

.work/
  corridas/                    # cópia descartável adaptada no build
  entregas/                    # cópia descartável adaptada no build

superapp/
  branding/                    # arte oficial do launcher
  shell/                       # shell único Capacitor / Android
    dist/
      modules/
        corridas/
        entregas/

scripts/
  prepare-workspace.mjs
  adapt-module-for-superapp.mjs
  build-isolated-module.mjs
  inject-superapp-push-routing.mjs
  audit-superapp-static.mjs
  audit-superapp-hardening.mjs
  audit-superapp-play-store.mjs
  verify-superapp-dist.mjs
  verify-superapp-policy.mjs
  configure-superapp-android.mjs
  install-superapp-launcher.mjs
```

A regra principal é: **nunca adaptar os submodules em `sources/` diretamente**. Cada módulo é copiado para `.work/`, adaptado, compilado e somente o bundle final entra no shell.

## Fontes protegidas

- Entregas: `franciel046631/apois-entregas` (`main`)
- Corridas / Passageiro: `franciel046631/say-hello-buddy-23-84b5dcbf` (`feat/apois-passageiro-completo`)
- Corridas / Motorista/Admin: `franciel046631/movvi-go-connect` (`fix/apois-corridas-consolidacao`)

Os commits efetivamente usados são os commits dos submodules registrados neste repositório. `npm run verify:pins` impede que o build use uma fonte diferente da fixada.

## Shell e navegação

Ao abrir o app, o shell mostra dois produtos:

- **Corridas**
- **Entregas**

Cada produto mantém sua sessão isolada, sua última rota válida e seu backend atual. O botão Voltar do Android retorna ao shell quando o usuário chega à raiz do módulo.

As rotas autenticadas não são retomadas sem uma sessão persistida válida. Rotas públicas de login, cadastro, recuperação e callback permanecem acessíveis.

## Autenticação e deep links

O package nativo unificado usa o esquema:

```text
br.com.apois.app://auth/...
```

O shell distribui os callbacks para o módulo correto. Entregas usa callback, redefinição de senha e confirmação de alteração de e-mail. Corridas possui fluxo próprio de recuperação encaminhado pelo bridge do Superapp.

A confirmação de alteração de e-mail de Entregas passa primeiro por `#/auth/callback`, onde a sessão é efetivamente trocada, antes de retornar aos dados pessoais.

## Pagamentos no Superapp

No cliente, os módulos Corridas e Entregas são **PIX-only**. Qualquer método legado existente nas fontes protegidas é filtrado somente na cópia `.work`, sem modificar os aplicativos originais.

O backend continua sendo a fonte confiável do pagamento e do despacho. Uma corrida PIX não deve entrar em despacho antes da confirmação de pagamento.

## Push unificado

Corridas e Entregas compartilham o mesmo package Android e, consequentemente, o mesmo token FCM nativo. Por isso o Superapp aplica isolamento adicional:

- o payload é classificado por produto;
- payload ambíguo é ignorado;
- push de Corridas recebido dentro de Entregas é encaminhado para Corridas;
- push de Entregas recebido dentro de Corridas é encaminhado para Entregas;
- logout de Entregas remove o vínculo de Entregas no backend sem executar `PushNotifications.unregister()`, preservando o token nativo compartilhado.

O Push próprio de Corridas permanece **desabilitado por padrão** (`APOIS_SUPERAPP_RIDES_PUSH_ENABLED=0`) até a identidade do Firebase server-side ser comprovadamente compatível com o Firebase do package unificado.

## Endereço e Google Maps

Entregas usa Geolocation nativo do Capacitor no APK. Reverse geocode, autocomplete e place details passam pela Edge Function `google-maps-address` autenticada.

A função consome `consume_google_maps_lookup_quota()` antes da consulta e limita a operação a 120 consultas por minuto por usuário ativo. `anon` não possui execução da RPC.

O build exige chaves separadas para os contextos Android e Web/JavaScript:

```text
CORRIDAS_ANDROID_MAPS_API_KEY
CORRIDAS_WEB_MAPS_API_KEY
```

Em produção elas devem ter restrições adequadas ao respectivo uso.

## Privacidade e exclusão de conta

O cliente de Entregas possui caminho interno de solicitação de exclusão em **Perfil → Dados pessoais → Excluir minha conta**. A solicitação é registrada no backend e o token Push vinculado ao usuário é removido antes do logout.

Também existem recursos públicos no Supabase Entregas para configuração da ficha da Google Play:

```text
https://sbvhdgyuuperszlsllji.supabase.co/functions/v1/privacy-policy
https://sbvhdgyuuperszlsllji.supabase.co/functions/v1/account-deletion
```

A segunda URL permite solicitar exclusão mesmo sem acesso ao aplicativo e não revela se o e-mail informado possui conta.

## Branding Android

O launcher usa `superapp/branding/apois-launcher.png` como fonte oficial. O build gera tamanhos Android corretos por densidade:

| Densidade | Launcher legacy | Foreground adaptive |
|---|---:|---:|
| mdpi | 48×48 | 108×108 |
| hdpi | 72×72 | 162×162 |
| xhdpi | 96×96 | 216×216 |
| xxhdpi | 144×144 | 324×324 |
| xxxhdpi | 192×192 | 432×432 |

A splash nativa usa a mesma arte oficial sobre fundo preto. Bitmaps padrão do Capacitor/Android são removidos antes do build para evitar reaparecimento do ícone padrão.

## Android / Google Play

O projeto nativo é recriado pelo Capacitor no Codemagic e recebe hardening determinístico antes do release:

- `applicationId`: `br.com.apois.app`;
- label: `APOIS`;
- `compileSdk` e `targetSdk`: API 36;
- `allowBackup=false`;
- cleartext HTTP bloqueado;
- sem `ACCESS_BACKGROUND_LOCATION`;
- teclado com `adjustResize`;
- versionamento por `APP_VERSION_CODE` e `APP_VERSION_NAME`;
- launcher/adaptive icon e splash validados;
- assinatura final comparada com o SHA-1 esperado.

O release também executa `zipalign -v -c -P 16 4` no APK assinado para validar o empacotamento exigido em dispositivos com páginas de memória de 16 KB.

## Build do bundle unificado

Com os submodules inicializados e as variáveis necessárias disponíveis:

```bash
npm run verify:pins
npm run build:superapp
```

`build:superapp` executa, nesta ordem:

1. auditoria estática;
2. validação dos pins protegidos;
3. auditoria de hardening;
4. auditoria de produção/Google Play;
5. gate de compatibilidade Firebase do Push Corridas;
6. build isolado de Corridas;
7. build isolado de Entregas;
8. montagem do shell;
9. hardening de deep links;
10. injeção do roteamento global de Push;
11. validações pós-build de estrutura, políticas, storage, auth/deep links, segurança do cliente, endereço e assets de notificações.

O shell falha o build se qualquer bundle ou contrato obrigatório estiver ausente.

## Verificações disponíveis

```bash
npm run sources:status
npm run status:modules
npm run audit:static
npm run audit:hardening
npm run audit:play-store
npm run verify:pins
npm run verify:dist
```

## Codemagic

Workflow configurado:

```text
android-superapp-experimental
```

O workflow:

- fixa Bun em `1.3.14`;
- inicializa e valida os submodules protegidos;
- valida variáveis externas com mensagens explícitas;
- compila Corridas + Entregas + shell;
- cria o projeto Capacitor Android;
- configura Maps, deep links, Firebase e permissões;
- fixa API 36 e versionamento;
- gera launcher por densidade e valida dimensões PNG;
- compila `assembleRelease` e `bundleRelease`;
- assina e valida o APK;
- valida SHA-1 da assinatura;
- valida o empacotamento 16 KB do APK;
- assina e verifica o AAB;
- publica `APOIS-Superapp.apk` e `APOIS-Superapp.aab` como artefatos.

## Variáveis externas obrigatórias para release Android

```text
CORRIDAS_VITE_SUPABASE_URL
CORRIDAS_VITE_SUPABASE_PUBLISHABLE_KEY
CORRIDAS_PUBLIC_APP_URL
VITE_SUPABASE_URL
VITE_SUPABASE_PUBLISHABLE_KEY
CORRIDAS_WEB_MAPS_API_KEY
CORRIDAS_ANDROID_MAPS_API_KEY
FIREBASE_SUPERAPP_GOOGLE_SERVICES_JSON_BASE64
```

Além das variáveis de assinatura fornecidas pelo Codemagic:

```text
CM_KEYSTORE_PATH
CM_KEYSTORE_PASSWORD
CM_KEY_ALIAS
CM_KEY_PASSWORD
```

`CORRIDAS_PUBLIC_APP_URL` precisa ser uma URL pública **HTTPS** em modo de release estrito.

`FIREBASE_SUPERAPP_GOOGLE_SERVICES_JSON_BASE64` precisa representar um `google-services.json` que contenha o cliente Android compatível com `br.com.apois.app`.

## Gate antes do release

O artefato só deve ser liberado quando:

- `verify:pins` estiver verde;
- `build:superapp` estiver verde;
- configuração nativa estiver verde em modo estrito;
- Firebase mobile estiver confirmado para `br.com.apois.app`;
- Maps Android/Web estiverem configurados;
- `CORRIDAS_PUBLIC_APP_URL` estiver definida em HTTPS;
- launcher/splash passarem pelas validações de densidade;
- assinatura final corresponder ao SHA-1 esperado;
- APK passar pelo check de empacotamento 16 KB;
- AAB estiver assinado e verificado.

Enquanto algum desses itens depender de credencial externa ainda não confirmada, o repositório deve continuar sendo corrigido e validado sem fingir que o release já está homologado.
