import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const workspace = process.env.APOIS_MOTORISTA_WORKSPACE || '.work/partner-motorista';
const path = resolve(process.cwd(), workspace, 'src/routes/motorista.app.tsx');
const before = readFileSync(path, 'utf8');
const old = 'src={passenger?.avatar_url ?? (ride as { passenger_photo_url?: string | null }).passenger_photo_url ?? null}';
const replacement = 'src={passenger?.avatar_url ?? null}';

if (!before.includes(old)) {
  if (before.includes(replacement)) {
    console.log('[OK] Motorista: avatar do passageiro já usa somente o perfil canônico.');
    process.exit(0);
  }
  throw new Error('[FAIL] avatar do passageiro: padrão esperado não encontrado');
}

const after = before.replaceAll(old, replacement);
writeFileSync(path, after, 'utf8');
console.log('[OK] Motorista: avatar do passageiro usa somente o perfil canônico e cai para inicial quando a foto falha.');
