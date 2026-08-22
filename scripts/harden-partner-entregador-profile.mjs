import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
const workspace = process.env.APOIS_ENTREGAS_WORKSPACE || '.work/partner-entregador';
const path = resolve(root, workspace, 'src/components/CourierPanels.tsx');
let source = readFileSync(path, 'utf8');

source = source
  .replaceAll('Carteira e saques', 'Ganhos e repasses')
  .replaceAll('Disponível {money(wallet?.available_balance)}', 'Registrado {money(wallet?.available_balance)}');

if (!source.includes('Trocar perfil de parceiro')) {
  const logoutBlock = `        <button\n          type="button"\n          onClick={onLogout}\n          className="w-full rounded-2xl border border-red-500/20 bg-red-500/5 p-4 font-black text-red-300 active:scale-[0.99]"\n        >\n          Sair da conta\n        </button>`;
  if (!source.includes(logoutBlock)) {
    throw new Error('[FAIL] Entregador Parceiro: botão de logout do perfil não encontrado.');
  }
  const switchButton = `        <button\n          type="button"\n          onClick={() => window.location.replace('../../index.html')}\n          className="w-full rounded-2xl border border-primary/25 bg-primary/10 p-4 font-black text-primary active:scale-[0.99]"\n        >\n          Trocar perfil de parceiro\n        </button>\n\n${logoutBlock}`;
  source = source.replace(logoutBlock, switchButton);
}

for (const marker of [
  'Ganhos e repasses',
  'Registrado {money(wallet?.available_balance)}',
  'Trocar perfil de parceiro',
  "window.location.replace('../../index.html')",
]) {
  if (!source.includes(marker)) {
    throw new Error(`[FAIL] Entregador Parceiro: perfil incompleto (${marker}).`);
  }
}
for (const forbidden of [
  'Carteira e saques',
  'Disponível {money(wallet?.available_balance)}',
]) {
  if (source.includes(forbidden)) {
    throw new Error(`[FAIL] Entregador Parceiro: linguagem financeira legada permaneceu no perfil (${forbidden}).`);
  }
}

writeFileSync(path, source, 'utf8');
console.log('[OK] Entregador Parceiro: perfil usa ganhos/repasses e permite voltar ao seletor Motorista/Entregador sem encerrar a conta.');
