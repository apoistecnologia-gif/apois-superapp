# Content-Security-Policy — superfícies web APOIS

## Escopo inicial

A CSP é aplicada no artefato final dos shells `APOIS Cliente` e `APOIS Parceiro`, incluindo os HTMLs dos módulos copiados para `dist/modules/*`. Isso protege tanto a superfície web empacotada no Capacitor/WebView quanto o mesmo artefato quando servido por HTTP.

A política é aplicada **depois** da montagem dos bundles. No `build:superapp`, ela é aplicada novamente depois das injeções finais de auth/push para que os hashes continuem correspondendo ao HTML efetivamente publicado.

## Inventário de dependências permitidas

### Supabase

Uso frontend confirmado: autenticação, REST/Functions e Realtime dos módulos. A CSP permite somente:

- `https://*.supabase.co`
- `wss://*.supabase.co`

A URL/projeto concreto continua vindo da configuração de cada módulo; a CSP não contém chave nem segredo.

### Google Maps / Places

O módulo Corridas usa Maps JavaScript/Places e o ecossistema Google associado. Para não quebrar carregamento de tiles, bibliotecas e chamadas do Places, são permitidos:

- scripts: `https://maps.googleapis.com`, `https://maps.gstatic.com`
- conexões: `https://maps.googleapis.com`, `https://places.googleapis.com`, `https://*.googleapis.com`, `https://maps.gstatic.com`, `https://*.gstatic.com`
- imagens: `https://maps.googleapis.com`, `https://maps.gstatic.com`, `https://*.googleusercontent.com`

As chaves web do Google Maps continuam obrigatoriamente restritas no Google Cloud por API/origem. CSP não substitui a restrição da chave.

### Assets Vite / bundles locais

JS, CSS, manifest e demais assets produzidos pelo Vite/TanStack/Nitro são carregados de `'self'`.

`blob:` é permitido apenas onde necessário para workers/media/imagens geradas pelo runtime.

### Imagens

São permitidos:

- `'self'`
- `data:` para ícones/logos embutidos e branding do shell Parceiro
- `blob:` para conteúdo temporário criado no runtime
- Google Maps/Gstatic e `*.googleusercontent.com` para Maps e avatares Google

Não existe wildcard geral `https:` em `img-src`.

### Fonts

Os shells usam principalmente fontes de sistema. `fonts.googleapis.com`/`fonts.gstatic.com` permanecem permitidos de forma compatível caso um módulo carregue Google Fonts. Nenhuma origem arbitrária de fontes é liberada.

### Capacitor / WebView

Os dois shells mantêm `android.allowMixedContent: false`. A CSP é inserida como `<meta http-equiv="Content-Security-Policy">`, pois esse mecanismo também é aplicado dentro do WebView empacotado, onde um header HTTP do servidor não existe.

`'self'` cobre o origin do documento carregado pelo runtime Capacitor. Não foi habilitado `http:` global nem mixed content.

### APIs externas financeiras

Mercado Pago, OpenPix/Woovi, Asaas, Safe2Pay e Celcoin são integrações **server-side**. As respectivas APIs não fazem parte de `connect-src` do frontend.

O verificador falha se encontrar no artefato final origens financeiras conhecidas como `api.mercadopago.com`, `api.openpix.com.br`, `api.woovi-sandbox.com`, `api.asaas.com`, `api.safe2pay.com.br` ou `api.celcoin.com.br`.

## Estratégia incremental

### `script-src`

`unsafe-eval` é proibido.

Também não usamos `unsafe-inline` em `script-src`. Durante o build, cada `<script>` inline sem `src` recebe autorização por hash SHA-256 calculado sobre o conteúdo exato do artefato final. Isso permite preservar os scripts legados/ponte dos shells sem abrir execução inline arbitrária.

Se uma etapa posterior alterar um script inline e não reaplicar a CSP, `verify-web-csp.mjs` falha porque o hash deixa de corresponder.

### `style-src`

`'unsafe-inline'` permanece temporariamente em `style-src`.

Exceção necessária nesta fase porque:

- os shells atuais contêm `<style>` inline;
- componentes React usam `style={...}` / propriedades inline em runtime;
- Google Maps injeta estilos dinamicamente.

Remover essa exceção agora exigiria refatorar estilos para folhas externas e adotar nonce/arquitetura compatível também para estilos criados em runtime. Essa mudança deve ser feita separadamente e homologada visualmente antes de endurecer a diretiva.

## Verificação automatizada

`apply-web-csp.mjs`:

1. percorre todos os HTMLs do artefato;
2. calcula hashes SHA-256 dos scripts inline;
3. insere/substitui a meta CSP.

`verify-web-csp.mjs` falha quando:

- um HTML não possui CSP;
- aparece `unsafe-eval`;
- `script-src` contém `unsafe-inline`;
- uma diretiva/origem obrigatória desaparece;
- um script inline não possui hash correspondente;
- uma origem financeira server-side aparece no frontend;
- `android.allowMixedContent` deixa de ser `false`.

Comandos:

```bash
npm run csp:apply:client
npm run csp:verify:client
npm run csp:apply:partner
npm run csp:verify:partner
```

`build:shell`, `build:partner` e `verify:dist` já executam as verificações correspondentes.

## Header HTTP em hospedagem web

A meta CSP protege o mesmo HTML no browser e no WebView. Para deployments web, o servidor/CDN deve enviar o **mesmo conteúdo** também no header HTTP `Content-Security-Policy`; o header tem precedência operacional e oferece cobertura antes do parser alcançar a meta.

Não foi adicionado um `vercel.json`, `_headers` ou configuração de provedor genérica no repositório porque as superfícies APOIS têm pipelines diferentes. A política está centralizada em `scripts/web-csp-policy.mjs`; a configuração específica do host deve reutilizar exatamente essa política em vez de manter uma segunda lista divergente.
