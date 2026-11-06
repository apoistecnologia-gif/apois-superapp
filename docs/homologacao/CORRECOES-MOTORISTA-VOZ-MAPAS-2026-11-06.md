# APOIS Parceiro — voz, imagens e mapas | Correções de homologação em 06/11/2026

**Status:** alterações de código integradas e APK QA compilado; validação física da reprodução de áudio, GPS e imagens permanece pendente.
**Fonte dos achados:** vídeo físico enviado pelo responsável (cerca de 52 s) e consulta somente leitura ao Supabase Corridas.
**Branch Motorista:** `fix/motorista-39-achados-20261105`.
**Repositório:** `apoistecnologia-gif/apois-superapp`.
**Compilação:** [GitHub Actions #124](https://github.com/apoistecnologia-gif/apois-superapp/actions/runs/42247385899), **SUCCESS** no job `build-partner-apk`, artifact `APOIS-Parceiro-TESTE` ID `13519586748`.
**Arquivo:** `APOIS-Parceiro-TESTE.apk`, 11.424.012 bytes, SHA-256 `68e56d09eed2101fc8a0a2d502117f578f190f6d79c932997448d4c8fe1af7c1`.
**Assinatura:** chave QA original do Parceiro restaurada e validada pelo workflow. NÃO alterar assinatura definitiva de produção.

## Achados e correções implementadas
- **Voz não fala instruções**: comprovado que `src/lib/voiceNav.ts` invocava `DriverVoice.prime()`, mas o Java do APK unificado criado por `scripts/configure-partner-android.mjs` não implementava `prime`. O método foi implementado no host nativo, com espera limitada por TTS, verificação de português do Brasil, confirmação de fila `spoken=true` e distinção QUEUE_ADD/QUEUE_FLUSH. O frontend passou a deduplicar apenas após aceite do pedido de fala, tratar fallback e emitir falha visível; botão **Testar voz** usa um comando de áudio audível. **Teste físico de som ainda necessário**.
- **Mapa e controles**: linhas da rota com camadas menos espessas; preserve route provider, câmera, seguimento, escala e GPS. A redução de largura busca evitar que o traçado vermelho esconda detalhes da rua. **Precisa de teste físico de zoom/manual/seguir**.
- **Painel de embarque**: snap inicial reduzido para deixar área útil maior ao mapa, mantendo gesto de expandir.
- **PIN**: removido foco automático inicial que abria o teclado e cortava o título no Android; mantém os quatro dígitos, botão e autenticação original.
- **Finalização antecipada**: adicionado aviso/confirmação extra quando GPS está a mais de 0,3 km do destino; mantém autorização real no backend. Esse é um **controle apenas de interface**, não substitui validação de segurança no servidor. Não alteramos RPCs/valores/settlement.
- **Resumo**: `ride.distance_km` e `ride.duration_min` são previsões da rota, não medições reais do trajeto. A tela agora os identifica como **Distância prevista** e **Tempo previsto**.
- **Imagens**: logomarca embarcada ganha alternativa textual caso decodificação falhe; componentes Avatar já tinham alternativa de inicial/ícone. A verificação do pacote confirmou links a recursos locais, mas imagens remotas privadas e demais telas não foram testadas fisicamente; **não afirmar que toda imagem quebrada foi corrigida**.
- **Conclusão/avaliação**: fundo opaco para evitar transparência que deixava o mapa atravessar o painel, mantendo avaliação e fluxo pós-corrida.

## Arquivos de código
- `scripts/configure-partner-android.mjs`: plugin Java DriverVoice do host unificado.
- `scripts/fix-partner-motorista-voice-runtime-v9.mjs`: navegação por voz no frontend, deduplicação após confirmação.
- `scripts/fix-partner-motorista-voice-test-ui-v9.mjs`: botão de teste, avisos de áudio indisponível.
- `scripts/fix-partner-motorista-map-visual-v10.mjs`: mapa, PIN, painel, logo, confirmação, resumo.
- `scripts/qa/verify-partner-voice-map-visual-v11.mjs`: teste de integridade e preservação do contrato.
- `scripts/build-partner-release.sh`: execução dos scripts apenas na cópia isolada Motorista.

## Evidências de validação
- GitHub Actions #124: build Motorista + Entregador SUCCESS, preflight de assets e bundle SUCCESS, Gradle APK SUCCESS, restauração da QA signing SUCCESS e upload de artifact SUCCESS.
- ZIP/APK extraídos: integridade ZIP/CRC OK; SHA do arquivo APK igual ao hash do artifact; bundle motorist contém `Testar voz`, `Confirmar finalização antecipada`, `Distância prevista`, `Tempo previsto`.
- Não foi feita alteração no Supabase, configurações Maps produção, pagamentos, contas, módulos Entregas ou publicação em loja.

## Validação manual obrigatória no dispositivo
1. Instalar APK #124 sobre a versão anterior do Parceiro (mesma assinatura QA), manter o volume de mídia ativado. Abrir corrida de homologação. Tocar **Testar voz** e confirmar que a frase foi realmente audível; testar Android TTS em pt-BR se não houver som.
2. Aproximar-se de uma instrução real da rota de carro em segurança e verificar pronúncia, não repetição e aviso de manobra. **Não simular direção nem olhar a tela enquanto conduz**.
3. Alternar **Ver rota** / **Seguir**, zoom e recenter; verificar linha mais fina e painel.
4. Verificar a tela PIN com teclado; concluir a corrida apenas com passageiro desembarcado. Longe do destino, a confirmação extraordinária deve aparecer.
5. Abrir tela de avaliação e conferir fundo opaco/visibilidade. Visitar telas com imagens que davam erro e enviar os exemplos específicos que ainda falham.
6. A verificação de **regra server-side de chegada e distância percorrida** continua pendente, já que terminar em 27 s uma corrida estimada em 4,63 km foi aceito. NÃO inferir distância real de valores previstos nem mudar produção sem decisão própria.

**Guarda de engenharia:** não fazer merge, deployment, alteração de segurança, migração, chaves de produção ou modificações em Entregas somente por causa desta homologação. Manter todos os testes e source-lock protegidos.
