# APOIS Motorista — base funcional e limites da próxima rodada visual

**Status:** base de recuperação preparada em branch isolada; sem APK de atualização homologado.

## Referências verificadas

- APK funcional fornecido: `APOIS-Motorista-Tela-Branca-Corrigida-TESTE.apk`, versão `1.0.28-qa.307`, `versionCode=335`.
- SHA-256 do arquivo de referência: `7f8fd06856c102830867074290a7b96cadf55a8739efbc9f9ff5a8469ff9e216`.
- Certificado da referência: `4A3476B91674301EB066146B6F3B8384D9827AB4BDB287B6F00CBBEAB56A33F4`.
- Esse APK funcional histórico **contém Entregador** e não pode ser distribuído como a versão exclusiva Corridas.
- APK **instalado** pelo usuário: `1.0.11-qa.3`, `versionCode=9003`; SHA-256 do arquivo `795ed065f212672e132c560e2073cde989b4afe264be87da2aad76640ca9e49a`.
- Certificado do instalado: `94A11563082E4F8E57F76B0A5D0982D4B88DA93353753F87C732310E9D887132`.
- Os segredos QA atualmente disponíveis no GitHub **não assinam** o APK instalado: um APK com o certificado histórico NÃO é atualização compatível. Não mudar o `applicationId` nem desinstalar para contornar isso.

## Escopo estável e obrigatório

- Identificador Android fixo: `br.com.apois.parceiro`.
- Nome exibido: `APOIS Motorista`.
- Produção pública apenas Corridas/Motorista; nenhuma tela, rota, bundle JavaScript ou classe Android de Entregador.
- O código-fonte de APOIS Entregas e o caminho completo de build legado continuam preservados.
- Os serviços de localização nativa do Motorista, login/Google/recuperação de senha, sessão, ofertas, temporizador, aceite, chegada, início e conclusão, notificações, navegação e histórico **não podem ser reimplementados ou removidos**.
- Não alterar Supabase, API, Webhooks, regras de negócio, pagamentos, chaves ou certificados.

## Fonte da identidade visual

- Logotipo e launcher: `superapp/branding/apois-client-red-logo.b64`, aplicado a **overlay descartável**, não às artes originais versionadas.
- Login aprovado: script `scripts/apply-driver-login-approved-qa-v1.mjs`, marca `data-apois-driver-approved-login-v1`, com email/senha, Google e recuperar senha preservados.
- Entrada Android exclusiva: `superapp/partner-shell/index-motorista-only.html`; boas-vindas: `superapp/partner-shell/motorista-welcome.html`.
- O conteúdo visual que o usuário enviar em seguida é uma **referência de aparência**, não uma autorização para mudar lógica, navegação, APIs, identidade Android ou permissões.

## Procedimento da próxima rodada

1. Conferir cada tela aprovada recebida e localizar seu componente existente, antes de editar.
2. Alterar somente atributos estéticos e estrutura de apresentação; preservar importações funcionais, estado, handlers e contratos de dados.
3. Criar commits separados por tela na branch de recuperação; sem `reset` destrutivo.
4. Executar análise estática, TypeScript, testes dos fluxos, inventário de conteúdo do pacote e verificação dos SHA-256 de certificado e pacote **antes** de autorizar qualquer instalação.
5. Enquanto a chave de `94A11563…` não for localizada, bloquear qualquer promessa de atualização sobre o aplicativo atual. O teste do certificado histórico `4A3476B9…` não prova compatibilidade com o instalado.
6. Não publicar na Play Store, não alterar produção nem lançar cobrança financeira.

## Nota de QA

O build `APOIS_MOTORISTA_ONLY=1` não compila Entregador; o build completo histórico pode continuar compilando ambos, mas nunca deve ser distribuído como APK exclusivo. Os testes estáticos não substituem a verificação do Android ou instalação no dispositivo.
