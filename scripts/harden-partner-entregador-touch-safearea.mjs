import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
const workspace = process.env.APOIS_ENTREGAS_WORKSPACE || '.work/partner-entregador';

function patch(relativePath, transform, verify, label) {
  const path = resolve(root, workspace, relativePath);
  const before = readFileSync(path, 'utf8');
  const after = transform(before);
  if (!verify(after)) throw new Error(`[FAIL] ${label}: contrato esperado não encontrado em ${relativePath}`);
  if (after !== before) writeFileSync(path, after, 'utf8');
  console.log(`[OK] ${label}${after === before ? ' (já aplicado)' : ''}`);
}

patch(
  'src/components/CourierPremiumViews.tsx',
  (source) => source
    .replace(
      'className={`relative h-9 w-[4.15rem] shrink-0 rounded-full border transition active:scale-95 disabled:opacity-50 ${online ?',
      'className={`relative h-12 w-[4.8rem] shrink-0 rounded-full border transition active:scale-95 disabled:opacity-50 ${online ?',
    )
    .replace(
      'className={`absolute top-1 grid h-7 w-7 place-items-center rounded-full shadow-lg transition-all ${online ? "left-[2.08rem] bg-black text-primary" : "left-1 bg-zinc-600 text-zinc-300"}`}',
      'className={`absolute top-1.5 grid h-9 w-9 place-items-center rounded-full shadow-lg transition-all ${online ? "left-[2.25rem] bg-black text-primary" : "left-1.5 bg-zinc-600 text-zinc-300"}`}',
    )
    .replace(
      'className="grid h-10 w-10 place-items-center rounded-full border border-zinc-800 bg-black text-zinc-400 active:scale-95"',
      'className="grid h-11 w-11 place-items-center rounded-full border border-zinc-800 bg-black text-zinc-400 active:scale-95"',
    ),
  (source) =>
    source.includes('relative h-12 w-[4.8rem]') &&
    source.includes('top-1.5 grid h-9 w-9') &&
    source.includes('grid h-11 w-11 place-items-center rounded-full'),
  'entregador: controles principais respeitam alvo de toque mínimo',
);

patch(
  'src/routes/courier.tsx',
  (source) => source
    .replaceAll(
      'className="grid min-h-dvh place-items-center bg-black p-5 text-white"',
      'className="grid min-h-dvh place-items-center bg-black px-5 pb-[max(env(safe-area-inset-bottom),1.25rem)] pt-[max(env(safe-area-inset-top),1.25rem)] text-white"',
    ),
  (source) =>
    source.includes('pb-[max(env(safe-area-inset-bottom),1.25rem)]') &&
    source.includes('pt-[max(env(safe-area-inset-top),1.25rem)]'),
  'entregador: loading e erro respeitam áreas seguras do Android',
);

console.log(`[OK] ergonomia e safe-area do Entregador Parceiro endurecidas em ${workspace}`);
