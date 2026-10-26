import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

function patch(relativePath, transform, verify, label) {
  const path = resolve('.work/entregas', relativePath);
  const before = readFileSync(path, 'utf8');
  const after = transform(before);
  if (!verify(after)) throw new Error(`[FAIL] ${label}: contrato móvel não confirmado em ${relativePath}`);
  if (after !== before) writeFileSync(path, after, 'utf8');
  console.log(`[OK] ${label}${after === before ? ' (já aplicado)' : ''}`);
}

patch('src/routes/pedido/confirmado.tsx', (source) => {
  let next = source.replaceAll('h-screen', 'h-dvh');
  next = next.replace(
    '<div className="flex h-dvh w-full flex-col items-center justify-center bg-black p-6 text-center text-white">',
    '<div className="flex min-h-dvh w-full flex-col items-center overflow-y-auto bg-black px-4 pb-[max(52px,env(safe-area-inset-bottom))] pt-[max(env(safe-area-inset-top),1.25rem)] text-center text-white sm:px-6">',
  );
  next = next.replace(
    '<div className="mb-10 w-full space-y-4 rounded-2xl border border-accent/20 bg-zinc-950 p-6 text-left',
    '<div className="mb-6 w-full max-w-lg space-y-4 rounded-2xl border border-accent/20 bg-zinc-950 p-4 text-left sm:p-6',
  );
  next = next.replace('<div className="flex w-full flex-col gap-3">', '<div className="flex w-full max-w-lg flex-col gap-3">');
  return next;
}, (source) =>
  source.includes('min-h-dvh') && source.includes('overflow-y-auto') &&
  source.includes('pb-[max(52px,env(safe-area-inset-bottom))]') &&
  source.includes('pt-[max(env(safe-area-inset-top),1.25rem)]') &&
  !source.includes('h-screen'),
'Entregas: confirmação do pedido rola em celulares baixos e respeita safe-area');

patch('src/routes/pedido/$orderId/avaliar.tsx', (source) => {
  let next = source.replaceAll('h-screen', 'h-dvh');
  next = next.replace(
    'className="sticky top-0 z-50 flex items-center gap-4 border-b border-zinc-900 bg-black/80 p-4 backdrop-blur-lg"',
    'className="sticky top-0 z-50 flex items-center gap-3 border-b border-zinc-900 bg-black/80 px-4 pb-3 pt-[max(env(safe-area-inset-top),0.85rem)] backdrop-blur-lg"',
  );
  next = next.replace(
    'className="rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:cursor-default"',
    'className="grid h-11 w-11 shrink-0 place-items-center rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:cursor-default"',
  );
  next = next.replace('<main className="flex-1 space-y-8 overflow-y-auto p-6">', '<main className="flex-1 space-y-6 overflow-y-auto px-4 py-5 sm:px-6">');
  next = next.replace(
    '<footer className="border-t border-zinc-900 bg-black p-4">',
    '<footer className="shrink-0 border-t border-zinc-900 bg-black px-4 pb-[max(52px,env(safe-area-inset-bottom))] pt-3">',
  );
  return next;
}, (source) =>
  source.includes('h-dvh') && source.includes('grid h-11 w-11 shrink-0 place-items-center rounded-xl') &&
  source.includes('pt-[max(env(safe-area-inset-top),0.85rem)]') &&
  source.includes('pb-[max(52px,env(safe-area-inset-bottom))]') &&
  !source.includes('h-screen'),
'Entregas: avaliação usa estrelas tocáveis e safe-areas corretas');

console.log('[OK] Entregas: telas finais do pedido adaptadas a celulares pequenos.');
