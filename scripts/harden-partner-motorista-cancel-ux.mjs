import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
const workspace = process.env.APOIS_MOTORISTA_WORKSPACE || '.work/partner-motorista';

function patch(rel, transform) {
  const path = resolve(root, workspace, rel);
  const before = readFileSync(path, 'utf8');
  const after = transform(before);
  if (after === before) throw new Error('[FAIL] Motorista cancel UX: nenhuma alteração aplicada em ' + rel);
  writeFileSync(path, after, 'utf8');
}

patch('src/lib/driverRideLifecycle.mobile.ts', (source) => {
  const start = source.indexOf('export async function cancelarPeloMotoristaMobile');
  const end = source.indexOf('\n}\n', start);
  if (start < 0 || end < 0) throw new Error('[FAIL] cancelarPeloMotoristaMobile não encontrado');
  const replacement = `export async function cancelarPeloMotoristaMobile({ data }: { data: { rideId: string; motivo?: string } }) {
  assertRideId(data.rideId);
  const reason = String(data.motivo ?? "").trim().slice(0, 240);
  return callRpc("driver_cancel_ride", {
    _ride_id: data.rideId,
    _reason: reason || "Cancelada pelo motorista",
  });
}`;
  return source.slice(0, start) + replacement + source.slice(end + 3);
});

patch('src/routes/motorista.app.tsx', (source) => {
  let next = source;
  const old = `              <DSButton
                variant="ghost"
                size="icon"
                onClick={() => setCancelOpen(true)}
                aria-label="Cancelar corrida"
                className="h-9 w-9 text-muted-foreground hover:text-destructive"
              >
                <X className="h-4 w-4" />
              </DSButton>`;
  const replacement = `              <DSButton
                variant="outline"
                size="sm"
                onClick={() => setCancelOpen(true)}
                aria-label="Cancelar corrida"
                className="min-h-10 rounded-xl border-destructive/40 bg-destructive/10 px-3 font-extrabold text-destructive hover:bg-destructive/15"
              >
                <X className="mr-1.5 h-4 w-4" />
                Cancelar
              </DSButton>`;
  if (!next.includes(old)) throw new Error('[FAIL] botão pequeno de cancelar não encontrado');
  next = next.replace(old, replacement);

  if (!next.includes('>Cancelar<') && !next.includes('Cancelamento')) {
    throw new Error('[FAIL] botão visível de cancelamento não foi aplicado');
  }
  return next;
});

console.log('[OK] Motorista: cancelamento usa RPC atual e botão Cancelar ficou visível.');
