# Próxima fase: GPS físico + roteamento dinâmico
A V2 foi validada no aparelho: mapa local renderizado, GPS 2,5 m, voz pt-BR disponível. Ainda não há teste físico em deslocamento.
O gateway Valhalla local passou 6 rotas, 4 rejeições e teste de destino distante (247,09 m). CI 45740368120.
Cliente Android experimental separado (FieldDynamicRouteClient): host HTTPS explicitamente autorizado, TLS padrão do Android, sem redirecionamento, token temporário em memória (15 min no cliente), destino imutável, limite de resposta e checagem regional. Não é a credencial de corrida nem substitui o issuer de produção.
A política FieldDynamicCanStart exige GPS atual, precisão <=20 m, fix <=5 s e distância ao início da geometria <=35 m após a resposta. O limite geral de snap continua 150 m. Não inicia instruções com posição anterior.
Não registra Activity, não altera permissões dos APKs, não publica serviço. Próximo passo: disponibilizar infraestrutura HTTPS controlada e autenticação temporária no servidor, conectar host nativo e executar teste real; recálculo somente com LegRouteResources explicitamente vinculado ao piloto. Não usar serviço público de terceiros nem simular sucesso.
