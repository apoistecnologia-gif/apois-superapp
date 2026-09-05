import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
const workspace = process.env.APOIS_MOTORISTA_WORKSPACE || '.work/motorista';
const path = resolve(root, workspace, 'src/lib/driverProfile.ts');
let source = readFileSync(path, 'utf8');

const functionStart = source.indexOf('let asaasSubaccountProvisioningAttempted = false;');
const functionEndMarker = '\n\nexport async function loadDriverProfile';
const functionEnd = source.indexOf(functionEndMarker, functionStart);

if (functionStart >= 0) {
  if (functionEnd < 0) {
    throw new Error('[FAIL] motorista: bloco legado de provisionamento Asaas não pôde ser delimitado');
  }
  source = source.slice(0, functionStart) + source.slice(functionEnd + 2);
}

source = source.replace(
  '  await ensureApprovedDriverAsaasSubaccount(profile);\n',
  '',
);

for (const forbidden of [
  'asaas-create-driver-subaccount',
  'ensureApprovedDriverAsaasSubaccount',
  'asaasSubaccountProvisioningAttempted',
]) {
  if (source.includes(forbidden)) {
    throw new Error(`[FAIL] motorista: provider legado ainda ativo em driverProfile.ts (${forbidden})`);
  }
}

for (const required of [
  'supabase.auth.getSession()',
  '.rpc("driver_get_profile")',
  'const profile = data as DriverProfileRow;',
  'return { ok: true, profile };',
]) {
  if (!source.includes(required)) {
    throw new Error(`[FAIL] motorista: contrato de resolução de perfil mudou (${required})`);
  }
}

writeFileSync(path, source, 'utf8');
console.log(`[OK] motorista: login/perfil não provisiona subconta em gateway desativado (${workspace})`);
