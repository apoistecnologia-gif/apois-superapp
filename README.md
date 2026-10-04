# APOIS Superapp

Aplicativos Android unificados da APOIS, construídos sem alterar diretamente os projetos de origem protegidos.

Existem somente duas superfícies móveis oficiais:

- **APOIS Superapp** (`br.com.apois.app`): Passageiro de Corridas + Cliente de Entregas.
- **APOIS Parceiro** (`br.com.apois.parceiro`): Motorista de Corridas + Entregador de Entregas.

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
  partner-motorista/
  partner-entregador/

superapp/
  branding/
  shell/                       # APOIS Superapp
  partner-shell/               # APOIS Parceiro
```

A regra principal é: **nunca adaptar os submodules em `sources/` diretamente**. Cada módulo é copiado para `.work/`, adaptado, auditado e compilado. Os projetos-fonte permanecem protegidos.

## Fontes protegidas

- Entregas: `franciel046631/apois-entregas`
- Corridas / Passageiro: `franciel046631/say-hello-buddy-23-84b5dcbf`
- Corridas / Motorista/Admin: `franciel046631/movvi-go-connect`

Os commits efetivamente usados ficam fixados em `.apois/source-lock.json`. `npm run verify:pins` impede que um build consuma fonte diferente da homologada.

## Navegação unificada

### APOIS Superapp

Ao abrir o app, o shell permite entrar em:

- **Corridas**
- **Entregas**

Cada produto mantém sessão e rota isoladas. O botão Voltar do Android retorna ao shell quando o usuário chega à raiz do módulo. Rotas autenticadas não são retomadas sem sessão válida.

### APOIS Parceiro

O shell oferece:

- **Motorista**
- **Entregador**

A troca de função é bloqueada enquanto houver operação ativa ou presença ONLINE. O app preserva a função operacional em reinício, Push e deep link até o backend confirmar que a operação foi encerrada.

Não existem mais workflows oficiais para APKs separados de Motorista e Entregador.

## Autenticação e deep links

O Superapp usa:

```text
br.com.apois.app://auth/...
```

O Parceiro usa:

```text
br.com.apois.parceiro://...
```

Os shells distribuem callbacks para o módulo correto e evitam que um callback ou Push da outra função rompa uma jornada ativa.

## Política financeira final

### Corridas

Corridas **não é PIX-only**.

O passageiro pode usar os meios ativos previstos pela política final:

- **PIX**: fluxo eletrônico integrado;
- **Dinheiro**: pagamento direto ao motorista;
- **Cartão de crédito**: pagamento direto ao motorista, sem custódia da APOIS.

A APOIS não retém comissão por corrida. A monetização do Motorista é feita pela mensalidade da plataforma.

### Entregas

Pedidos do Cliente permanecem **PIX-only**. Para pedidos novos:

- o estabelecimento precisa estar conectado ao Mercado Pago via OAuth;
- o checkout valida `merchant-payment-readiness` antes de criar a cobrança;
- a cobrança usa `create-merchant-mercadopago-pix` diretamente para a conta Mercado Pago do estabelecimento;
- OpenPix/Asaas não podem reaparecer como caminho de novos pedidos;
- a APOIS não recebe o valor integral da venda para repassar depois.

Enquanto o repasse direto do Entregador não estiver homologado como `marketplace_direct_live`, a opção **Entrega** permanece bloqueada pelo readiness financeiro. Esse bloqueio é proposital e não deve ser contornado.

## Push unificado

Corridas e Entregas compartilham o package do Superapp e o mesmo token FCM nativo. Motorista e Entregador fazem o mesmo dentro do APOIS Parceiro. Por isso os runtimes:

- classificam o payload por produto/função;
- ignoram payload ambíguo;
- encaminham Push para o módulo correto;
- não executam `PushNotifications.unregister()` apenas porque um módulo foi encerrado;
- preservam a trava da função operacional quando necessário.

## Endereço, GPS e mapas

Entregas usa Geolocation nativo do Capacitor no APK. Reverse geocode, autocomplete e place details passam pela Edge Function autenticada `google-maps-address`.

Motorista e Entregador utilizam serviços nativos de localização em foreground durante operação ONLINE. O app só considera o serviço iniciado depois de ACK real do Foreground Service e mantém sincronização de sessão entre WebView e serviço Android.

O build exige chaves separadas para os contextos Android e Web/JavaScript:

```text
CORRIDAS_ANDROID_MAPS_API_KEY
CORRIDAS_WEB_MAPS_API_KEY
```

## UI móvel

Os builds executam auditorias de interface para impedir regressões conhecidas:

- logo sem corte (`object-fit: contain`);
- seletores roláveis em telas baixas;
- uso de `100dvh` em vez de `100vh` fixo nas telas do Cliente;
- safe-area superior e inferior;
- rodapés persistentes onde devem existir;
- rodapé oculto durante jornadas operacionais quando necessário;
- alvos de toque mínimos nos principais controles;
- QR Pix responsivo em telas estreitas;
- remoção de menus/atalhos duplicados;
- remoção de opções desabilitadas que não representam funcionalidade real;
- mapas e cards dimensionados para viewport móvel.

## Privacidade e exclusão de conta

O cliente de Entregas possui caminho interno de solicitação de exclusão em **Perfil → Dados pessoais → Excluir minha conta**. A solicitação é registrada no backend e o vínculo Push do módulo é removido sem invalidar o token compartilhado de outros módulos.

## Android / Google Play

Os projetos nativos são recriados pelo Capacitor no Codemagic e recebem hardening determinístico antes do release:

- `br.com.apois.app` para Cliente;
- `br.com.apois.parceiro` para Parceiro;
- API 36;
- `allowBackup=false`;
- cleartext HTTP bloqueado;
- teclado com `adjustResize`;
- launcher/adaptive icon e splash APOIS;
- validação de Firebase e Maps;
- assinatura e `zipalign` verificados.

O Parceiro não solicita `ACCESS_BACKGROUND_LOCATION`; o rastreamento operacional usa Foreground Services de localização.

## Builds oficiais

Os únicos workflows móveis oficiais em `codemagic.yaml` são:

```text
android-superapp-experimental
android-partner-superapp
```

Artefatos:

```text
APOIS-Superapp.apk
APOIS-Superapp.aab
APOIS-Parceiro.apk
```

Não há workflow oficial para `APOIS-Motorista.apk` ou `APOIS-Entregador.apk` separados.

## Validações

```bash
npm run verify:pins
npm run audit:static
npm run audit:ui
npm run audit:hardening
npm run audit:partner
npm run audit:play-store
npm run audit:release-integrity
npm run verify:dist
```

`build:superapp` executa os gates do Cliente antes e depois da compilação. `build:partner` executa auditorias de Motorista/Entregador, UI e pins antes de montar o shell Parceiro.

## Variáveis externas de release

Cliente:

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

Parceiro também exige:

```text
FIREBASE_PARTNER_GOOGLE_SERVICES_JSON_BASE64
```

Além das variáveis de assinatura fornecidas pelo Codemagic:

```text
CM_KEYSTORE_PATH
CM_KEYSTORE_PASSWORD
CM_KEY_ALIAS
CM_KEY_PASSWORD
```

## Gate antes do release

Um artefato só deve ser tratado como validado depois que o respectivo workflow real do Codemagic concluir sem falhas. Auditoria estática não substitui compilação Android nem teste físico em aparelho.
