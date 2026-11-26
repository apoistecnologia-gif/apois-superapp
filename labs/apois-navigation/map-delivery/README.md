# Distribuição cartográfica APOIS — candidata, sem ativação

O APK físico Vale atual conserva seu pacote verificado. Não elevar simplesmente o limite de leitura integral de 16 MiB da WebView e da política nativa para acomodar Nordeste. A alternativa experimental foi comprovada com PMTiles real por HTTPS (45791143645) e MapLibre em Chromium real, CORS e renderização de vias/nomes (45791310262), não CDN ou WebView Android de produção.

## Recursos temporários confirmados em 26/11/2026

| Recurso | Run | Artifact | Expira |
|---|---|---|---|
| Vale mapa candidato | 45750844751 | 15085466758 | 26/12 |
| Vale data pack | 45750844751 | 15085486633 | 26/12 |
| Vale runtime | 45750844751 | 15085461650 | 26/12 |
| Catálogo independente | 45762910530 | 15089599679 | 26/12 |
| Replay sintético | 45787969611 | 15101661381 | 26/12 |

O ZIP de cada artifact tem digest próprio na API Actions, distinto do hash dos arquivos internos. Retenção não é disponibilidade de produção. Antes da expiração, copiar para armazenamento durável autorizado, verificando os dois níveis de digest, sem publicar credenciais nem dados privados.

## Contrato de publicação proposto

1. Produzir mapa PMTiles, grafo Valhalla, catálogo, estilo e fontes com versões e origem OSM identificadas. Fixar tamanho e SHA-256 de cada arquivo. Validar região e coerência da extração. Os hashes atuais do grafo e mapa Vale estão fixados no código de laboratório.
2. Usar build-chunk-manifest.mjs para criar manifesto determinístico a partir do arquivo íntegro e do hash/tamanho esperados de fonte independente. O manifesto tem hash próprio. verified-range-source.mjs valida o manifesto e cada bloco antes de entregar bytes ao leitor; URL e ETag isoladamente não provam integridade. Não derivar o hash esperado dos mesmos bytes remotos não confiáveis.
3. Metadados de release assinados por chave oficial ainda não provisionada devem vincular região, versão monotônica, origem HTTPS, tamanho, SHA-256 integral, hash do manifesto de blocos, estilo, fontes, grafo, catálogo e versão mínima compatível. Validar assinatura e piso persistente antes de resolver qualquer URL. A política experimental existente não substitui esse processo de aprovação/rotação/revogação.
4. Objetos imutáveis por digest; publicar dependências primeiro, verificar leitura integral e Range, publicar a referência de versão somente depois. Preferir armazenamento de objetos + CDN com HTTPS, CORS estrito e sem autenticação de motorista/passageiro na requisição pública de mapa. Validar status 206, If-Range, ETag forte, Content-Range, Content-Length, sem transformação/compressão dos objetos. Não usar endpoint de demonstração nem artifacts temporários como origem.
5. Instalar em staging privado; checar espaço, todos os hashes e assinatura; só trocar ponteiro ativo depois de finalizar. Cancelamento, queda de energia ou arquivo parcial não podem substituir pacote bom. Manter versão anterior íntegra para recuperação controlada, respeitando piso de segurança (rollback de configuração não autoriza downgrade de dados).
6. Homologar perda de rede, instalação interrompida, WebView/Android mínimo, resposta 200/206/416, expiração, corrupção, troca de região, chave revogada e desligamento do mapa. Manter fallback original até aprovação.

## Capacidade e custos

Dimensionar com medições dos arquivos finais (não extrapolar Vale para Nordeste) e da rede física. Para GB decimais, armazenamento = soma dos bytes de objetos retidos / 1e9; tráfego de downloads = dispositivos x bytes por pacote x atualizações / 1e9; tráfego online = sessões x bytes realmente transferidos por sessão / 1e9. Somar requisições GET/Range, CDN, cache miss, operações de atualização e tráfego de origem. Medir cold/warm cache, dispositivos simultâneos e percentis de sessão. Não há fornecedor, preço, orçamento ou contratação autorizados nesta rodada; comparação de planos exige cotação vigente e volume medido. O coalescimento de blocos e fila limitada são candidatos para reduzir tráfego repetido, ainda sujeitos ao CI mais recente e teste físico.

## Licenças e atribuição

Manter atribuição visível © OpenStreetMap contributors e acesso a https://www.openstreetmap.org/copyright; documentar ODbL, origem/data do extrato e obrigações de disponibilização da base derivada quando aplicáveis. Inventariar licenças e avisos de MapLibre, Valhalla, Ferrostar, PMTiles, fontes/estilos e dependências transitivas nas versões efetivamente embarcadas. Não misturar resultados Google com OSM como fonte cartográfica independente. Revisão de distribuição ODbL e inventário final ainda são gates, não certificados de conformidade.

Nenhuma publicação de produção, alteração de flags, chave oficial, contratação ou deploy foi efetuado.
