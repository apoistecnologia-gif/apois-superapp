# APOIS — Relatório 05 | Segurança e utilidades do Motorista

**Data:** 09/11/2026. **Achados:** INV-049, INV-050 e INV-051 (três, sem desdobrar falsos positivos).
**Origem:** Relatório 05 de 08/11/2026, confrontado com a fonte Motorista/Admin fixada.
**Base de execução:** `apoistecnologia-gif/apois-superapp`, branch `audit/continuacao-20261107`.
**Preservação:** versões e histórico dos Relatórios 01–04 intactos. Nenhum merge/main, publicação, APK, SOS, ligação, compartilhamento externo ou alteração no banco.

## Conferência dos contratos reais

- Fonte Motorista/Admin: `apoistecnologia-gif/movvi-go-connect` em `9fc171050d8b5703540c49d19a8f1e9f5162775f`.
- O hardener `scripts/harden-partner-motorista-native-utilities.mjs` permanecia no blob `02aa16e23b5ffb07db2de3dcee07bd0e40c0bbbf`; chamado via `harden-partner-motorista-payment-policy.mjs` no build Parceiro. Aplicar o patch **depois** do hardener nativo, não na fonte protegida.
- `package.json` do snapshot declara `@capacitor/geolocation: ^8.2.0`; a documentação oficial atual da API v8 distingue `location` e `coarseLocation` e permite `enableHighAccuracy:false` quando somente aproximação está autorizada. Versão efetiva instalada pelo lockfile ainda deverá ser confirmada no build. Referência: https://capacitorjs.com/docs/apis/geolocation.
- Leitura somente do RPC implantado `public.driver_add_emergency_contact(_name text,_phone text,_relation text)` em Corridas `tbbzkrfupmqdywnzgnms` confirmou o limite de 40 caracteres e a ausência de validação de 8–15 dígitos. O RPC deriva o motorista da sessão, preserva o primeiro contato como primário e não foi executado ou modificado no banco nesta fase.

## Matriz do Relatório 05

| ID | Prioridade | Estado de código | Implementação no integrador | Aceite/limite |
|---|---|---|---|---|
| INV-049 | P2 | **B — implementado no código; ainda não homologado** | `scripts/fix-report05-motorista-security-v1.mjs` gera helper comum para classificação `precise/approximate/denied` baseado nos dois aliases Capacitor. O helper de SOS/compartilhamento só solicita permissão se nenhuma concedida, usa precisão alta somente em `precise` e retorna indicação de modo aproximado; SOS mantém `.catch(() => null)`. O diagnóstico configura `granted/approximate/denied/off/timeout/unsupported` com feedback específico. | Classificação/obtenção de GPS isoladas com mocks: concedida precisa, apenas coarse, negada, transição após permissão e erros de GPS desligado/timeout. Exige Android para confirmar resultados do plugin. **Não** altera precisão do despacho nem geolocalização de corridas. |
| INV-050 | P2 | **C — cliente corrigido, servidor preparado não implantado** | Normalização não destrutiva: valida caracteres `+ 0–9 espaço () - .`, 8–15 dígitos, sem `.slice(0,15)`; campo não corta texto, erro específico para excesso; valor inválido existente continua visível, mas sem ação `tel:` incorreta. Arquivo SQL `20261109_report05_emergency_phone_validation_QA_NOT_APPLIED.sql` prepara mesmo contrato no RPC sem limpar contatos existentes. | Testes de número nacional formatado, internacional, excesso, caractere proibido e vazio passaram; SQL **não aplicada**. Falta staging do RPC com formato internacional, contatos legados e retorno do banco. |
| INV-051 | P2 | **B — implementado no código; ainda não homologado** | Resultado de `navigator.share` bem-sucedido encerra normalmente. Em `AbortError`, nenhum link nem cópia automática. Em falha recuperável ou ausência da API, guarda link preparado em estado local com aviso, campo selecionável, botão **Copiar link** e **Ocultar**. Clipboard somente no clique explícito; se falhar, link fica disponível para seleção manual. A descrição da posição aproximada é distinta da posição precisa. | Simulações: compartilhamento concluído, cancelado, negado, API ausente, clipboard aceita/negada. Falta teste real WebView, gesto de usuário e permissões. |

## Arquivos de implementação

- **Novo:** `scripts/fix-report05-motorista-security-v1.mjs`. Aplica pequenas alterações sobre o workspace descartável: `src/routes/motorista.seguranca.tsx`, `src/routes/motorista.configuracoes.tsx` e novo `src/lib/partnerLocationPermission.ts`.
- **Novo:** `scripts/verify-report05-motorista-security-v1.mjs`. Testa as funções efetivamente extraídas dos arquivos transformados; nenhuma chamada externa.
- **Novo, somente preparação SQL:** `supabase/corridas-forward-migrations/20261109_report05_emergency_phone_validation_QA_NOT_APPLIED.sql`.
- **Alterado:** `scripts/build-partner-release.sh`, com patch após native-utilities e gate de regressão após a geração e novamente antes do typecheck do Motorista.

Nenhuma mudança no repositório-fonte fixado. Não criar módulo paralelo de rastreamento, novo SOS, acionamento automático de contatos, alteração financeira, autenticação ou migração de números históricos.

## Evidência de execução em 09/11/2026

1. Fontes pinadas `motorista.seguranca.tsx`, `motorista.configuracoes.tsx` e hardener nativo real lidos do GitHub, com origem e ordem de execução conferidas.
2. **Dois scripts reais** (`harden-partner-motorista-native-utilities.mjs` e novo gerador do relatório 05) executados sobre arquivos de origem fixados usando filesystem simulado em JavaScript. Resultado **2/2 PASS**, sem escrever em repositórios-fonte.
3. **39 assertions sintéticas** de `verify-report05-motorista-security-v1.mjs`, executadas sobre os arquivos transformados na simulação; **39/39 PASS**. Os casos usam GPS, share, clipboard e telefones inteiramente simulados; nenhum contato real, coordenada real ou alerta foi enviado.
4. O gerador foi reaplicado à mesma cópia simulada: **idempotência PASS**.
5. Sem publicação do SQL; nenhuma alteração no banco e nenhum acesso ao navegador nativo. O histórico de outras auditorias não foi reexecutado.

**Ainda não executado:** teste `node scripts/verify-report05-motorista-security-v1.mjs` no checkout completo por Node externo, `bun install`, typecheck, build Vite, testes de React renderizado, screenshot em 320/360/390 px, Capacitor Android, permissões reais de coarse/fine, GPS desligado e compartilhamento pelo menu nativo. O gate foi versionado e ligado ao build, mas isso não prova que a compilação passou.

## Riscos, bloqueios e reversão

- **Runtime:** os testes de fontes em memória não provam precisão física. Uma coordenada obtida com permissão aproximada é explicitamente descrita como tal e não deve ser usada para embarque/roteamento.
- **Backend:** sem a migração SQL, chamadas diretas ao RPC ainda podem passar por sua validação anterior de texto de até 40 caracteres; isso é uma pendência do INV-050, não um defeito ocultado pelos testes do cliente. Nenhuma atualização retroativa foi autorizada.
- **Privacidade:** a recuperação de compartilhamento exige o clique no botão antes de copiar e nada faz após `AbortError`.
- **Segurança operacional:** SOS ainda tenta registrar com coordenadas nulas em caso de GPS indisponível e a fonte do relatório não prova ou autoriza um alerta automático aos contatos.
- **Reversão:** reverter apenas os commits do relatório 05 na branch de auditoria; sem rollback do banco ou de produção porque nenhuma migração/deploy foi executado.

## Conclusão da fase de código

Os três achados receberam correções reais versionadas no integrador e verificações isoladas. **INV-049 e INV-051: B**, aguardam compilação/homologação; **INV-050: C**, pois a validação no RPC está somente preparada. **Não é a homologação final.** O próximo relatório poderá ser recebido sem APK ou teste físico; testes Android só após a frase de liberação definida pelo usuário.
