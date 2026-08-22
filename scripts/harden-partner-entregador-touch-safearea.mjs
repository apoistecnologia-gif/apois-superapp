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
  'src/components/CourierPanels.tsx',
  (source) => {
    let next = source;
    next = next.replace('{ id: "history", label: "Corridas", icon: Bike, onClick: onHistory },', '{ id: "history", label: "Entregas", icon: Bike, onClick: onHistory },');
    next = next.replace('      <PanelHeader title="Corridas" onClose={onClose} />', '      <PanelHeader title="Entregas" onClose={onClose} />');
    next = next.replace('          <h1 className="mt-1 text-2xl font-black">Corridas</h1>', '          <h1 className="mt-1 text-2xl font-black">Entregas</h1>');
    next = next
      .replace('pb-[max(0.65rem,env(safe-area-inset-bottom))] pt-2', 'pb-[max(0.85rem,env(safe-area-inset-bottom))] pt-2.5')
      .replace('className="mx-auto grid max-w-lg grid-cols-4 gap-1"', 'className="mx-auto grid min-h-[82px] max-w-lg grid-cols-4 gap-1"')
      .replace('relative flex min-h-[3.7rem] flex-col items-center justify-center gap-1 rounded-2xl text-[10px] font-bold', 'relative flex min-h-[64px] min-w-0 flex-col items-center justify-center gap-1 rounded-2xl px-1 text-xs font-bold')
      .replace('className={`grid h-8 w-10 place-items-center rounded-xl transition ${', 'className={`grid h-9 w-11 place-items-center rounded-xl transition ${')
      .replace('className={`h-5 w-5 ${selected ? "stroke-[2.5]" : "stroke-2"}`}', 'className={`h-6 w-6 ${selected ? "stroke-[2.5]" : "stroke-2"}`}');
    next = next.replace(
      'className="sticky top-0 z-40 grid min-h-20 grid-cols-[2.75rem_1fr_2.75rem] items-center border-b border-accent/15 bg-black/92 px-4 pt-[env(safe-area-inset-top)] backdrop-blur-2xl"',
      'className="sticky top-0 z-40 grid min-h-[5.25rem] grid-cols-[2.75rem_1fr_2.75rem] items-center border-b border-accent/15 bg-black/92 px-4 pb-2 pt-[max(env(safe-area-inset-top),0.65rem)] backdrop-blur-2xl"',
    );
    return next;
  },
  (source) =>
    source.includes('label: "Entregas"') &&
    source.includes('<PanelHeader title="Entregas"') &&
    source.includes('>Entregas</h1>') &&
    source.includes('min-h-[82px]') && source.includes('min-h-[64px]') &&
    source.includes('h-9 w-11') && source.includes('h-6 w-6') &&
    source.includes('pt-[max(env(safe-area-inset-top),0.65rem)]'),
  'entregador: rodapé usa nomenclatura Entregas, alvos confortáveis e safe-area correta',
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

console.log(`[OK] ergonomia, nomenclatura e safe-area do Entregador Parceiro endurecidas em ${workspace}`);
