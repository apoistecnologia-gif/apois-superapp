# APOIS — Homologação a partir de Gameleira, Itainópolis/PI

## Localidade informada
Os testes físicos serão operados a partir da localidade Gameleira, zona rural do município de Itainópolis, Piauí. A pessoa organizadora informou estar na casa de sua mãe, mas NÃO forneceu coordenadas exatas. Não converter coordenadas do centro de Itainópolis ou de outros lugares chamados Gameleira em endereço residencial.

## Situação atual, outubro de 2026
- Loja QA: `APOIS TESTE Entregas`, id `62f314cd-e792-45bc-8363-bf2b60f2ee58`, município Itainópolis/PI, descrição atualizada para indicar região Gameleira.
- Loja QA inativa, sem GPS, aguardando ponto de retirada verdadeiro e escolhido pelo organizador. Não pode receber pedidos neste momento.
- Produto fictício cadastrado; cliente QA `qa-cliente@apois-test.dev` vinculado à permissão cash de teste, mas `enabled=false`.
- Cliente QA ainda sem endereço de entrega georreferenciado.
- Entregador aprovado na conta QA `homolog-qa-2026@apois-test.dev` está offline, GPS ausente, sem push ativo. Conta separada `qa-entregador@apois-test.dev` ainda não tem cadastro de courier concluído.
- Supabase Corridas possui um motorista cadastrado em Itainópolis, com aprovação `aprovado`, mas offline e assinatura `pending`. Não marcar motorista online nem assinatura paga artificialmente.
- Nenhuma autorização cash ativa, nenhum pedido de teste criado e nenhum débito/repasses.

## Segurança e privacidade da moradia
- Não armazenar coordenadas da casa da mãe em uma loja pública sem o consentimento explícito de quem mora lá.
- Para o teste logístico, escolher preferencialmente um ponto real e público próximo (estrada, entrada ou referência segura) como retirada; o motorista/entregador pode operar os apps fisicamente na residência.
- A localização deve ser capturada de um PIN estático enviado pelo usuário ou da seleção GPS real no app. Não solicitar compartilhamento de localização ao vivo.
- Loja QA não deve ser ativada no catálogo aberto ao público sem visibilidade restrita e revisão de permissões. Mantê-la inativa até verificar as condições.

## Ordem de execução quando receber um PIN
1. Validar coordenadas como pertencentes à região de Gameleira/Itainópolis, não inferir latitude/longitude de uma referência genérica de mapa.
2. Confirmar que o ponto é apropriado para retirada de teste e que seu registro não expõe residência privada.
3. Configurar o ponto real da loja de teste e horas de operação QA, preservando suas flags inicialmente desligadas.
4. Fazer o cliente selecionar outro ponto real e acessível como destino, preferencialmente por GPS do próprio aplicativo.
5. Verificar motorista/entregador no local e online, com GPS recente e raio de despacho permitido; conta QA precisa conseguir entrar.
6. Testar primeiro somente consultas, visualização, chamados e cancelamentos; habilitar a permissão cash por curto prazo somente depois das verificações financeiras.
7. Após E2E, desabilitar a dupla QA, desligar loja e conferir zero eventos financeiros reais.

## Recursos e custos
Sem novos projetos Supabase. Evitar geocodificações e chamadas de rotas desnecessárias; o uso de APIs e Google Maps do projeto existente ainda pode gerar consumo sujeito a cobrança.

## Não executado
Nenhuma coordenada, GPS, entrega, corrida ou pagamento criado nesta atualização. Nenhum APK gerado.