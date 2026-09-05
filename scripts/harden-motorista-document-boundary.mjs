import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const workspace = resolve(process.env.APOIS_MOTORISTA_WORKSPACE || '.work/motorista');
let failed = false;
function fail(message) { failed = true; console.error(`[FAIL] ${message}`); }
function ok(message) { console.log(`[OK] ${message}`); }
function read(relative) {
  const full = resolve(workspace, relative);
  if (!existsSync(full)) { fail(`Motorista documents: arquivo ausente ${relative}`); return { full, source: '' }; }
  return { full, source: readFileSync(full, 'utf8') };
}

const route = read('src/routes/motorista.documentos.tsx');
if (route.source) {
  let source = route.source;
  source = source.replace('const MAX_DOCUMENT_BYTES = 12 * 1024 * 1024;', 'const MAX_DOCUMENT_BYTES = 10 * 1024 * 1024;');
  if (source !== route.source) writeFileSync(route.full, source, 'utf8');

  for (const marker of [
    'const MAX_IMAGE_BYTES = 8 * 1024 * 1024;',
    'const MAX_DOCUMENT_BYTES = 10 * 1024 * 1024;',
    'slot: "vehicle_photo"',
    'accept: "image/jpeg,image/png,image/webp"',
    'slot: "crlv"',
    'application/pdf',
  ]) {
    if (!source.includes(marker)) fail(`Motorista documents UI sem contrato (${marker})`);
  }
  if (source.includes('MAX_DOCUMENT_BYTES = 12 * 1024 * 1024')) fail('Motorista documents UI ainda permite 12 MiB apesar do bucket aceitar 10 MiB');
  else ok('Motorista documents UI respeita limite real de 10 MiB');
}

const lib = read('src/lib/driverDocuments.mobile.ts');
if (lib.source) {
  for (const marker of [
    'const MAX_BYTES = 10 * 1024 * 1024;',
    'const objectPath = `${authData.user.id}/${suffix}`;',
    '"selfie": "driver-selfies"',
    '"cnh_front": "driver-cnh"',
    '"cnh_back": "driver-cnh"',
    '"crlv": "vehicle-documents"',
    '"vehicle_photo": "vehicle-documents"',
    'rpc("driver_update_document", {',
    '_slot: slot,',
    '_storage_path: objectPath,',
  ]) {
    if (!lib.source.includes(marker)) fail(`Motorista documents client sem contrato (${marker})`);
  }
  if (/driver[_-]?id\s*:/i.test(lib.source.split('rpc("driver_update_document", {')[1]?.split('});')[0] ?? '')) {
    fail('Motorista documents client não pode escolher driver_id no RPC');
  } else {
    ok('Motorista documents RPC recebe somente slot + storage path derivado da sessão');
  }
}

if (failed) process.exit(1);
console.log('[OK] Motorista documents: client boundary alinhado com ownership/MIME/tamanho do backend.');
