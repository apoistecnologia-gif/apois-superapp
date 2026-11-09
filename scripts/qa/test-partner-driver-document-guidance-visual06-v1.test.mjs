import assert from 'node:assert/strict';
import { readFileSync, mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, resolve, join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import { patchDriverDocumentField, patchCorrectionCenter, applyVisual06 } from '../fix-partner-driver-document-guidance-visual06-v1.mjs';

const project = resolve(fileURLToPath(new URL('../..', import.meta.url)));
const scripts = resolve(project, 'scripts');
const fieldRel = 'src/components/DriverDocumentField.tsx';
const correctionRel = 'src/components/ApoisDriverCorrections.tsx';
function generatedLiteral(file, regex) {
  const source = readFileSync(resolve(scripts, file), 'utf8');
  const found = source.match(regex);
  assert.ok(found, `generated literal missing in ${file}`);
  return JSON.parse(found[1]);
}
function makeFieldWithNative(work) {
  const v2 = generatedLiteral('fix-partner-driver-photo-capture-v2.mjs', /const updated = ("(?:\\.|[^"\\])*");\n  writeFileSync\(path, updated, "utf8"\);/);
  const field = resolve(work, fieldRel);
  mkdirSync(dirname(field), { recursive: true });
  writeFileSync(field, v2, 'utf8');
  const native = spawnSync(process.execPath, [resolve(scripts,'fix-partner-driver-native-photo-v3.mjs')], { cwd: dirname(dirname(work)), encoding: 'utf8' });
  assert.equal(native.status, 0, native.stderr);
  return readFileSync(field, 'utf8');
}
function makeCorrections(work) {
  const v1 = generatedLiteral('fix-partner-driver-correction-center-v1.mjs', /writeFileSync\(target,("(?:\\.|[^"\\])*"),"utf8"\);/);
  const file = resolve(work, correctionRel);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, v1, 'utf8');
  const red = spawnSync(process.execPath, [resolve(scripts,'fix-partner-driver-corrections-red-v2.mjs')], { cwd: dirname(dirname(work)), encoding: 'utf8' });
  assert.equal(red.status, 0, red.stderr);
  return readFileSync(file, 'utf8');
}
function fixture(run) {
  const root = mkdtempSync(join(tmpdir(), 'apois-cv06-'));
  const work = resolve(root, '.work/partner-motorista');
  try { return run(work); } finally { rmSync(root, { recursive: true, force: true }); }
}

test('CV-021: actual V2/V3 field presents photo/document formats and final 8 MB before selection', () => fixture(work => {
  const before = makeFieldWithNative(work);
  const after = patchDriverDocumentField(before);
  assert.match(after, /acceptedFormatHint = effectiveAccept.includes\("application\/pdf"\)/);
  assert.match(after, /"JPG, PNG, WebP ou PDF" : "JPG, PNG ou WebP"/);
  assert.match(after, /finalSizeHintMB = Math.round\(MAX_BYTES \/ 1024 \/ 1024\)/);
  assert.match(after, /id=\{id \+ "-requirements"\}/);
  assert.equal((after.match(/aria-describedby=\{id \+ "-requirements"\}/g) || []).length, 2);
  assert.match(after, /\{helper\}<!?\/p>/);
  assert.match(after, /onChange=\{\(e\) => void handle\(e.currentTarget.files\?\.\[0\]\)\}/);
  assert.match(after, /handleNative\("camera"\)/);
  assert.match(after, /handleNative\("gallery"\)/);
  assert.match(after, /aria-live="polite"/);
  assert.match(after, /role="alert"/);
  assert.match(after, /onChange\(out\)/);
  assert.equal(patchDriverDocumentField(after), after);
}));

test('CV-022: native final-size rejection preserved; cancellation remains silent, unknown errors neutral', () => fixture(work => {
  const before = makeFieldWithNative(work);
  const after = patchDriverDocumentField(before);
  assert.match(before, /throw new Error\("A foto precisa ter até 8 MB\. Selecione uma imagem menor\."\)/);
  assert.match(after, /nativeMessage === "A foto precisa ter até 8 MB\. Selecione uma imagem menor\."\s*\? nativeMessage/);
  assert.match(after, /nativeMessage === "native_photo_size"/);
  assert.match(after, /nativeMessage === "empty_native_photo"/);
  assert.match(after, /if \(!isNativePickerCancellation\(cause\)\)/);
  assert.doesNotMatch(after, /Confira o acesso à câmera\/fotos/);
  assert.match(after, /Não foi possível preparar a foto\. Tente novamente ou escolha outra imagem\./);
  assert.match(after, /maxSize: 1600, quality: 0\.85/);
}));

test('CV-021: central accepts photos only; hint is preventive without changing the upload contract', () => fixture(work => {
  const before = makeCorrections(work);
  const after = patchCorrectionCenter(before);
  assert.match(after, /data-apois-cv06-correction-hint/);
  assert.match(after, /JPG, PNG ou WebP · até 8 MB para envio\./);
  assert.match(after, /accept="image\/jpeg,image\/png,image\/webp"/);
  assert.doesNotMatch(after, /data-apois-cv06-correction-hint[^\n]*PDF/);
  for (const contract of ['apois_driver_my_corrections','apois_driver_resubmit_corrections','apois-inspections','void sendPhoto(slot,file)']) {
    assert.ok(after.includes(contract), `${contract} preserved`);
  }
  assert.equal(patchCorrectionCenter(after), after);
}));

test('CV-021/022: patch is idempotent, fails closed on drift and never edits source snapshots', () => fixture(work => {
  makeFieldWithNative(work);
  makeCorrections(work);
  assert.equal(applyVisual06(work).changed, 2);
  assert.equal(applyVisual06(work).changed, 0);
  const field = readFileSync(resolve(work, fieldRel),'utf8');
  const correction = readFileSync(resolve(work, correctionRel),'utf8');
  assert.equal((field.match(/APOIS_CV06_DRIVER_DOCUMENT_GUIDANCE_V1/g) || []).length, 1);
  assert.equal((correction.match(/data-apois-cv06-correction-hint/g) || []).length, 1);
  assert.throws(() => patchDriverDocumentField(field.replace('APOIS_CV06_DRIVER_NATIVE_REJECTION_V1','')), /partial/);
  assert.throws(() => patchDriverDocumentField(field.replace('APOIS_CV06_DRIVER_DOCUMENT_GUIDANCE_V1', '').replace('const effectiveAccept', 'const otherAccept')), /anchor/);
  assert.throws(() => patchCorrectionCenter('other component'), /baseline/);
}));
