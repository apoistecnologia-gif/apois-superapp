import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

function patch(relativePath, transform, verify, label, { optional = false } = {}) {
  const path = resolve('.work/entregas', relativePath);
  if (!existsSync(path)) {
    if (optional) {
      console.log(`[OK] ${label} (rota opcional ausente no snapshot atual)`);
      return;
    }
    throw new Error(`[FAIL] ${label}: arquivo ausente ${relativePath}`);
  }
  const before = readFileSync(path, 'utf8');
  const after = transform(before);
  if (!verify(after)) throw new Error(`[FAIL] ${label}: contrato não confirmado em ${relativePath}`);
  if (after !== before) writeFileSync(path, after, 'utf8');
  console.log(`[OK] ${label}${after === before ? ' (já aplicado)' : ''}`);
}

patch('src/routes/login.tsx', (source) => {
  let next = source.replaceAll('h-screen', 'h-dvh').replaceAll('min-h-screen', 'min-h-dvh');
  next = next
    .replace(
      'className="mx-auto flex w-full max-w-md flex-col px-6 pb-[max(env(safe-area-inset-bottom),2rem)] pt-8"',
      'className="mx-auto flex w-full max-w-md flex-col px-5 pb-[calc(max(env(safe-area-inset-bottom),1.5rem)+5.5rem)] pt-6 sm:px-6"',
    )
    .replaceAll('className="mt-10 space-y-5"', 'className="mt-7 space-y-4"')
    .replaceAll('className="mt-7 text-center"', 'className="mt-5 px-2 text-center"')
    .replaceAll('className="text-sm text-zinc-500"', 'className="break-words text-sm leading-6 text-zinc-500"')
    .replaceAll('className="-ml-2 rounded-full p-2 transition-colors hover:bg-white/10"', 'className="-ml-2 grid h-11 w-11 shrink-0 place-items-center rounded-full transition-colors hover:bg-white/10"')
    .replaceAll('className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300"', 'className="absolute right-1 top-1/2 grid h-11 w-11 -translate-y-1/2 place-items-center rounded-xl text-zinc-500 hover:bg-white/5 hover:text-zinc-300"')
    .replaceAll('className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-500 active:text-zinc-300"', 'className="absolute right-1 top-1/2 grid h-11 w-11 -translate-y-1/2 place-items-center rounded-xl text-zinc-500 active:text-zinc-300"')
    .replaceAll('className="text-sm font-bold text-primary hover:underline disabled:opacity-50"', 'className="inline-flex min-h-11 items-center rounded-xl px-2 text-sm font-bold text-primary hover:bg-primary/5 disabled:opacity-50"')
    .replaceAll('className="text-xs font-bold text-primary disabled:opacity-50"', 'className="inline-flex min-h-11 items-center rounded-xl px-2 text-xs font-bold text-primary disabled:opacity-50"')
    .replaceAll('className="font-bold text-primary hover:underline"', 'className="inline-flex min-h-11 items-center rounded-lg px-1 font-bold text-primary"')
    .replaceAll('className="font-black text-primary"', 'className="inline-flex min-h-11 items-center rounded-lg px-1 font-black text-primary"');
  return next;
}, (source) =>
  source.includes('grid h-11 w-11') &&
  source.includes('inline-flex min-h-11 items-center') &&
  source.includes('pb-[calc(max(env(safe-area-inset-bottom),1.5rem)+5.5rem)]') &&
  source.includes('break-words text-sm leading-6') &&
  source.includes('min-h-dvh') &&
  !source.includes('h-screen'),
'Entregas: login central mantém controles de senha, recuperação e cadastro tocáveis');

patch('src/routes/register.tsx', (source) => {
  let next = source.replaceAll('h-screen', 'h-dvh').replaceAll('min-h-screen', 'min-h-dvh');
  next = next
    .replaceAll('className="rounded-full p-2 transition-colors hover:bg-white/10"', 'className="grid h-11 w-11 shrink-0 place-items-center rounded-full transition-colors hover:bg-white/10"')
    .replaceAll('className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300"', 'className="absolute right-1 top-1/2 grid h-11 w-11 -translate-y-1/2 place-items-center rounded-xl text-zinc-500 hover:bg-white/5 hover:text-zinc-300"')
    .replaceAll('className="font-bold text-primary"', 'className="inline-flex min-h-11 items-center rounded-lg px-1 font-bold text-primary"');
  return next;
}, (source) =>
  source.includes('min-h-dvh') &&
  !source.includes('h-screen'),
'Entregas: cadastro usa viewport dinâmica e controles compactos adequados ao toque');

for (const route of ['src/routes/recuperar-senha.tsx', 'src/routes/redefinir-senha.tsx']) {
  patch(
    route,
    (source) => source.replaceAll('h-screen', 'h-dvh').replaceAll('min-h-screen', 'min-h-dvh'),
    (source) => !source.includes('h-screen'),
    `Entregas: ${route} não depende de 100vh fixo com teclado aberto`,
    { optional: route.endsWith('/recuperar-senha.tsx') },
  );
}

console.log('[OK] Entregas: autenticação do Cliente preparada para toque e teclado em telas móveis.');
