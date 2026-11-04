# APOIS Cliente — falhas observadas no Android (04/11/2026)

## C-001 | Corridas | endereço de embarque não identificado

**Evidência enviada:** screenshot da Home Corridas no APK `1.0.11-qa.1001`; mapa e marcador de localização renderizados; linha **Local de partida** mostra `Toque para tentar identificar o ende...`, cortado na largura do aparelho. A mera apresentação do mapa não prova resultado bem-sucedido da conversão GPS→endereço.

**Reprodução no APK distribuído (sem acesso às credenciais/sessão):** arquivo `assets/public/modules/corridas/assets/index-0CAOufX9.js` contém a mensagem `Toque para tentar identificar o endereço` e o hook `refreshAddress` em que `runningCell.current=true` era definido antes do curto-circuito `Math.hypot(north,east)<85`. O retorno desse curto-circuito ocorre ANTES do bloco `try/finally` que limpa a trava. Se o último endereço tiver sido resolvido e o GPS variar menos de 85 metros, o usuário não consegue mais executar nova consulta de endereço: **defeito real de controle de estado**. O texto também podia ficar truncado e sem causa específica.

**Evidência backend (somente leitura, sem PII):** projeto Corridas `tbbzkrfupmqdywnzgnms`, Edge Function `google-maps-address` ativa versão 18. Janela de logs do dia 04/11 12:00–17:00 UTC mostrou duas chamadas à função (uma HTTP 200 e outra HTTP 500); o erro 500 foi `tcp connect error: Connection refused` na integração alternativa Photon, acionada quando o geocoding primário não entregou endereço. Não presumir que a causa seja permissão GPS ou que a chave Google esteja configurada/inválida; logs confirmam indisponibilidade do fallback em ao menos uma chamada. A implantação atual tenta Google quando `GOOGLE_MAPS_API_KEY` está presente e usa Photon se não há resultado; não foram alterados segredos nem feito deploy.

**Correção do cliente preparada na branch canônica:** commit `bf3e90cb995d07533c05b724ef51e02c29b99848` edita somente `scripts/harden-corridas-pickup-timeout-v1.mjs` para adquirir a trava `runningCell` DEPOIS do retorno por jitter de 85 m e do estado `geocodeBusy`, mantendo a limpeza no `finally`. `scripts/verify-corridas-pickup-retry-v1.mjs` valida no workspace final que não há retorno entre a aquisição da trava e o `try/finally`. A branch já tinha correção de texto e ação de retry (`Endereço indisponível`, `Toque para tentar novamente`, diagnóstico HTTP 429/401/403/5xx), mas esta versão atualizada ainda não está no APK 1001 instalado.

**Restrições:** sem alteração da sessão instalada, sem nova compilação APK nesta correção, sem migração SQL, sem chamada Maps paga, sem modificação das origens protegidas e sem deploy Edge em produção.

**Pendente para encerramento C-001:**
- Confirmar no CI o compilado e os gates da branch.
- Corrigir/estabilizar o serviço de geocoding backend (configuração de provedor confiável, política de cota, custos e autorização específica de deploy). O conserto da trava do cliente NÃO elimina um HTTP 500 no servidor.
- Após disponibilização segura de APK atualizado, testar automaticamente resolução de rua, indisponibilidade de backend e retry manual; validar no mesmo Android/conta do screenshot. Sem teste físico, não marcar resolvido em produção.

**Preservar:** GPS/Mapas já renderizando, chaves restritas, status de localização real, mapa com pin visível, fluxo de escolha do destino e solicitação de corrida, autenticação, sessão, pagamentos e dados.
