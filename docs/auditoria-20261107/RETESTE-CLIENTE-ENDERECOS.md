# Reteste em Android — Cliente APOIS — endereços

Estado inicial: NÃO EXECUTADO em aparelho. Usar conta sintética de homologação; não confirmar pedidos ou pagamentos reais. APK de referência: Cliente #112, versão 1.0.11-qa.112, commit 8517ade96303987f0a9cc3c617aff134b598b940. Build concluído; evidências em CONTINUIDADE.md.

| Caso | Ação | Resultado esperado |
|---|---|---|
| GPS permitido | Entrar, escolher Entregas, abrir novo endereço e permitir localização | Ponto obtido; campos disponíveis preenchidos; UF com sigla válida |
| GPS sem endereço completo | Obter ponto quando rua/bairro/CEP não são retornados | Campos ausentes ficam vazios, sem herdar endereço anterior; mensagem distingue posição de endereço identificado |
| Completar manualmente | Digitar rua, bairro, cidade, CEP, UF e número que estavam vazios | Não perder o ponto a partir do segundo caractere |
| Número e complemento | Completar número 1 → 12 → 123-A e complemento | GPS preservado; botão salvar disponível quando os obrigatórios forem válidos |
| Alteração de lugar identificado | Mudar uma rua ou cidade que vieram preenchidas | Ponto deixa de estar confirmado; exigir nova confirmação |
| Nova seleção parcial | Selecionar outro local sem número/CEP | Campos geocodificados ausentes não reutilizam valores do local anterior; conferir complemento/referência manuais |
| CEP concorrente | Iniciar consulta, editar CEP e consultar novamente antes da primeira resposta | A resposta antiga não substitui a atual; indicador pertence à consulta atual |
| CEP apagado/incompleto | Apagar ou encurtar CEP durante consulta | Não sobrescrever o formulário e não manter indicador de busca travado |
| Busca concorrente | Digitar rápido, alterar consulta e apagá-la | Não reaparecer sugestão antiga nem apagar resultado atual por falha antiga |
| UF inválida | Informar XX | Salvamento bloqueado com mensagem de UF inválida |
| Primeiro endereço | Salvar endereço confirmado, voltar à lista e início | Registro reaparece; primeiro endereço fica padrão |
| Segundo endereço | Salvar outro endereço e selecioná-lo pela lista | Confirmação altera o padrão pela RPC; início, sacola e checkout usam a mesma seleção |
| Editar | Editar endereço salvo, completar dados faltantes e salvar | Alteração persistida sem perder ponto ao completar campo ausente |
| Reiniciar | Fechar o aplicativo e abrir novamente | Sessão/endereço selecionado recuperados do backend; não depender apenas do estado em memória |
| GPS negado | Negar permissão e tentar localizar | Mensagem compreensível e opção de busca; não inventar coordenadas nem marcar mapa confirmado |
| Offline | Cortar internet ao buscar e ao salvar | Erro recuperável; sem falso sucesso nem duplicação após nova tentativa |
| Tela pequena/teclado | Percorrer formulário com teclado aberto e usar Voltar | Campos e botão alcançáveis por rolagem; safe areas preservadas; saída previsível |

Registrar versão do APK, conta sintética, resultado observado e evidência por caso. Compilação e testes de handlers não preenchem a coluna de resultado deste reteste físico.
