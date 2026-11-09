# APOIS — RV-19 | Relatório independente de verificação — configurações globais

**Data:** 09/11/2026  
**Entrada:** `RELATORIO-VISUAL-19-APOIS-CONFIGURACOES-GLOBAIS-20261109(1).md`.  
**Repositório verificado:** `apoistecnologia-gif/apois-superapp`.  
**Branch atual:** `audit/continuacao-20261107`.  
**HEAD inicial confirmado:** `7cfb739fb5be9ae46f827d632f8707d11ce5990b` (última RV-17 versionada).  
**Auditoria externa original:** `audit/ecossistema-20261107@18f2fed7e27486f2b3a4170921a246344316a2a4`, não confundida com a versão do integrador atual.  
**Escopo autorizado por esta entrega:** auditoria, verificação e documentação, **sem alteração de código funcional, CSS, configuração, banco, build, APK ou publicação**.

## 1. Estado de origem e histórico

O HEAD do integrador foi recuperado diretamente da referência GitHub. `.apois/source-lock.json` permaneceu no blob SHA `3f98789f28666ccc052175db10f138208dd0937b`. A matriz visual existente contém 59 registros CV-001–CV-059, com RV-17 terminada. A árvore atual do repositório não contém artefato cujo caminho identifique **RV-18**; isso **não autoriza presumir que houve ou que não houve auditoria RV-18 fora desta branch**. A RV-19 foi analisada diretamente sem atribuir IDs retroativos.

Fontes pinadas, somente leitura:

| Módulo | Revisão fixada |
|---|---|
| Entregas | `apoistecnologia-gif/apois-entregas@2f4606e0fb52dffb49f2e6aebbe921ce687ab625` |
| Motorista/Admin | `apoistecnologia-gif/movvi-go-connect@9fc171050d8b5703540c49d19a8f1e9f5162775f` |
| Passageiro | `apoistecnologia-gif/say-hello-buddy-23-84b5dcbf@7b047f75a1a919a5336c0df6e0d60b14b02f2618` |

Os hashes SHA-256 do auditor referem-se à cópia examinada naquela rodada e **não identificam um APK**. A branch do integrador já inclui alterações próprias, como a paleta do CTA ajustada na RV-13. Não tratar as duas versões como byte a byte idênticas.

## 2. Evidências repetidas sobre os arquivos atuais

Foram recuperados no GitHub os arquivos reais:

1. `superapp/shell/index.html`.
2. `superapp/partner-shell/index.html`.
3. `superapp/shell/capacitor.config.ts`.
4. `superapp/partner-shell/capacitor.config.ts`.
5. `scripts/fix-partner-courier-search-scan-v1.mjs`.
6. `src/routes/__root.tsx` da fonte fixada Entregas.
7. `src/routes/__root.tsx` da fonte fixada Motorista/Admin.
8. `src/routes/__root.tsx` da fonte fixada Passageiro.
9. `scripts/fix-entregas-shared-visual13-v1.mjs`, que aplica correções da RV-13.
10. `scripts/build-isolated-module.mjs`.
11. `scripts/build-partner-release.sh`.
12. `superapp/shell/package.json`.
13. `superapp/partner-shell/package.json`.

**15/15 verificações textuais/estruturais feitas diretamente sobre esses conteúdos passaram.** Essas asserções confirmam presença de atributos, regras de estilo, versões declaradas e vinculação de scripts; **não** são `node --test`, renderização, testagem do CSS compilado nem testes do Android nativo.

### Resultado dos controles positivos

| Controle | Evidência da versão do integrador | Limite da conclusão |
|---|---|---|
| Zoom nas metas | Shells Cliente e Parceiro declaram `width=device-width,initial-scale=1,viewport-fit=cover`, sem `user-scalable=no` ou `maximum-scale=1`. Fontes fixadas Entregas e Motorista também têm a meta sem bloqueio. | Não comprova pinch zoom no APK ou em WebViews; Passageiro não declara a meta no `__root.tsx` lido, o que não significa viewport ausente no documento final. |
| Idioma | `<html lang="pt-BR">` presente nos dois shells e raízes de Entregas/Motorista. | Não prova que todas as ações têm rótulos acessíveis. |
| Safe areas | Ambos os shells usam `env(safe-area-inset-top)` e `env(safe-area-inset-bottom)`; Motorista root também contempla safe areas. | Não garante área livre de colisões na barra de status, gestos ou teclado. |
| Teclado Cliente | Configurações declaram `Keyboard.resize='body'`, `resizeOnFullScreen=true`. | Comportamento na versão nativa compilada não verificado. |
| StatusBar | Shell Cliente declara `style='DARK'`, `backgroundColor='#FFFFFF'`; Parceiro `style='DARK'`, `backgroundColor='#F7F7F8'`. | Não prova renderização nativa nem ausência de override Android. |
| Movimento reduzido | Gerador de busca Entregador contém `motion-reduce:animate-none`, `@media(prefers-reduced-motion:reduce)`, `role="status"` e `aria-live="polite"`. | Aplicação à UI final e outras animações ainda requerem CSS/browser/Android. |
| Builder | `build-isolated-module.mjs` instala o overlay RV-13 da navegação e diálogos; `build-partner-release.sh` chama o script da animação da busca. | Presença no builder não prova que um APK/implantação contém a saída. |
| Versões declaradas | Ambos os `package.json` listam `@capacitor/keyboard@8.0.5` e `@capacitor/status-bar@8.0.3`. | Não confundir versão declarada com plugin compilado/executado no Android. |

### Revisão pontual dos IDs já abertos

- **VIS-045/CV-044 — contraste CTA:** integrador atual tem gradientes `#D51722`, `#CE101A` e `#C9141B`; razão matemática nominal de contraste de branco sobre essas cores calculada nesta rodada em **5,283:1**, **5,655:1** e **5,834:1**, respectivamente. **Não é contraste medido de pixel na UI renderizada**, tampouco verifica estados hover/disabled, fontes e sobreposições. RV-13 permanece implementada em código, homologação visual pendente.
- **VIS-046/CV-045 — navegação estreita:** overlay RV-13 ainda inclui `min-w-0 flex-1`, `sm:min-w-[72px]` e `aria-current`; acoplamento ao builder foi confirmado. **Não houve renderização real da navegação de 320/360/390 px ou zoom 200%**; não declarar resolvido por simples presença de classes.
- **VIS-047/CV-046 — diálogos altos:** overlay RV-13 ainda especifica `max-h-[calc(100dvh-2rem)]`, `overflow-y-auto`, `overscroll-contain` e fechar 44px; sem browser/teclado real. Outros modais manuais não estão comprovadamente cobertos apenas por esse overlay.

**Nenhum ID novo é atribuído nesta rodada.** A existência dos controles positivos também não justifica remoção das pendências prévias.

## 3. Evidência de execução e bloqueio de renderização

A sessão de execução possui um binário `/usr/bin/chromium` e a biblioteca Python Playwright, verificados por comando local. Entretanto, **o checkout GitHub autorizado e os assets compilados não estão montados no runtime local**, e acesso HTTP direto a `raw.githubusercontent.com` falhou por resolução DNS. O acesso ao conteúdo foi feito pelo conector GitHub, suficiente para verificação estática, **mas não para reproduzir e renderizar a versão completa com seus assets, scripts e roteamento instalado**. Não foi produzida captura de tela nem alegada medida visual, teste de zoom, foco, safe areas ou efeito do teclado.

Assim, a falha do auditor externo em iniciar um navegador não é reproduzida aqui como defeito de produto; e a disponibilidade do navegador local também **não foi convertida artificialmente em teste de interface aprovado**.

Nenhum checkout de produção foi ativado, nenhuma credencial foi usada, nenhuma página de login foi acessada, nenhuma navegação externa de módulo foi concluída.

## 4. Matriz objetiva para futura homologação autorizada

| Ambiente/superfície | Variações | Critério de aceite |
|---|---|---|
| Seletor Cliente e Parceiro | 320/360/390px, altura curta, paisagem, zoom 100/200% | Todos os CTAs e títulos visíveis/acionáveis, sem destinos alterados, foco perceptível |
| Nav Entregas | 320/360/390px, 200% zoom, fonte ampliada | Cinco ações permanecem acessíveis sem overflow que oculte comandos |
| Dialog Radix e modais manuais | Teclado aberto/fechado, conteúdo longo, zoom, Tab/Escape | Conteúdo rolável e botão Fechar disponível; foco inicial, contenção e retorno |
| Raízes Entregas/Motorista/Passageiro | Safe areas, status bar nativa e teclados em dispositivos Android | Sem botão atrás de recorte/barra/teclado; configuração e plugin realmente funcionam |
| Busca Entregador | Movimento reduzido ligado/desligado, sem rede, falha/sucesso de consulta mockados | Sem animação quando reduzido; texto de status e condições de servidor continuam compreensíveis |
| Estado de carregamento/erro/vazio | Dados sintéticos longos, zoom/texto alto, TalkBack | Não confundir vazio com erro, texto anunciado e nenhuma operação real disparada |

**Gate de entrada:** checkout/artefato de teste gerado de commit conhecido, sem sessão de produção, ambiente do navegador com assets completos e dispositivos/versões registrados. Para APK ou publicação, permanece a exigência de autorização expressa do responsável; este relatório **não** a fornece.

## 5. Arquivos e resultado final

**Arquivo criado nesta rodada:** este relatório, `auditoria/CODEX-RELATORIO-COMUNICACAO-VISUAL19-VERIFICACAO-20261109.md`. A matriz histórica recebe somente nota RV-19 sem novos IDs. **Nenhum arquivo de funcionalidade, HTML, CSS, script de build, pacote, configuração Capacitor ou fonte pinada foi alterado.**

- Visual: **59 registros CV-001–CV-059**, sem novos registros e sem fechamento por falta de teste de interface. Próximo ID disponível: **CV-060**, condicionado a evidência concreta.
- Técnico: **67 achados históricos** preservados, A=0, B=46, C=17, D=0, E=1, G=3.
- Pendências prioritárias: CV-039 Merchant distribuído/impressão, CV-053 política de senha, CV-056 alcance de históricos e agregados, CV-057 recência de localização, CV-037 tema Motorista, CV-038 textos extensos, CV-044/045/046 validações globais.
- **Sem merge, build, Android/APK, alterações de fonte, pagamentos, dados, deploy, GitHub Actions ou automação.**

**Conclusão:** RV-19 concluída como **auditoria estática suplementar**, sem defeito novo demonstrado e sem comprovação de conformidade global em dispositivo. O próximo aumento de confiança depende da execução da matriz em ambiente visual efetivo, não de inventar mais achados por presença/ausência de tokens.
