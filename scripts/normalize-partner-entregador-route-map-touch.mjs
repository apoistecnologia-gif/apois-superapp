import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
const workspace = process.env.APOIS_ENTREGAS_WORKSPACE || '.work/partner-entregador';
const path = resolve(root, workspace, 'src/components/CourierRouteMap.tsx');
let source = readFileSync(path, 'utf8');

// O botão Rotas fica no cabeçalho do card (não sobre o mapa). Normalize pelo
// handler sem depender da classe histórica que outros hardeners já alteraram.
source = source.replace(
  /className="flex h-10 shrink-0 items-center gap-1\.5 rounded-xl border border-accent\/40 bg-gradient-to-br from-primary to-accent px-3 text-\[11px\] font-black text-white shadow-\[[^\"]+\] active:scale-95"/g,
  'className="inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-xl border border-accent/40 bg-gradient-to-br from-primary to-accent px-3.5 text-xs font-black text-white shadow-[0_8px_22px_rgba(246,190,28,0.20)] active:scale-95"',
);

// Altura responsiva do mapa ativo, preservando espaço útil em telas menores.
source = source.replace(
  /expanded \? "h-\[36rem\] min-h-\[72vh\] max-h-\[44rem\]" : "h-\[29rem\] min-h-\[62vh\] max-h-\[36rem\]"/g,
  'expanded ? "h-[clamp(24rem,62dvh,36rem)]" : "h-[clamp(21rem,54dvh,31rem)]"',
);

// O RecenterControl da fonte protegida já possui 44x44. Normalize apenas
// variantes antigas caso apareçam na cópia .work.
source = source.replace(
  /grid h-10 w-10 place-items-center rounded-full border border-accent\/40/g,
  'grid h-11 w-11 place-items-center rounded-full border border-accent/40',
);

for (const marker of [
  'inline-flex min-h-11 shrink-0 items-center',
  'h-[clamp(24rem,62dvh,36rem)]',
  'h-[clamp(21rem,54dvh,31rem)]',
  'grid h-11 w-11 place-items-center rounded-full',
]) {
  if (!source.includes(marker)) {
    throw new Error(`[FAIL] Entregador Parceiro: normalização estrutural do mapa de rota incompleta (${marker})`);
  }
}

writeFileSync(path, source, 'utf8');
console.log('[OK] Entregador Parceiro: mapa de rota normalizado por estrutura para altura responsiva e alvos de toque confortáveis.');
