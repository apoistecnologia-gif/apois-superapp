// RV-06 / CV-021–022: presentation-only patch in the disposable Motorista workspace.
// Preserve source snapshots, input handling, validation, native cancellation and upload.
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const FIELD = 'src/components/DriverDocumentField.tsx';
const CORRECTIONS = 'src/components/ApoisDriverCorrections.tsx';
const MARK = 'APOIS_CV06_DRIVER_DOCUMENT_GUIDANCE_V1';
const REJECT = 'APOIS_CV06_DRIVER_NATIVE_REJECTION_V1';
const CORRECTION_MARK = 'data-apois-cv06-correction-hint';

function replaceOne(source, before, after, location) {
  const found = source.split(before).length - 1;
  if (found !== 1) throw Error(`[CV06] ${location}: expected exactly one anchor, got ${found}`);
  return source.replace(before, after);
}

export function patchDriverDocumentField(source) {
  if (source.includes(MARK)) {
    if (!source.includes(REJECT) || !source.includes('id + "-requirements"')) {
      throw Error('[CV06] partial document patch');
    }
    return source;
  }
  if (!source.includes('APOIS_NATIVE_DRIVER_PHOTO_PICKER_V3') || !source.includes('APOIS_ANDROID_DRIVER_PHOTO_CAPTURE_V2')) {
    throw Error('[CV06] expected native/photo generated baseline is absent');
  }
  let out = replaceOne(source,
    '  const effectiveAccept = photoOnly ? PHOTO_ACCEPT : (accept || DOCUMENT_ACCEPT);',
    `  const effectiveAccept = photoOnly ? PHOTO_ACCEPT : (accept || DOCUMENT_ACCEPT);\n  // ${MARK}: use the actual accept contract and final size after preparation.\n  const acceptedFormatHint = effectiveAccept.includes("application/pdf")\n    ? "JPG, PNG, WebP ou PDF" : "JPG, PNG ou WebP";\n  const finalSizeHintMB = Math.round(MAX_BYTES / 1024 / 1024);`,
    'field accepted formats');
  out = replaceOne(out,
    '{helper && <p className="mt-1 break-words text-xs leading-5 text-slate-600">{helper}</p>}',
    `{helper && <p className="mt-1 break-words text-xs leading-5 text-slate-600">{helper}</p>}\n          <p id={id + "-requirements"} className="mt-1 break-words text-xs leading-5 text-slate-600">\n            {acceptedFormatHint}. {photoOnly ? "A foto será preparada antes do envio." : "Imagens podem ser preparadas antes do envio."} Arquivo final: até {finalSizeHintMB} MB.\n          </p>`,
    'field preventive hint');
  out = replaceOne(out,
    'aria-label={"Tirar foto para " + label}',
    'aria-label={"Tirar foto para " + label} aria-describedby={id + "-requirements"}',
    'camera input description');
  out = replaceOne(out,
    'aria-label={"Selecionar arquivo para " + label}',
    'aria-label={"Selecionar arquivo para " + label} aria-describedby={id + "-requirements"}',
    'gallery input description');
  const before = `setError(cause instanceof Error && cause.message === "native_photo_size"\n          ? "Foto muito grande. Reduza a resolução da câmera e tente novamente."\n          : "Não foi possível receber a foto do Android. Confira o acesso à câmera/fotos e tente novamente.");`;
  const after = `// ${REJECT}: keep known size errors actionable, unknown causes neutral.\n        const nativeMessage = cause instanceof Error ? cause.message : "";\n        setError(nativeMessage === "native_photo_size"\n          ? "Foto muito grande. Reduza a resolução da câmera e tente novamente."\n          : nativeMessage === "A foto precisa ter até 8 MB. Selecione uma imagem menor."\n            ? nativeMessage\n            : nativeMessage === "empty_native_photo"\n              ? "O Android não retornou a foto. Tente novamente ou escolha outra imagem."\n              : "Não foi possível preparar a foto. Tente novamente ou escolha outra imagem.");`;
  out = replaceOne(out, before, after, 'native picker error mapping');
  return out;
}

export function patchCorrectionCenter(source) {
  if (source.includes(CORRECTION_MARK)) {
    if (!source.includes('JPG, PNG ou WebP · até 8 MB para envio.')) throw Error('[CV06] partial corrections patch');
    return source;
  }
  if (!source.includes('apois_driver_my_corrections') || !source.includes('apois_driver_resubmit_corrections')) {
    throw Error('[CV06] expected corrections baseline is absent');
  }
  return replaceOne(source,
    '<span className="block font-bold">{labels[slot]} · nova foto</span>',
    `<span className="block font-bold">{labels[slot]} · nova foto</span>\n    <span ${CORRECTION_MARK} className="block break-words text-xs leading-5 text-[#596372]">JPG, PNG ou WebP · até 8 MB para envio.</span>`,
    'corrections preventive hint');
}

export function applyVisual06(workspace) {
  const fieldPath = resolve(workspace, FIELD);
  const correctionsPath = resolve(workspace, CORRECTIONS);
  // Fail before writing if either generated source has drifted.
  const fieldBefore = readFileSync(fieldPath, 'utf8');
  const correctionsBefore = readFileSync(correctionsPath, 'utf8');
  const fieldAfter = patchDriverDocumentField(fieldBefore);
  const correctionsAfter = patchCorrectionCenter(correctionsBefore);
  if (fieldAfter !== fieldBefore) writeFileSync(fieldPath, fieldAfter, 'utf8');
  if (correctionsAfter !== correctionsBefore) writeFileSync(correctionsPath, correctionsAfter, 'utf8');
  return { changed: Number(fieldAfter !== fieldBefore) + Number(correctionsAfter !== correctionsBefore) };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  const workspace = resolve(process.cwd(), process.env.APOIS_MOTORISTA_WORKSPACE || '.work/partner-motorista');
  const result = applyVisual06(workspace);
  console.log(`[OK] RV-06 Motorista: ${result.changed} generated files updated (CV-021/022).`);
}
