import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

// A ausência de Supabase/RPC não pode produzir uma rejeição não tratada
// durante a montagem do cadastro público do Motorista. Flags seguem fail-closed.
const workspace = process.env.APOIS_MOTORISTA_WORKSPACE || '.work/motorista';
const path = resolve(process.cwd(), workspace, 'src/hooks/useRideFeatureFlags.ts');
const before = readFileSync(path, 'utf8');

const oldBlock = [
  '  useEffect(() => {',
  '    let alive = true;',
  '    void fetchRideFeatureFlags().then((next) => {',
  '      if (alive) setFlags(next);',
  '    });',
  '    return () => {',
  '      alive = false;',
  '    };',
  '  }, []);',
].join('\n');

const newBlock = [
  '  useEffect(() => {',
  '    let alive = true;',
  '    void fetchRideFeatureFlags()',
  '      .then((next) => {',
  '        if (alive) setFlags(next);',
  '      })',
  '      .catch((error) => {',
  '        // Sem backend no primeiro acesso, manter as categorias protegidas desligadas.',
  '        if (import.meta.env.DEV) console.warn("[APOIS] falha ao consultar flags de corrida", error);',
  '        if (alive) setFlags({ ...DISABLED_RIDE_FEATURE_FLAGS });',
  '      });',
  '    return () => {',
  '      alive = false;',
  '    };',
  '  }, []);',
].join('\n');

if (before.includes(newBlock)) {
  console.log('[OK] Motorista: rejeição de feature flags já tratada');
} else if (before.includes(oldBlock)) {
  writeFileSync(path, before.replace(oldBlock, newBlock), 'utf8');
  console.log('[OK] Motorista: feature flags falham fechado sem rejeição não tratada');
} else {
  throw new Error('[FAIL] Motorista: contrato useRideFeatureFlags mudou; revisão manual necessária');
}
