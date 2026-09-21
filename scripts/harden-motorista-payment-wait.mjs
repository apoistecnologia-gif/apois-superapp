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
  return source.replace(
    'const ACTIVE_RIDE_STATUSES = ["motorista_a_caminho", "motorista_chegou", "em_viagem"] as const;',
    'const ACTIVE_RIDE_STATUSES = ["aguardando_pagamento", "motorista_a_caminho", "motorista_chegou", "em_viagem"] as const;',
  );
}, 'motorista: reserva aguardando Pix bloqueia navegação inferior');

patch('src/routes/motorista.app.tsx', (source) => {
  let next = source;

  next = next.replace(
    '} else if (r.status === "motorista_a_caminho" || r.status === "motorista_chegou" || r.status === "em_viagem") {',
    '} else if (r.status === "aguardando_pagamento" || r.status === "motorista_a_caminho" || r.status === "motorista_chegou" || r.status === "em_viagem") {',
  );

  next = next.replace(
    '.in("status", ["motorista_a_caminho", "motorista_chegou", "em_viagem"])',
    '.in("status", ["aguardando_pagamento", "motorista_a_caminho", "motorista_chegou", "em_viagem"])',
  );

  const marker = '      {/* ===== Corrida ativa =====';
  if (!next.includes('Aguardando pagamento do passageiro')) {
    if (!next.includes(marker)) throw new Error('motorista.app.tsx: marcador de corrida ativa não encontrado');
    const waiting = `      {!incoming && !ratingRide && active && active.status === "aguardando_pagamento" && (\n        <div className="fixed inset-x-0 bottom-[calc(env(safe-area-inset-bottom)+18px)] z-[46] mx-auto w-[calc(100%-24px)] max-w-md rounded-[26px] border border-[#F6BE1C]/25 bg-[#0B0C0D]/[.98] p-5 text-center text-white shadow-[0_24px_70px_rgba(0,0,0,.62)] backdrop-blur-2xl">\n          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[#F6BE1C]/12 text-[#F6BE1C] ring-1 ring-[#F6BE1C]/20">\n            <Clock className="h-6 w-6" aria-hidden="true" />\n          </div>\n          <p className="mt-3 text-[11px] font-black uppercase tracking-[0.16em] text-[#F6BE1C]">Corrida reservada</p>\n          <h2 className="mt-1 text-xl font-black">Aguardando pagamento do passageiro</h2>\n          <p className="mx-auto mt-2 max-w-sm text-[13px] font-medium leading-5 text-zinc-400">Não siga para o embarque ainda. Assim que o Pix for confirmado pela Safe2Pay, a rota será liberada automaticamente.</p>\n        </div>\n      )}\n\n`;
    next = next.replace(marker, waiting + marker);
  }

  next = next.replace(
    'active && active.status !== "motorista_a_caminho" && active.status !== "em_viagem" && (() => {',
    'active && active.status !== "aguardando_pagamento" && active.status !== "motorista_a_caminho" && active.status !== "em_viagem" && (() => {',
  );

  return next;
}, 'motorista: estado aguardando pagamento sem liberar deslocamento');

console.log(`[OK] fluxo Motorista aguardando Pix aplicado em ${workspace}`);
