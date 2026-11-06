# APOIS Motorista — Correção do perfil e fotografia — 06/11/2026

## Evidência
Captura enviada pelo usuário: erro "Não foi possível enviar a foto. Verifique a imagem e tente novamente.", resumo 0 corridas e palavra "AVALIAÇÕES" quebrada dentro do terceiro cartão.

## Diagnóstico confirmado por leitura das fontes
- `ProfilePhotoUploader.tsx` escondia todo erro concreto por meio de `friendlyPhotoError` e apresentava apenas uma mensagem genérica.
- `profilePhoto.ts` grava a foto em `profile-photos/{auth.uid()}/avatar-{timestamp}.jpg|png|webp`, associa ao perfil por RPC `set_own_profile_photo` e solicita `createSignedUrl`; antes, o bucket privado tinha apenas política INSERT, sem política SELECT para o próprio dono. Supabase requer SELECT para criar URL assinada.
- A tabela `public.drivers` não possui coluna `completed_rides`. `driver_get_profile()` devolve a linha da tabela `drivers`, então o valor inexistente era interpretado como zero. Conferência agregada: três motoristas cadastrados, 11 corridas finalizadas, e nenhum contador válido no esquema `drivers`. Valores individuais não foram expostos.
- A função `apois_rpc_private.get_driver_public_profile` referenciava as colunas inexistentes `d.completed_rides` e `d.average_rating`; coluna real de nota é `d.rating`.
- No `StatCard`, o terceiro cartão quebrava o rótulo por ausência de `whitespace-nowrap` e excesso de tamanho da tipografia.

## Mudanças já aplicadas ao Supabase produção Corridas
Projeto `tbbzkrfupmqdywnzgnms`; não alterar Entregas.
1. Migração `apois_profile_photos_owner_select_20261106`: política `storage.objects SELECT TO authenticated` limitada ao bucket `profile-photos` e primeiro segmento igual a `auth.uid()`, sem subpastas. Bucket continua privado; não foi concedido acesso anônimo nem a arquivos de terceiros. A política foi consultada após aplicação.
2. Migração `fix_driver_public_profile_real_columns_20261106`: `apois_rpc_private.get_driver_public_profile` usa `d.rating AS average_rating` e contagem `public.rides` por `drivers.id`, com filtro `status='finalizada'`. Foram mantidos checks de dono autenticado, staff autorizado e passageiro da corrida. Definição SQL verificada após aplicação.

Não houve atualização manual de corrida, nota, foto, conta, pagamento ou transação.

## Correção no Android em branch de homologação
Branch `fix/apois-corridas-e2e-homologacao-20261106` do `apoistecnologia-gif/apois-superapp`.
- `scripts/fix-apois-motorista-profile-screenshot-v2.mjs` aplicado depois do seletor nativo da galeria, somente na `.work/partner-motorista`.
- Erros de foto mostram mensagens concretas da própria aplicação previamente aprovadas; nunca exibem SQL, IDs, JWT, token nem resposta crua do backend.
- Métrica de corridas usa `supabase.from('rides').select('id',{count:'exact',head:true}).eq('driver_id',nextDriver.id).eq('status','finalizada')`, a mesma tabela/identidade utilizada pelo Histórico do Motorista. Se o servidor bloquear a contagem, exibe `—`, nunca zero artificial.
- `StatCard` mantém as classes anteriores e adiciona texto que não quebra em telas pequenas.
- `scripts/verify-apois-motorista-profile-screenshot-v2.mjs` valida invariantes de armazenamento, imagem nativa, contagem correta e layout.
- `scripts/build-partner-release.sh` aplica e verifica os dois scripts no trecho Motorista, sem mudar Entregador.
- `.github/workflows/apois-partner-android.yml` gera APK QA via GitHub Actions quando houver correção.

## Validação / pendências
- Simulação de transformação sobre o código original das duas telas: OK.
- O primeiro CI com script novo descobriu a alteração anterior de classe CSS do cartão; patch reajustado para preservar estilos. O CI correspondente está vinculado à branch.
- Não afirmar que a foto foi realmente reenviada no Android do usuário nem que houve correção em tela sem APK instalado e teste real.
- O perfil público usa bucket privado: assinaturas para outros usuários exigirão autorização específica por corrida; não ampliar SELECT geral no bucket.
- Não fazer merge, não alterar Entregas e não ativar gateway ou cobranças.

## Procedimento de homologação
Instalar APK Parceiro de CI aprovado mais recente; testar 1) galeria nativa e mensagem real do upload; 2) reload da foto; 3) contagem versus Histórico; 4) cartão AVALIAÇÕES em tela 345 CSS px; 5) Ver perfil público.
