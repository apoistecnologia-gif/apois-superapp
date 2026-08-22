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

source = source.replace(
  '          onClick={() => setProfileOpen(true)}\n          aria-label="Abrir perfil"',
  '          onClick={() => { if (!activeJob && !completedJob) setProfileOpen(true); }}\n          aria-label={activeJob || completedJob ? "Perfil indisponível durante a entrega" : "Abrir perfil"}\n          disabled={Boolean(activeJob || completedJob)}',
);
source = source.replace(
  'className="relative grid h-11 w-11 place-items-center justify-self-end rounded-full border border-zinc-800 bg-zinc-950 text-zinc-300 shadow-[0_8px_24px_rgba(0,0,0,0.4)] active:scale-95"',
  'className="relative grid h-11 w-11 place-items-center justify-self-end rounded-full border border-zinc-800 bg-zinc-950 text-zinc-300 shadow-[0_8px_24px_rgba(0,0,0,0.4)] active:scale-95 disabled:cursor-not-allowed disabled:opacity-40 disabled:active:scale-100"',
);

const bottomNav = `      <CourierBottomNav\n        active="home"\n        onHome={() => window.scrollTo({ top: 0, behavior: "smooth" })}\n        onHistory={() => setHistoryOpen(true)}\n        onFinance={() => setFinanceOpen(true)}\n        onProfile={() => setProfileOpen(true)}\n      />`;
const guardedBottomNav = `      {!activeJob && !completedJob ? (\n        <CourierBottomNav\n          active="home"\n          onHome={() => window.scrollTo({ top: 0, behavior: "smooth" })}\n          onHistory={() => setHistoryOpen(true)}\n          onFinance={() => setFinanceOpen(true)}\n          onProfile={() => setProfileOpen(true)}\n        />\n      ) : null}`;
if (source.includes(bottomNav)) source = source.replace(bottomNav, guardedBottomNav);

for (const marker of [
  'const online = Boolean(availability?.is_online) || Boolean(activeJob);',
  '<CourierLocationTracker enabled={online} onPosition={setCurrentPosition} />',
  'disabled={Boolean(activeJob || completedJob)}',
  'Perfil indisponível durante a entrega',
  '{!activeJob && !completedJob ? (',
]) {
  if (!source.includes(marker)) throw new Error(`[FAIL] Entregador Parceiro: rastreamento/jornada ativa incompleta (${marker})`);
}

writeFileSync(path, source, 'utf8');
console.log('[OK] Entregador Parceiro: entrega ativa mantém GPS, trava perfil/rodapé durante a jornada e evita saída acidental da tela operacional.');
