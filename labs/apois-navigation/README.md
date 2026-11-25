# APOIS Navegação — laboratório etapa 1
Isolado do app de produção. Base preservada: cb970bbb2d4fe5358b64d24dc31de8fcbcc3bff4, branch fix/apois-motorista-assinatura-recuperacao-20261124.
Nenhum arquivo do Google Maps, Waze, GPS, pagamentos, Supabase ou apps existentes é modificado. Não há APK, deploy, permissões, chaves ou acesso a dados reais neste laboratório.

## Objetivo
Comprovar resolução e compilação de Ferrostar 0.59.0 + MapLibre Compose no Android API 36 e construir um contrato reversível de seleção de navegação. O SDK é BSD-3-Clause; as licenças transitivas e dos mapas devem ser verificadas antes da distribuição.
Referências: https://github.com/stadiamaps/ferrostar/releases/tag/0.59.0 e https://stadiamaps.github.io/ferrostar/android-getting-started.html.
Gradle 9.2.1, AGP 9.0.1, Kotlin Compose 2.3.20 conforme a tag upstream; não impor essas versões ao Capacitor existente (8.5.0). A biblioteca compilada não é ainda uma integração com o APK.

## Execução sem APK
- node --test labs/apois-navigation/policy.test.mjs
- gradle -p labs/apois-navigation/android :probe:compileDebugKotlin :probe:dependencies --configuration debugCompileClasspath
- O workflow exclusivo deste laboratório não usa segredos nem serviços de mapas; downloads de dependências e execução GitHub Actions podem consumir franquia de CI.
- Não chamar endpoints públicos de demonstração; sem contrato comercial, sem chave, sem Google Directions/Routes. Mapas e rotas não são fornecidos pelo SDK sozinho.
- As coordenadas nos testes são inventadas; nenhuma coordenada oriunda do Google Places/Maps é encaminhada ao protótipo. Origem e licença dos dados precisam ser auditadas antes de integração.
- A decisão do provider fica fixa por etapa de uma corrida. Se a navegação interna falhar, oferecer Google/Waze explicitamente e preservar ID/estado da corrida. Não finalizar corrida nem marcar chegada com evento isolado do navegador.
- O flag experimental é desligado por padrão. Reversão: manter o fluxo externo atual, sem recompilar/migrar o banco. Nenhum flag foi instalado no aplicativo existente.

## Próximos gates
1. Compilação real e dependências verificadas; confirmar compatibilidade com AGP do host em experimento separado.
2. Valhalla local com extrato regional OSM; testes de ruas, ponte, acessos, conversões e vias de mão única. Mapas próprios/contratados com atribuição.
3. Replay de rota sintética em emulador; voz pt-BR, desvios, perda de sinal, bateria, latência, interrupções.
4. Activity nativa privada e bridge Capacitor; sobreposição de controles operacionais, mesma autoridade do backend, GPS compartilhado sem segundo serviço; canário e fallback.
5. Orçamento medido e limites: orçamento alvo R$5/motorista ativo/mês em escala, sem cobrança por corrida; nunca usar serviço pago por fallback automático.

## Etapa 1 aprovada / etapa 2

Compilação real da biblioteca Android aprovada em https://github.com/apoistecnologia-gif/apois-superapp/actions/runs/45532717659 (6 testes de política e Ferrostar + MapLibre). Isso não comprova integração com o Gradle 8.14.3 do Motorista. O laboratório regional `valhalla/run-region.sh` usa dados Geofabrik, extrato local de Petrolina/Juazeiro, imagem oficial fixada por digest, português brasileiro e 100 consultas locais de carga. Sem serviço exposto, sem dados pessoais, sem API de pagamento. OSM © OpenStreetMap contributors, ODbL. Sem trânsito real, sem validação de campo. Testar resultados antes de qualquer implantação.
