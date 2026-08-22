import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
const workspace = process.env.APOIS_ENTREGAS_WORKSPACE || '.work/partner-entregador';
const path = resolve(root, workspace, 'src/routes/courier.tsx');
let source = readFileSync(path, 'utf8');

source = source.replace(
  '  const online = Boolean(availability?.is_online);',
  '  const online = Boolean(availability?.is_online) || Boolean(activeJob);',
);

const bottomNav = `      <CourierBottomNav\n        active="home"\n        onHome={() => window.scrollTo({ top: 0, behavior: "smooth" })}\n        onHistory={() => setHistoryOpen(true)}\n        onFinance={() => setFinanceOpen(true)}\n        onProfile={() => setProfileOpen(true)}\n      />`;
const guardedBottomNav = `      {!activeJob && !completedJob ? (\n        <CourierBottomNav\n          active="home"\n          onHome={() => window.scrollTo({ top: 0, behavior: "smooth" })}\n          onHistory={() => setHistoryOpen(true)}\n          onFinance={() => setFinanceOpen(true)}\n          onProfile={() => setProfileOpen(true)}\n        />\n      ) : null}`;
if (source.includes(bottomNav)) source = source.replace(bottomNav, guardedBottomNav);

for (const marker of [
  'const online = Boolean(availability?.is_online) || Boolean(activeJob);',
  '<CourierLocationTracker enabled={online} onPosition={setCurrentPosition} />',
  '{!activeJob && !completedJob ? (',
]) {
  if (!source.includes(marker)) throw new Error(`[FAIL] Entregador Parceiro: rastreamento ativo incompleto (${marker})`);
}

writeFileSync(path, source, 'utf8');
console.log('[OK] Entregador Parceiro: entrega ativa mantém GPS mesmo com disponibilidade momentaneamente stale e oculta navegação que tiraria o entregador da jornada.');
