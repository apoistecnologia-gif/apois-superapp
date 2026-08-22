import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

function patch(path, transform, verify, label) {
  const full = resolve('.work/entregas', path);
  if (!existsSync(full)) throw new Error(`[FAIL] ${label}: arquivo ausente ${path}`);
  const before = readFileSync(full, 'utf8');
  const after = transform(before);
  if (!verify(after)) throw new Error(`[FAIL] ${label}: contrato móvel não confirmado em ${path}`);
  if (after !== before) writeFileSync(full, after, 'utf8');
  console.log(`[OK] ${label}${after === before ? ' (já aplicado)' : ''}`);
}

patch('src/routes/checkout.tsx', (source) => {
  let next = source;
  next = next.replaceAll('min-h-screen', 'min-h-dvh').replaceAll('h-screen', 'h-dvh');
  next = next.replace(
    '<div className="flex min-h-dvh w-full flex-col bg-black p-6 text-white">',
    '<div className="flex min-h-dvh w-full flex-col bg-black px-4 pb-[max(env(safe-area-inset-bottom),1.25rem)] pt-[max(env(safe-area-inset-top),1rem)] text-white sm:px-6">',
  );
  next = next.replace(
    '<header className="mb-8 mt-4 flex flex-col items-center justify-center space-y-2">',
    '<header className="mb-6 flex flex-col items-center justify-center space-y-2 text-center">',
  );
  next = next.replaceAll('className="h-64 w-64"', 'className="h-[min(68vw,16rem)] w-[min(68vw,16rem)] max-h-64 max-w-64"');
  next = next.replace(
    'className="grid h-64 w-64 place-items-center bg-white text-center text-sm font-bold text-black"',
    'className="grid h-[min(68vw,16rem)] w-[min(68vw,16rem)] max-h-64 max-w-64 place-items-center bg-white px-3 text-center text-sm font-bold text-black"',
  );
  next = next.replace(
    'className="rounded-lg bg-primary p-2 text-black transition-transform active:scale-95"',
    'className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-primary text-black transition-transform active:scale-95"',
  );
  next = next.replace(
    '<p className="flex-1 truncate font-mono text-[10px] text-zinc-400">',
    '<p className="min-w-0 flex-1 break-all font-mono text-[11px] leading-4 text-zinc-400 line-clamp-3">',
  );
  return next;
}, (source) =>
  source.includes('min-h-dvh') &&
  source.includes('pb-[max(env(safe-area-inset-bottom),1.25rem)]') &&
  source.includes('pt-[max(env(safe-area-inset-top),1rem)]') &&
  source.includes('h-[min(68vw,16rem)]') &&
  source.includes('grid h-11 w-11 shrink-0 place-items-center') &&
  source.includes('break-all font-mono text-[11px]') &&
  !/\b(?:min-)?h-screen\b/.test(source),
'Entregas: checkout Pix adapta QR, safe-area, viewport e botão copiar a celulares estreitos');

const touchRoutes = [
  'src/routes/favoritos.tsx',
  'src/routes/pedidos.tsx',
  'src/routes/notificacoes.tsx',
  'src/routes/perfil/pagamentos.tsx',
  'src/routes/perfil/notificacoes.tsx',
  'src/routes/perfil/legal.tsx',
  'src/routes/perfil/ajuda.tsx',
  'src/routes/perfil/dados-pessoais.tsx',
  'src/routes/pedido/$orderId/avaliar.tsx',
  'src/routes/chamado-suporte.$ticketId.tsx',
  'src/routes/termos.tsx',
  'src/routes/privacidade.tsx',
];

for (const relativePath of touchRoutes) {
  patch(relativePath, (source) => source
    .replaceAll('className="rounded-full bg-zinc-900 p-2"', 'className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-zinc-900"')
    .replaceAll('className="rounded-full bg-zinc-900/80 p-2"', 'className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-zinc-900/80"')
    .replaceAll('className="rounded-full bg-black/50 p-2"', 'className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-black/50"'),
  (source) =>
    !source.includes('className="rounded-full bg-zinc-900 p-2"') &&
    !source.includes('className="rounded-full bg-zinc-900/80 p-2"') &&
    !source.includes('className="rounded-full bg-black/50 p-2"'),
  `Entregas: ${relativePath} não mantém controles circulares abaixo de 44px`);
}

patch('src/routes/perfil/ajuda.tsx', (source) => source
  .replace(
    'className="flex items-center gap-1 text-xs font-bold text-primary"',
    'className="inline-flex min-h-11 items-center gap-1 rounded-xl px-3 text-xs font-bold text-primary"',
  )
  .replaceAll(
    'className="mt-3 text-xs font-black text-primary"',
    'className="mt-2 inline-flex min-h-11 items-center rounded-xl px-3 text-xs font-black text-primary"',
  ),
(source) =>
  source.includes('inline-flex min-h-11 items-center gap-1') &&
  source.includes('inline-flex min-h-11 items-center rounded-xl px-3 text-xs font-black'),
'Entregas: Ajuda transforma Novo e Ver conversa em alvos de toque reais');

patch('src/routes/perfil/ajuda/chamado/$ticketId.tsx', (source) => source
  .replace(
    'className="inline-flex items-center gap-2 rounded-xl border border-zinc-800 bg-black/40 px-3 py-2 text-xs font-bold text-zinc-300 disabled:opacity-50"',
    'className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-zinc-800 bg-black/40 px-3 py-2 text-xs font-bold text-zinc-300 disabled:opacity-50"',
  )
  .replace(
    'className="text-zinc-600 hover:text-white"',
    'className="-mr-2 grid h-11 w-11 shrink-0 place-items-center rounded-xl text-zinc-600 hover:bg-zinc-900 hover:text-white"',
  ),
(source) =>
  source.includes('inline-flex min-h-11 items-center gap-2') &&
  source.includes('grid h-11 w-11 shrink-0 place-items-center rounded-xl text-zinc-600'),
'Entregas: conversa de suporte amplia anexos e remoção de arquivo para toque seguro');

console.log('[OK] Entregas: checkout, Ajuda, conversa de suporte e controles circulares do cliente foram endurecidos para toque, safe-area e telas estreitas.');
