import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

function patch(relativePath, transform, label) {
  const full = resolve('.work/entregas', relativePath);
  if (!existsSync(full)) throw new Error('[FAIL] Entregas overlay: arquivo ausente ' + relativePath);
  const before = readFileSync(full, 'utf8');
  const after = transform(before);
  if (after !== before) writeFileSync(full, after, 'utf8');
  console.log('[OK] ' + label + (after === before ? ' (já aplicado)' : ''));
  return after;
}

function requireMarkers(source, markers, label) {
  const missing = markers.filter((marker) => !source.includes(marker));
  if (missing.length) throw new Error('[FAIL] ' + label + ': ' + missing.join(' | '));
}

// O rodapé do cliente usa z-50. Diálogos/sheets no mesmo z-index podem ficar
// atrás dele ou ter o gesto capturado pelo nav. Use uma camada modal dedicada.
for (const relativePath of [
  'src/components/ui/dialog.tsx',
  'src/components/ui/alert-dialog.tsx',
  'src/components/ui/sheet.tsx',
]) {
  const hardened = patch(relativePath, (source) =>
    source
      .replaceAll('fixed inset-0 z-50', 'fixed inset-0 z-[120]')
      .replaceAll('fixed left-[50%] top-[50%] z-50', 'fixed left-[50%] top-[50%] z-[121]')
      .replaceAll('"fixed z-50 gap-4', '"fixed z-[121] gap-4'),
  'Entregas overlay: ' + relativePath + ' fica acima do rodapé');
  requireMarkers(hardened, ['z-[120]'], relativePath + ' overlay');
}

const productSheet = patch('src/components/ProductCustomizationSheet.tsx', (source) => {
  // RV10 already normalizes 90vh to 90dvh, without changing the other classes.
  // Accept either exact pinned form, but keep the complete safe-area contract.
  const target = 'className="flex h-[90dvh] max-h-[calc(100dvh-max(env(safe-area-inset-top),12px))] flex-col overflow-hidden rounded-t-[32px] border-zinc-800 bg-zinc-950 p-0 focus:outline-none"';
  const legacy = [
    'className="h-[90vh] bg-zinc-950 border-zinc-800 p-0 rounded-t-[32px] overflow-hidden flex flex-col focus:outline-none"',
    'className="h-[90dvh] bg-zinc-950 border-zinc-800 p-0 rounded-t-[32px] overflow-hidden flex flex-col focus:outline-none"',
  ];
  let next = source;
  if (!next.includes(target)) {
    const matches = legacy.filter((anchor) => next.includes(anchor));
    if (matches.length !== 1) throw Error('[FAIL] Entregas overlay: sheet layout anchor drift');
    next = next.replace(matches[0], target);
  }
  next = next.replace(
    'pb-[max(env(safe-area-inset-bottom),1.25rem)]',
    'pb-[max(52px,env(safe-area-inset-bottom))]',
  );
  return next;
}, 'Entregas overlay: personalização usa viewport dinâmica e CTA acima da barra Android');

requireMarkers(productSheet, [
  'h-[90dvh]',
  'max-h-[calc(100dvh-max(env(safe-area-inset-top),12px))]',
  'pb-[max(52px,env(safe-area-inset-bottom))]',
], 'personalização de produto');

console.log('[OK] APOIS_ENTREGAS_OVERLAY_LAYERING_V1: modais e sheets não competem com o rodapé fixo.');
