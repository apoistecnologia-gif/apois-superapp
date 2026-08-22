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
  if (next.includes('to: "/motorista/carteira", label: "Carteira"')) {
    throw new Error('[FAIL] ApoisDriverBottomNav.tsx: carteira legada permaneceu no rodapé');
  }
  if (!next.includes('to: "/motorista/ganhos", label: "Ganhos"')) {
    throw new Error('[FAIL] ApoisDriverBottomNav.tsx: atalho Ganhos não foi aplicado');
  }
  return next;
}, 'motorista: rodapé aponta diretamente para Ganhos');

patch('src/components/DriverSideMenu.tsx', (source) => {
  let next = source;
  const legacyWallet = `  {\n    to: \"/motorista/carteira\",\n    label: \"Carteira\",\n    description: \"Saldo e movimentações\",\n    icon: Coins,\n  },\n`;
  next = next.replace(legacyWallet, '');
  next = next.replace('  Coins,\n', '');
  next = next.replace(
    `    label: "Financeiro",\n    description: "Ganhos e repasses",`,
    `    label: "Ganhos",\n    description: "Recebimentos das corridas",`,
  );
  if (next.includes('to: "/motorista/carteira"')) {
    throw new Error('[FAIL] DriverSideMenu.tsx: rota de carteira legada permaneceu no menu');
  }
  if (!next.includes('description: "Recebimentos das corridas"')) {
    throw new Error('[FAIL] DriverSideMenu.tsx: menu de ganhos direto não foi aplicado');
  }
  return next;
}, 'motorista: menu lateral remove carteira duplicada e usa Ganhos');

console.log(`[OK] navegação financeira do Motorista endurecida em ${workspace}`);
