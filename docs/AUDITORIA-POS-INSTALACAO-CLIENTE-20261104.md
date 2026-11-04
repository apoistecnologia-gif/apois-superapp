# APOIS — Auditoria após instalação física do Cliente (04/11/2026)

## Evidências verificadas
- O proprietário informou que instalou o APK Cliente com êxito; **não se afirma que login, Maps, pedido ou pagamento já funcionam**.
- APK examinado: `APOIS-Cliente-Atualizado-04-11-2026.apk`, package validado previamente como `br.com.apois.app`, versionCode `1001`, SHA-256 do arquivo `0669af349ace22e6b49b8f6e54d2b3b3bd9d9867869ada57411cb89de9609042`, 8.344.941 bytes, 644 entradas ZIP e teste CRC OK.
- Auditoria **direto no APK físico**, sem rede externa: 368 importações JavaScript estáticas, 40 imports literais dinâmicos, 4 imports de efeito lateral e 120 referências de preload Vite; **532 ligações locais verificadas, 0 caminhos ausentes**. URLs importadas computadas em tempo real não são cobertas por esta checagem.
- Varredura limitada dos arquivos HTML/JS/JSON embarcados por padrões típicos de chaves secretas Supabase `sb_secret_`, PEM privada, tokens GitHub, segredo Stripe, Safe2Pay e Mercado Pago: **nenhum padrão localizado**. Isso **não** constitui pentest ou garantia de que não haja outras exposições.
- Tentativa de renderização adicional em Chromium no contêiner local não produziu resultado: o navegador de execução bloqueou inclusive URLs data: com `ERR_BLOCKED_BY_ADMINISTRATOR`. **Não** contabilizar esse experimento como screenshot/renderização aprovada.

## Nova prevenção de regressões implementada
- Commit `97ed931d2a733691b0044391449610cc91e55953`: `scripts/qa/verify-partner-static-assets-v1.mjs` (motor comum ao Cliente e Parceiro) agora inspeciona importações ESM estáticas, importações literais dinâmicas (inclusive template literal) e mapas de dependência `__vite__mapDeps`, além de HTML/CSS. A ausência de chunks de telas internas/autenticadas aborta o build. Teste negativo/positivo `scripts/qa/test-js-module-asset-integrity-v1.mjs` integrado ao PostgreSQL/Node QA isolado.
- Commit `7fa8fc20a2d1c84b2aa4a1ef75a86041b318cfa3`: os workflows Android GitHub de **Cliente e Parceiro** passaram a extrair `assets/public` do **APK assinado final** e executar o verificador completo antes de publicar o artefato. Assim, um erro no empacotamento Capacitor também bloqueia a entrega do APK. `scripts/qa/test-android-apk-web-assets-gate-v1.mjs` exige os dois gates; ambas as workflows continuam **somente manual/dispatch** e preservam os bloqueios de assinatura original.
- CI do HEAD de código [41867783542](https://github.com/apoistecnologia-gif/apois-superapp/actions/runs/41867783542): **3/3 jobs SUCCESS**. Log de Cliente: `[PASS] Cliente bundle: 3 entrypoints, 555 linked local assets verified`. Log Parceiro: `[PASS] Partner bundle: 3 entrypoints, 212 linked local assets verified`. Testes sintéticos falharam corretamente quando um chunk JS estava ausente. Renderizações de **telas públicas anônimas** no runner GitHub têm `localFailures: []` nas 12 capturas Cliente em 320/360/390/1280 px. Estes resultados não incluem jornada autenticada nem teste Android nativo.
- A execução de push do APK Parceiro no GitHub foi **skipped**, conforme bloqueio manual de assinatura; nenhum Android novo gerado nesta rodada.

## Auditoria de permissões — leitura somente no banco
- Banco Entregas (`ptgkwyyolrdgnqketkjj`): bucket `avatars` é público; `courier-documents` privado.
- `storage.objects` tem policy INSERT `APOIS courier own profile avatar upload`, `TO authenticated`, restrita à pasta `<auth.uid()>/courier-profile/<arquivo jpg|png|webp>`, com verificação no servidor de usuário, entregador aprovado, entregador ativo e perfil ativo. A função de guarda usa `SECURITY DEFINER` e `search_path` vazio. **Não foi feito upload real**.
- `public.profiles` tem SELECT e UPDATE do próprio titular (`auth.uid() = id`). Não foi feita alteração de perfil nem de RLS.

## Pendências funcionais — manter explícitas
1. **Cliente Corridas**: login Google/senha, sessão após reinício, GPS real, rotas Maps, busca destino, cinco categorias, oferta/aceite, PIN, cancelamento/volta à busca, encerramento e pagamento direto requerem teste com contas de homologação no aparelho; nenhum sucesso simulado.
2. **Cliente Entregas**: login, endereço/CEP, checkout de teste, alertas Estabelecimento, courier online, rastreamento, PIN, avaliação e histórico requerem jornada autenticada e dados de teste; não disparar cobranças ou ordens reais desnecessárias.
3. **Parceiro**: a assinatura Android persistente ainda requer resolução própria, pois builds debug anteriores exibiram certificados divergentes. A recuperação da chave do **Cliente** não serve para atualização in-place do Parceiro.
4. **Admin Corridas**: credencial server-only para endpoint privado de documentos e verificação autenticada RBAC ainda pendentes; não promover homologação para domínio oficial.
5. **Produção Corridas**: Stage2 de aprovação das 13 fotos/idade do veículo deliberadamente NÃO aplicada sem validação física; nenhuma migração proposta executada.
6. **Financeiro**: Motorista R$59,90 novas contratações, Estabelecimento R$69,90, Entregador R$49,90; integrações de cobrança de parceiros ainda têm gates independentes. Não confundir preço exibido com mensalidade já cobrada.

## Escopo preservado
Nenhum usuário, pagamento, pedido, banco de produção, servidor, submódulo `sources/`, `.apois/source-lock.json`, assinatura APK, publicação, merge ou instalação física foi alterado nesta auditoria. Somente scripts de QA, workflows manuais e documentação. O APK já instalado **não** precisa ser substituído por causa dessas verificações; as melhorias protegem os próximos builds. Os problemas que o usuário relatar serão registrados com tela, ação, resultado observado, resultado esperado, diagnóstico e teste de regressão correspondente.

---

## Bug C-01 — Endereço de partida não identificado no APK (04/11/2026)

**Relato físico:** na Home Corridas do APK Cliente `br.com.apois.app` versionCode 1001, o mapa e indicador GPS aparecem, mas a origem exibe `Toque para tentar identificar o endereço` em lugar da rua. O usuário enviará incidentes um a um; não reproduzir coordenadas pessoais nem capturas no código.

**Evidência de servidor (somente leitura):** em 04/11/2026 às 16:22:07 UTC houve `POST /functions/v1/google-maps-address` **HTTP 500** vindo de Android WebView. Log da versão de produção **18** apontou `ECONNREFUSED` ao conectar com o provedor Photon na ação reverse geocode. A versão de produção foi recuperada via Supabase sem alteração. Não confundir falha do geocoder com GPS desligado: o mapa pode posicionar o usuário mesmo quando a conversão coordenadas→texto falha. O código versionado antigo não correspondia à versão ativa (Nominatim vs Photon), exigindo reconciliação segura.

**Patches em branch, ainda não instalados/deployados:** `1b2817e4` e `4443ccca` alteram mensagem de falha e diagnóstico HTTP; `2e9c21ac` insere CTA de tentar novamente na **Home realmente gerada** pelo `harden-corridas-kit-visual.mjs` (a transformação visual substituía a Home anterior); `11353645` corrige o gate para comparar JSX de destino realmente compilado. O botão de origem atual já fazia `refreshLocation(); void refreshAddress();`, e não deve ser confundido com o botão de destino.

**Tratamento do serviço remoto preparado, sem deploy:** `66e82b08` sincroniza o source versionado com Edge v18 e acrescenta APENAS **uma** repetição no Photon em caso de falha transitória de conexão/5xx, com timeout de 4s por tentativa e retorno HTTP 503 sem expor coordenadas nos logs quando esgotado; jamais repetir respostas 403/429, nem ativar API Google extra paga. Teste sintético `scripts/qa/test-photon-reverse-retry-v1.mjs` acompanha; mantém `verify_jwt=true`, quota, Google primário, autocomplete e place_details sem alterações de contrato.

**Risco residual:** Photon público é servidor de demonstração sem garantia de uptime; o retry pode contornar instabilidade breve, mas **não garante que endereço apareça se o serviço continuar indisponível**. Não substituir automaticamente pelo Nominatim público: a política OSMF exige restrições de frequência e proíbe usá-lo como serviço geral de rastreamento veicular. A solução definitiva de produção requer um provedor de geocodificação autorizado e confiável, sem habilitar novo faturamento sem aprovação. O app físico instalado não mudou nesta análise. Nenhum Supabase deploy/DDL, pagamento, API nova, source-lock ou APK foram modificados.

**Critérios para fechar o bug:** CI 3/3 no HEAD exato; Edge atualizado somente após controle de publicação; teste físico de tentativa→endereço real para posição com rua conhecida; cenário de erro remoto (ação de tentar novamente preservada, mensagem correta); 429 sem retry automático; manutenção de ponto GPS, destino e categorias. Somente depois marcar `RESOLVIDO`.
