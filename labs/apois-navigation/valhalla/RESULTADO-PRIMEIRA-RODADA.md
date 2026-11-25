# Primeira rodada regional — evidências preservadas
Execução: https://github.com/apoistecnologia-gif/apois-superapp/actions/runs/45533654191
Artefato: 14987021110. Os cinco casos e 100 solicitações passaram. Job vermelho EXCLUSIVAMENTE devido a rm: Permission denied na remoção de tiles do Docker depois da mensagem [OK]. Não reclassificar o job como verde.
Valhalla 3.9.1-e73132a7d; imagem pinada sha256:0e559e57b19e293bcf62e10c64163f2fe60c42902a760152c9238307e13e7257. Extrato OSM 2.779.379 bytes; pasta de dados processados 19.693.128 bytes. Amostra de RAM pós-carga 66,4 MiB, não pico. Limites Docker 2 CPUs e 5 GiB. Não há medição de custo de produção, rede remota ou tiles visuais.
100 consultas com concorrência 4; mediana 12,29 ms, p95 38,34 ms, máximo 42,72 ms, 264,4 req/s em janela curta de 0,38 s. Sem inferência de capacidade sustentada.
| Caso | km | segundos estimados |
|---|---:|---:|
| petrolina_urban | 4.059 | 291.335 |
| juazeiro_urban | 2.004 | 204.75 |
| crossing_pe_ba | 1.978 | 176.393 |
| crossing_ba_pe | 1.975 | 161.426 |
| alternate_origin | 4.752 | 442.593 |
Instruções pt-BR registradas na resposta Valhalla nativa; segunda rodada testa formato OSRM, eventos de voz e replay real. Rotas ainda não verificadas em campo; os pontos são aproximados, não endereços validados. Nenhum dado Google/usuário.
