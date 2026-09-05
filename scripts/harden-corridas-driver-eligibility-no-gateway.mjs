import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const path = resolve('.work/corridas/supabase/functions/request-ride/index.ts');
if (!existsSync(path)) throw new Error('[FAIL] Corridas eligibility: request-ride ausente em .work');
let source = readFileSync(path, 'utf8');

// The identity hardener runs first and makes subscriptions.driver_id use DRIVER
// RECORD IDs correctly. The current product policy, however, has no homologated
// electronic membership provider. Therefore a provider-backed subscription may
// not be an eligibility prerequisite for matching while gateways are disabled.
const identityAndSubscriptionBlock = /  const driverRecordIds = \(drivers \?\? \[\]\)\.map\(\(driver: any\) => String\(driver\.id\)\)\.filter\(Boolean\);\n  const driverDomainUserIds = \(drivers \?\? \[\]\)\.map\(\(driver: any\) => String\(driver\.user_id\)\)\.filter\(Boolean\);\n\n  \/\/ subscriptions\.driver_id referencia public\.drivers\(id\), enquanto drivers\.user_id[\s\S]*?  const entitledDrivers = new Set\([\s\S]*?  \);\n/;
if (identityAndSubscriptionBlock.test(source)) {
  source = source.replace(
    identityAndSubscriptionBlock,
    '  const driverDomainUserIds = (drivers ?? []).map((driver: any) => String(driver.user_id)).filter(Boolean);\n\n',
  );
}
source = source.replace('      if (!entitledDrivers.has(String(d.id))) return false;\n', '');

for (const required of [
  'if (!d.is_online || d.approval_status !== "aprovado") return false;',
  'if (age > MAX_GPS_AGE_SECONDS) return false;',
  'if (normalizeCategory(d.category) !== category) return false;',
  'const driverDomainUserIds =',
]) {
  if (!source.includes(required)) throw new Error(`[FAIL] Corridas eligibility perdeu pré-requisito operacional (${required})`);
}
for (const forbidden of [
  '.from("subscriptions")',
  'activeSubscriptions',
  'subscriptionsError',
  'entitledDrivers',
]) {
  if (source.includes(forbidden)) throw new Error(`[FAIL] Corridas eligibility ainda bloqueia matching por assinatura/gateway (${forbidden})`);
}

writeFileSync(path, source, 'utf8');
console.log('[OK] Corridas: matching exige aprovação/online/GPS, mas não mensalidade eletrônica enquanto nenhum gateway está homologado.');
