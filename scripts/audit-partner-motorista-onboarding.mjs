import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

let failed = false;
function read(path) {
  const full = resolve(path);
  if (!existsSync(full)) {
    console.error(`[FAIL] Motorista onboarding: arquivo ausente ${path}`);
    failed = true;
    return '';
  }
  return readFileSync(full, 'utf8');
}
function requireAll(path, markers, label) {
  const source = read(path);
  if (!source) return;
  const missing = markers.filter((marker) => !source.includes(marker));
  if (missing.length) {
    console.error(`[FAIL] ${label}: ${missing.join(' | ')}`);
    failed = true;
  } else console.log(`[OK] ${label}`);
}

requireAll('scripts/harden-partner-motorista-onboarding.mjs', [
  'src/routes/motorista.cadastro.tsx',
  'src/routes/motorista.status.tsx',
  'window.location.replace("../../index.html")',
  'Trocar perfil de parceiro',
  'async function switchAccount()',
  'await supabase.auth.signOut();',
], 'hardener diferencia retorno ao seletor de troca real de conta');

requireAll('scripts/build-partner-release.sh', [
  'harden-partner-motorista-onboarding.mjs',
], 'build aplica e valida handoff do cadastro/status do Motorista');

// O fluxo usa seletor de arquivos HTML; não depende do plugin Camera nativo para funcionar.
requireAll('sources/apois-corridas-motorista-admin/src/routes/motorista.documentos.tsx', [
  'type="file"',
  'image/jpeg,image/png,image/webp',
  'application/pdf',
  'MAX_IMAGE_BYTES = 8 * 1024 * 1024',
  'MAX_DOCUMENT_BYTES = 12 * 1024 * 1024',
  'uploadDriverDocument(config.slot, file)',
], 'documentos do Motorista validam formato/tamanho e usam upload controlado');

requireAll('sources/apois-corridas-motorista-admin/src/components/ProfilePhotoUploader.tsx', [
  'type="file"',
  'accept="image/jpeg,image/jpg,image/png,image/webp"',
  'compressImageToSquare(file, { size: 512, quality: 0.85 })',
  'validateProfilePhotoFile(file)',
  'uploadProfilePhoto(safeUserId, compressed)',
], 'foto de perfil usa seletor de arquivo, validação e compressão sem exigir plugin Camera');

requireAll('sources/apois-corridas-motorista-admin/src/routes/motorista.status.tsx', [
  'async function switchAccount()',
  'await supabase.auth.signOut();',
  'to="/motorista/documentos"',
  'apois-driver-status-self',
], 'status preserva troca explícita de conta, correção documental e atualização Realtime');

process.exit(failed ? 1 : 0);
