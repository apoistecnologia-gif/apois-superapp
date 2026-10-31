# APOIS Corridas — homologação administrativa isolada (31/10/2026)

**Escopo:** criar prévia WEB do novo Admin Corridas, com vistoria de 13 fotos, pendências, documentos internos, comunicação ao Motorista e Central de Ocorrências. Sem APK, mudanças nos pagamentos, migração Stage-2 ou troca de domínio oficial.

## Código e auditoria
- Fonte protegida do Motorista/Admin: `apoistecnologia-gif/movvi-go-connect`, SHA pinado `9fc171050d8b5703540c49d19a8f1e9f5162775f`, somente leitura.
- Branch QA consolidada: `apoistecnologia-gif/apois-superapp@fix/entregas-homologacao-ajustes-20261030`.
- Build isolado: `scripts/build-partner-release.sh`; invoca os hardeners `scripts/fix-partner-admin-vehicle-inspection-v1.mjs`, `scripts/fix-partner-admin-pendencies-preview-v1.mjs`, `scripts/fix-partner-driver-correction-center-v1.mjs`, mais gates estáticos e typecheck.
- Build de Vercel somente WEB `scripts/build-admin-vercel-preview.sh` e config específica `admin-preview/vercel.json`. Saída `dist-admin-preview`; sem APK/AAB.
- Tentativa inicial de criar novo workflow GitHub Actions falhou no gate do projeto `audit-final-integration-v22`, que proíbe novos workflows CI/release. O arquivo novo foi **revertido**, preservando a regra. Nada foi publicado por esse caminho.
- A última execução do preflight original, anterior ao script Vercel, ficou verde: `41246461642` (3/3). Executadas novamente auditorias após os ajustes do script privado — conferir conclusão antes do release final.

## Projeto Vercel isolado
- Team: `team_shDkxHdc4ARgsiLdRaLSz0zA`.
- Projeto criado: `apois-corridas-admin-homologacao`, ID `prj_aiE8SAZZsN0qflEmMAw9qrcirQNx`.
- Repo Git ligado: `apoistecnologia-gif/apois-superapp`; root dir `admin-preview`, `sourceFilesOutsideRootDirectory=true`.
- Build da prévia configura `bash scripts/build-admin-vercel-preview.sh` e mantém o `vercel.json` de `build:merchant` do repositório raiz **intacto**.
- Environment variables públicas, escopo Preview: `CORRIDAS_VITE_SUPABASE_URL` e `VITE_SUPABASE_URL` (Corridas canônico), `CORRIDAS_VITE_SUPABASE_PUBLISHABLE_KEY`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `CORRIDAS_WEB_MAPS_API_KEY=QA_PREVIEW_MAPS_DISABLED`. Chave Maps intencionalmente desabilitada para evitar consumo externo indevido na homologação. Sem `service_role` ou chave Resend no cliente.
- **Vercel Authentication/SSO habilitada para todas as implantações** do projeto QA.
- Tentativa de staging `dpl_8wxSGiQWWzK4DcJUp2fDoGuWndR8` atingiu build, mas falhou `git_auth_required`: Vercel não autentica automaticamente submódulos privados. Tentativa anterior `dpl_FN9fjGnTNkEEovEoRpLPNVns8f4D` falhou `npm run build:merchant`, pois a configuração raiz fazia build errado; causa resolvida pelo `admin-preview/vercel.json`. **Nenhum URL está pronto para teste até status READY.**
- O domínio de produção `admin-corridas.apoisbrasil.com.br` continua vinculado ao projeto original `apois-corridas-admin` `prj_hQLbIy31b8lbvhQU0iz6U6u38Srq`. Não houve promoção, troca de DNS ou alteração no projeto antigo.

## Bloqueio externo: acesso de leitura aos submódulos privados
O build usa três submódulos privados:
1. `apoistecnologia-gif/movvi-go-connect`
2. `apoistecnologia-gif/apois-entregas`
3. `apoistecnologia-gif/say-hello-buddy-23-84b5dcbf`

Segundo a documentação oficial Vercel, submódulos Git privados falham sem autenticação: https://vercel.com/docs/builds/build-features.

O script QA foi preparado para consumir uma **variável Vercel criptografada** `APOIS_PREVIEW_GITHUB_TOKEN` apenas durante `git submodule update`. Seu valor **nunca é enviado ao navegador, repositório, logs nem conversa**; usa `GIT_ASKPASS` temporário e o remove depois.

Ação necessária na conta do usuário:
- Criar um token GitHub fine-grained com somente `Contents: Read-only`, acesso aos três repositórios, expiração curta.
- Salvar o valor diretamente no projeto `apois-corridas-admin-homologacao` em **Settings → Environment Variables**, chave exata `APOIS_PREVIEW_GITHUB_TOKEN`, ambiente Preview, tipo Sensitive/Encrypted quando disponível.
- Não compartilhar o token com ChatGPT. Depois fazer nova tentativa de staging e verificar `READY` + login/admin/auth e análises com conta de teste, sem mutar registros reais.
- Não promover para `admin-corridas.apoisbrasil.com.br` antes da homologação e autorização explícita.

**Estado:** infraestrutura QA criada e protegida; build/página da prévia ainda não publicado com sucesso por dependência de credencial de leitura privada.
