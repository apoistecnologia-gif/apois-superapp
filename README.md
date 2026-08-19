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

Ao abrir o APK, o shell mostra dois produtos:

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

## Pagamento de Corridas no Superapp

No módulo Corridas do Superapp, a interface aceita **somente PIX**. A adaptação ocorre exclusivamente em `.work/corridas`; o projeto de origem não é alterado.

O backend continua sendo a fonte confiável do pagamento e do despacho. Uma corrida PIX não deve entrar em despacho antes da confirmação de pagamento.

## Push unificado

Corridas e Entregas compartilham o mesmo package Android e, consequentemente, o mesmo token FCM nativo. Por isso o Superapp aplica isolamento adicional:

- o payload é classificado por produto;
- payload ambíguo é ignorado;
- push de Corridas recebido dentro de Entregas é encaminhado para Corridas;
- push de Entregas recebido dentro de Corridas é encaminhado para Entregas;
- logout de Entregas remove o vínculo de Entregas no backend sem executar `PushNotifications.unregister()`, preservando o token nativo compartilhado.

## Google Maps

O build exige chaves separadas para os contextos Android e Web/JavaScript:

```text
CORRIDAS_ANDROID_MAPS_API_KEY
CORRIDAS_WEB_MAPS_API_KEY
```

Em produção elas devem ter restrições adequadas ao respectivo uso.

## Branding Android

O launcher usa `superapp/branding/apois-launcher.png` como fonte oficial. O build gera tamanhos Android corretos por densidade:

| Densidade | Launcher legacy | Foreground adaptive |
|---|---:|---:|
| mdpi | 48×48 | 108×108 |
| hdpi | 72×72 | 162×162 |
| xhdpi | 96×96 | 216×216 |
| xxhdpi | 144×144 | 324×324 |
| xxxhdpi | 192×192 | 432×432 |

A splash nativa usa a mesma arte oficial sobre fundo preto. Bitmaps padrão do Capacitor/Android são removidos antes do build para evitar reaparecimento do ícone branco/azul padrão.

## Build do bundle unificado

Com os submodules inicializados e as variáveis necessárias disponíveis:

```bash
npm run verify:pins
npm run build:superapp
```

`build:superapp` executa:

1. auditoria estática;
2. validação dos pins dos módulos;
3. build isolado de Corridas;
4. build isolado de Entregas;
5. montagem do shell;
6. injeção do roteamento global de Push;
7. validação estrutural e de políticas do resultado final.

O shell falha o build se qualquer bundle obrigatório estiver ausente.

## Verificações disponíveis

```bash
npm run sources:status
npm run status:modules
npm run audit:static
npm run verify:pins
npm run verify:dist
```

`verify:dist` também verifica regras específicas do Superapp, incluindo PIX-only em Corridas, isolamento de Push e espaço de safe-area/rodapé em telas adaptadas de Entregas.

## Codemagic

Workflow configurado:

```text
android-superapp-experimental
```

O workflow:

- fixa Bun em `1.3.14`;
- inicializa e valida os submodules protegidos;
- valida variáveis externas;
- compila Corridas + Entregas + shell;
- cria o projeto Capacitor Android;
- configura Maps, deep links, Firebase e permissões;
- gera launcher por densidade e valida as dimensões PNG;
- compila APK Release;
- assina com o keystore configurado;
- valida o SHA-1 da assinatura;
- publica `APOIS-Superapp.apk` como artefato.

## Variáveis externas obrigatórias para release Android

As seguintes configurações não podem ser inventadas pelo código e precisam existir no ambiente de build:

```text
CORRIDAS_VITE_SUPABASE_URL
CORRIDAS_VITE_SUPABASE_PUBLISHABLE_KEY
VITE_SUPABASE_URL
VITE_SUPABASE_PUBLISHABLE_KEY
CORRIDAS_WEB_MAPS_API_KEY
CORRIDAS_ANDROID_MAPS_API_KEY
CORRIDAS_PUBLIC_APP_URL
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

`FIREBASE_SUPERAPP_GOOGLE_SERVICES_JSON_BASE64` precisa representar um `google-services.json` que contenha exatamente o cliente Android compatível com `br.com.apois.app`.

## Gate antes de gerar APK

O APK só deve ser liberado quando:

- `verify:pins` estiver verde;
- `build:superapp` estiver verde;
- configuração nativa estiver verde em modo estrito;
- Firebase estiver confirmado para `br.com.apois.app`;
- Maps Android/Web estiverem configurados;
- `CORRIDAS_PUBLIC_APP_URL` estiver definida em HTTPS;
- launcher/splash passarem pelas validações de densidade;
- assinatura final corresponder ao SHA-1 esperado.

Enquanto algum desses itens depender de credencial externa ainda não confirmada, o repositório deve continuar sendo corrigido e validado sem fingir que o release já está homologado.
