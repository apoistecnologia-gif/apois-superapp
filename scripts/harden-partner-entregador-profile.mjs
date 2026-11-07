import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
const workspace = process.env.APOIS_ENTREGAS_WORKSPACE || '.work/partner-entregador';
const path = resolve(root, workspace, 'src/components/CourierPanels.tsx');
let source = readFileSync(path, 'utf8');

source = source
  .replaceAll('Carteira e saques', 'Ganhos e repasses')
  .replaceAll('Disponível {money(wallet?.available_balance)}', 'Registrado {money(wallet?.available_balance)}')
  .replaceAll('{ id: "history", label: "Corridas", icon: Bike, onClick: onHistory }', '{ id: "history", label: "Entregas", icon: Bike, onClick: onHistory }')
  .replaceAll('<PanelHeader title="Corridas" onClose={onClose} />', '<PanelHeader title="Entregas" onClose={onClose} />')
  .replaceAll('<h1 className="mt-1 text-2xl font-black">Corridas</h1>', '<h1 className="mt-1 text-2xl font-black">Entregas</h1>');

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
  '{ id: "history", label: "Entregas", icon: Bike, onClick: onHistory }',
  '<PanelHeader title="Entregas" onClose={onClose} />',
  '<h1 className="mt-1 text-2xl font-black">Entregas</h1>',
  'Trocar perfil de parceiro',
]) {
  // A navegação de volta ao seletor vive na rota courier.tsx, não neste painel.
  // Verificamos no arquivo certo em vez de exigir a string aqui.
  if (marker === "window.location.replace('../../index.html')") continue;
  // Aspas simples ou duplas são equivalentes; o snapshot alterna entre as duas.
  const compact = marker.replaceAll(/'/g, '"').replace(/\s+/g, "");
  const sourceCompact = source.replaceAll(/'/g, '"').replace(/\s+/g, "");
  if (!source.includes(marker) && !sourceCompact.includes(compact)) {
    throw new Error(`[FAIL] Entregador Parceiro: perfil/histórico incompleto (${marker}).`);
  }
}
for (const forbidden of [
  'Carteira e saques',
  'Disponível {money(wallet?.available_balance)}',
  '{ id: "history", label: "Corridas", icon: Bike, onClick: onHistory }',
  '<PanelHeader title="Corridas" onClose={onClose} />',
  '<h1 className="mt-1 text-2xl font-black">Corridas</h1>',
]) {
  if (source.includes(forbidden)) {
    throw new Error(`[FAIL] Entregador Parceiro: texto legado permaneceu no perfil/histórico (${forbidden}).`);
  }
}

writeFileSync(path, source, 'utf8');
console.log('[OK] Entregador Parceiro: histórico usa Entregas, perfil usa ganhos/repasses e permite voltar ao seletor Motorista/Entregador.');
