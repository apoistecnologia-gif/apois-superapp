# APOIS — Homologação a partir de Gameleira, Itainópolis/PI

## Localidade informada
Os testes físicos serão operados a partir da localidade Gameleira, zona rural do município de Itainópolis, Piauí. O ponto exato de retirada foi fornecido por captura do Google Maps e cadastrado na loja fictícia, no Supabase. Não reproduzir coordenadas de residência em arquivos públicos.

## Situação atual, outubro de 2026
- Loja QA: `APOIS TESTE Entregas`, id `62f314cd-e792-45bc-8363-bf2b60f2ee58`, município Itainópolis/PI, descrição atualizada para indicar região Gameleira.
- Loja QA inativa, com GPS de retirada configurado exatamente conforme pin informado; não pode receber pedidos até validação de segurança e dos participantes.
- Produto fictício cadastrado; cliente QA `qa-cliente@apois-test.dev` vinculado à permissão cash de teste, mas `enabled=false`.
- Cliente QA ainda sem endereço de entrega georreferenciado.
- Entregador aprovado na conta QA `homolog-qa-2026@apois-test.dev` está offline, GPS ausente, sem push ativo. Conta separada `qa-entregador@apois-test.dev` ainda não tem cadastro de courier concluído.
- Supabase Corridas possui um motorista cadastrado em Itainópolis, com aprovação `aprovado`, mas offline e assinatura `pending`. Não marcar motorista online nem assinatura paga artificialmente.
- Nenhuma autorização cash ativa, nenhum pedido de teste criado e nenhum débito/repasses.

## Segurança e privacidade da moradia
- Não abrir a loja com coordenadas de possível residência ao catálogo público; mantê-la inativa e restrita às contas QA. Teste RLS anon comprovou invisibilidade.
- Antes de iniciar, confirmar que o ponto selecionado é seguro e apropriado para coleta de TESTE sem expor os moradores e sem entrega de produtos reais.
- A localização deve ser capturada de um PIN estático enviado pelo usuário ou da seleção GPS real no app. Não solicitar compartilhamento de localização ao vivo.
- Loja QA não deve ser ativada no catálogo aberto ao público sem visibilidade restrita e revisão de permissões. Mantê-la inativa até verificar as condições.

## Próximas etapas após configurar o PIN
1. Coordenadas exatas do pin já configuradas; confirmar local físico e proteção da privacidade antes de ativar.
2. Confirmar que o ponto é apropriado para retirada de teste e que seu registro não expõe residência privada.
3. O ponto de retirada já foi cadastrado; configurar horários QA preservando desativação até que celular e entregador estejam prontos.
4. Fazer o cliente selecionar outro ponto real e acessível como destino, preferencialmente por GPS do próprio aplicativo.
5. Verificar motorista/entregador no local e online, com GPS recente e raio de despacho permitido; conta QA precisa conseguir entrar.
6. Testar primeiro somente consultas, visualização, chamados e cancelamentos; habilitar a permissão cash por curto prazo somente depois das verificações financeiras.
7. Após E2E, desabilitar a dupla QA, desligar loja e conferir zero eventos financeiros reais.

## Recursos e custos
Sem novos projetos Supabase. Evitar geocodificações e chamadas de rotas desnecessárias; o uso de APIs e Google Maps do projeto existente ainda pode gerar consumo sujeito a cobrança.

## Não executado
Ponto GPS da loja de teste cadastrado no Supabase e invisível ao público anônimo. Nenhum pedido, corrida, entrega ou pagamento criado. Nenhum APK gerado.