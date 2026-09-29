import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
const workspace = process.env.APOIS_MOTORISTA_WORKSPACE || '.work/partner-motorista';
const path = resolve(root, workspace, 'src/routes/motorista.app.tsx');
let source = readFileSync(path, 'utf8');

if (!source.includes('const pendingOfferPoll = window.setInterval')) {
  const anchor = '    window.addEventListener("online", onFocus);';
  if (!source.includes(anchor)) throw new Error('[FAIL] Motorista Parceiro: ancora de focus/online nao encontrada.');
  source = source.replace(
    anchor,
    anchor + '\n    const pendingOfferPoll = window.setInterval(() => { void resyncDriverRides(); }, 5000);',
  );
}

if (!source.includes('window.clearInterval(pendingOfferPoll);')) {
  const anchor = '      window.clearInterval(poll);';
  if (!source.includes(anchor)) throw new Error('[FAIL] Motorista Parceiro: cleanup do polling nao encontrado.');
  source = source.replace(anchor, '      window.clearInterval(pendingOfferPoll);\n' + anchor);
}

for (const marker of [
  'const pendingOfferPoll = window.setInterval',
  'void resyncDriverRides();',
  'window.clearInterval(pendingOfferPoll);',
]) {
  if (!source.includes(marker)) throw new Error('[FAIL] Motorista Parceiro: fallback de oferta incompleto');
}

writeFileSync(path, source, 'utf8');
console.log('[OK] Motorista Parceiro: ofertas pendentes sao ressincronizadas a cada 5s.');
