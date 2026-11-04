# APOIS Android — registro de ocorrências de teste físico
Data: 04/11/2026. Branch: `fix/entregas-homologacao-ajustes-20261030`.

## 001 — Cliente Corridas — endereço de embarque não identificado

**Relato:** captura de tela do Cliente Android instalado (`br.com.apois.app`, QA versionCode 1001). Mapa visível; o campo **Local de partida** exibe `Toque para tentar identificar o endereço...`, com texto truncado em viewport móvel. O relato ainda não informa o resultado de tocar no campo.

**Comportamento esperado:** mostrar endereço obtido a partir do GPS; se o provedor externo estiver indisponível, informar sem inventar rua/número, preservar último endereço que foi efetivamente validado, e permitir nova tentativa da consulta dentro da quota.

**Diagnóstico confirmado em produção, somente leitura:** Supabase Corridas `tbbzkrfupmqdywnzgnms`, função `google-maps-address` ACTIVE v18, com JWT. Logs de 04/11/2026 às 16:22 UTC: chamada POST da função retornou **HTTP 500**; seu RPC `consume_google_maps_lookup_quota` havia retornado **HTTP 200**. A função tentou `photon.komoot.io/reverse` e recebeu erro TCP `ECONNREFUSED` (servidor externo). Isso demonstra falha do serviço de resolução de endereço, **não prova falha de GPS**. Logs não provam por si só se a chave Google server-side está ausente ou se houve `ZERO_RESULTS`. Não publicar coordenadas pessoais nem mensagens completas da requisição.

**Código de interface em homologação:** `scripts/harden-corridas-pickup-address-display.mjs` substitui o texto longo por `Endereço indisponível` e distingue 429, 401/403 e 5xx da consulta; `scripts/harden-corridas-kit-visual.mjs` exibe `Toque para tentar novamente` abaixo do campo no modo erro. A tela final de referência, diferente do JSX antigo da origem, **já chamava refreshLocation/refreshAddress** no botão; manter esse fato, sem declarar que o toque final navegava para destino. A navegação de destino continua em botão separado. `harden-corridas-trip-flow-ux.mjs` preserva último endereço validado em falhas transitórias; `harden-corridas-pickup-timeout-v1.mjs` mantém limite de 12 segundos e deduplicação por GPS. Gate `scripts/verify-corridas-pickup-retry-v1.mjs` protege a tela final e o hook.

**QA comprovado:** [GitHub CI 41871938082](https://github.com/apoistecnologia-gif/apois-superapp/actions/runs/41871938082): **3/3 jobs SUCCESS** (audit-web-only, WEB-only cliente, WEB-only estabelecimento). A validação WEB não comprova a resposta do geocoder no telefone.

**Servidor, somente preparado:** função `supabase/functions/google-maps-address/index.ts` sincronizada com a versão em produção e dotada de retry breve, limitado e somente para falhas de transporte/5xx do Photon; cenário offline testado em `scripts/qa/test-photon-reverse-retry-v1.mjs`. Esse código está **STAGED**, **NÃO DEPLOYED** em Supabase Corridas. Sem prova de um provedor funcional, o endereço automático **não está declarado corrigido**. Nem a indisponibilidade externa nem a chave do Google devem ser mascaradas por um nome de rua fictício.

**Limites e segurança:** não disparar automaticamente chamadas pagas ao Google Maps fora das quotas; não copiar chave pública de Maps para segredo server-side; não habilitar provedor comercial sem configuração segura e revisão de cobrança. Não usar Nominatim público como substituto automático de alto volume para corridas, que depende de regras de uso de serviços OSM. Não modificar produção, banco, corridas ou os `sources/` protegidos nesta ocorrência.

**Pendência para confirmação física:** após uma atualização cumulativa assinada, verificar se o campo mostra endereço real quando o provedor responde e se o botão repete consulta exibindo erro claro quando a função falha. Sem reinstalar/limpar dados do APK atual apenas por este sintoma.

## Próximas ocorrências
Registrar sequencialmente conforme o proprietário enviar novos prints; uma correção por vez e build cumulativo somente depois das validações.

**Verificação final do código do servidor preparado:** [GitHub Actions 41872327039](https://github.com/apoistecnologia-gif/apois-superapp/actions/runs/41872327039): **3/3 jobs SUCCESS** após a preparação da tentativa limitada de recuperação do Photon. O resultado é de compilação WEB e teste isolado; **nenhum deploy no Edge, nova consulta real, mudança no aplicativo já instalado ou garantia de serviço externo funcionando**. A correção da interface passou antes em [41871938082](https://github.com/apoistecnologia-gif/apois-superapp/actions/runs/41871938082), também 3/3 SUCCESS. A liberação física real do endereço continua pendente do provedor externo.

## 002 — Cliente Corridas — edição de dados pessoais exibe somente nome e cidade

**Relato físico:** screenshot Android do perfil de passageiro, no menu `Dados Pessoais`. Ao abrir a folha `Editar dados pessoais`, somente os campos `Nome completo` e `Cidade` aparecem. A tela de perfil original disponibiliza `Telefone` e `E-mail` como itens próprios, mas o usuário não consegue visualizá-los a partir desse resumo.

**Diagnóstico em código:** `scripts/harden-corridas-profile-edit.mjs` gera `PassengerProfileEditor.tsx` com três modos separados (`name`, `phone`, `email`); o primeiro modo intencionalmente mostrava apenas nome e cidade. O cadastro inicial de passageiro da fonte travada coleta nome, e-mail, telefone e senha, não há contrato confirmado de CPF/data de nascimento no perfil autenticado. Não inventar nem persistir atributos adicionais.

**Correção preparada na branch:** a janela de `Dados Pessoais` também passa a exibir o telefone e o e-mail registrados, com ações explícitas `Alterar` que abrem os editores existentes. Mantém alteração de e-mail via Supabase Auth e persistência própria dos campos de perfil via RLS, sem tocar senha, identidades, schema, usuários alheios ou produção. Correção adicional demonstrada: expressões regulares do gerador de edição estavam sem barras de escape, fazendo tratamento incorreto de espaços, números de telefone e sintaxe de e-mail; foram restauradas `\\s`, `\\D`, `\\d` e `\\.` onde exigidas. Gate `scripts/verify-corridas-profile-edit.mjs` agora verifica presença dos contatos, navegação interna e validadores.

**Status:** implementado no script da branch, ainda **não testado no Android**; o APK `1.0.11-qa.1001` já instalado não muda. Critério de aceite: compilar workspace final, teste de abertura e troca nome/telefone/e-mail, salvar nome/cidade e telefone em conta de homologação, verificar mensagem de confirmação e-mail quando permitido, reiniciar aplicativo e confirmar persistência. Sem deploy, SQL, APK ou atualização em produção durante esta ocorrência.
