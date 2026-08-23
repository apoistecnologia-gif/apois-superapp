import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
const workspace = process.env.APOIS_MOTORISTA_WORKSPACE || '.work/partner-motorista';

function patch(relativePath, transform, label) {
  const path = resolve(root, workspace, relativePath);
  const before = readFileSync(path, 'utf8');
  const after = transform(before);
  if (after === before) {
    console.log(`[OK] ${label} (já aplicado/sem alteração)`);
    return;
  }
  writeFileSync(path, after, 'utf8');
  console.log(`[OK] ${label}`);
}

patch('src/components/ApoisDriverBottomNav.tsx', (source) => {
  let next = source;
  next = next.replace(
    '{ to: "/motorista/carteira", label: "Carteira", icon: WalletCards },',
    '{ to: "/motorista/ganhos", label: "Ganhos", icon: WalletCards },',
  );

  next = next
    .replace('paddingBottom: "max(env(safe-area-inset-bottom), 7px)"', 'paddingBottom: "max(env(safe-area-inset-bottom), 10px)"')
    .replace('className="mx-auto grid min-h-[70px] w-full max-w-md grid-cols-5 gap-1"', 'className="mx-auto grid min-h-[82px] w-full max-w-md grid-cols-5 gap-1"')
    .replace(
      'group relative flex min-h-12 min-w-0 flex-col items-center justify-center gap-0.5 rounded-2xl px-0.5 text-zinc-400',
      'group relative flex min-h-[60px] min-w-0 flex-col items-center justify-center gap-1 rounded-2xl px-0.5 text-zinc-400',
    )
    .replace(
      'driver-nav-icon relative mt-1 flex h-8 w-10 items-center justify-center rounded-xl',
      'driver-nav-icon relative mt-1 flex h-9 w-11 items-center justify-center rounded-xl',
    )
    .replace('<item.icon className="h-5 w-5" strokeWidth={1.9} />', '<item.icon className="h-6 w-6" strokeWidth={2} />')
    .replace(
      'max-w-full break-words text-center text-[11px] font-extrabold leading-3 tracking-tight',
      'max-w-full break-words text-center text-xs font-extrabold leading-3 tracking-tight',
    );

  if (next.includes('to: "/motorista/carteira", label: "Carteira"')) {
    throw new Error('[FAIL] ApoisDriverBottomNav.tsx: carteira legada permaneceu no rodapé');
  }
  for (const marker of [
    'to: "/motorista/ganhos", label: "Ganhos"',
    'paddingBottom: "max(env(safe-area-inset-bottom), 10px)"',
    'min-h-[82px]',
    'min-h-[60px]',
    'h-9 w-11',
    'h-6 w-6',
    'text-xs font-extrabold',
  ]) {
    if (!next.includes(marker)) throw new Error(`[FAIL] ApoisDriverBottomNav.tsx: ergonomia mobile incompleta (${marker})`);
  }
  return next;
}, 'motorista: rodapé aponta para Ganhos e ganha tamanho confortável para celular');

patch('src/components/DriverSideMenu.tsx', (source) => {
  let next = source;

  // Remove a entrada Carteira pelo destino da rota, sem depender de espaçamento,
  // descrição, ícone ou formatação que hardeners anteriores possam ter alterado.
  next = next.replace(
    /\n\s*\{\s*\n\s*to:\s*["']\/motorista\/carteira["'],[\s\S]*?\n\s*\},/,
    '',
  );

  // A entrada financeira canônica é a rota /motorista/ganhos. Normalize label e
  // descrição dentro desse objeto, independentemente do wording anterior.
  const gainsObject = /(\{\s*\n\s*to:\s*["']\/motorista\/ganhos["'],)([\s\S]*?)(\n\s*\},)/;
  const gainsMatch = next.match(gainsObject);
  if (!gainsMatch) {
    throw new Error('[FAIL] DriverSideMenu.tsx: rota /motorista/ganhos não encontrada no menu');
  }
  let gainsBody = gainsMatch[2];
  gainsBody = gainsBody
    .replace(/label:\s*["'][^"']*["'],/, 'label: "Ganhos",')
    .replace(/description:\s*["'][^"']*["'],/, 'description: "Recebimentos das corridas",');
  next = next.replace(gainsObject, `${gainsMatch[1]}${gainsBody}${gainsMatch[3]}`);

  // Coins só era usado pela carteira antiga. Remova o import se não houver outro uso.
  const withoutImportBlock = next.replace(/\bCoins,\s*\n?/g, '');
  if (!/\bCoins\b/.test(withoutImportBlock)) next = withoutImportBlock;

  if (/to:\s*["']\/motorista\/carteira["']/.test(next)) {
    throw new Error('[FAIL] DriverSideMenu.tsx: rota de carteira legada permaneceu no menu');
  }

  const finalGains = next.match(gainsObject)?.[0] ?? '';
  for (const marker of ['label: "Ganhos"', 'description: "Recebimentos das corridas"']) {
    if (!finalGains.includes(marker)) {
      throw new Error(`[FAIL] DriverSideMenu.tsx: menu de ganhos direto não foi aplicado (${marker})`);
    }
  }
  return next;
}, 'motorista: menu lateral remove carteira duplicada e usa Ganhos');

console.log(`[OK] navegação financeira e ergonomia mobile do Motorista endurecidas em ${workspace}`);
