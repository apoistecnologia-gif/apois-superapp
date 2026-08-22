import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
const workspace = process.env.APOIS_ENTREGAS_WORKSPACE || '.work/partner-entregador';
const path = resolve(root, workspace, 'src/routes/courier.tsx');
let source = readFileSync(path, 'utf8');
const ROLE_KEY = 'apois-parceiro:operational-role';

// Toda vez que a leitura operacional confirmar que o entregador continua ONLINE
// ou possui entrega ativa, reafirma a trava. Se ambos estiverem ausentes, remove
// apenas a trava pertencente ao Entregador (nunca apaga a do Motorista).
const loadAnchor = `    setAvailability(availabilityRes.data ?? null);\n    setOffers(Array.isArray(offersRes.data) ? offersRes.data : []);\n    setNearbyMerchants(merchantsRes.data ?? []);\n    setActiveJob(jobsRes.data ?? null);`;
const loadReplacement = `    setAvailability(availabilityRes.data ?? null);\n    setOffers(Array.isArray(offersRes.data) ? offersRes.data : []);\n    setNearbyMerchants(merchantsRes.data ?? []);\n    setActiveJob(jobsRes.data ?? null);\n    try {\n      if (availabilityRes.data?.is_online || jobsRes.data) localStorage.setItem("${ROLE_KEY}", "entregador");\n      else if (localStorage.getItem("${ROLE_KEY}") === "entregador") localStorage.removeItem("${ROLE_KEY}");\n    } catch {\n      // backend continua sendo a autoridade; storage é somente trava de navegação do shell.\n    }`;
if (source.includes(loadAnchor)) source = source.replace(loadAnchor, loadReplacement);

// Depois que ONLINE + serviço nativo de background estiverem confirmados, grava
// a função operacional para impedir que relançar o app exponha a outra função.
const onlineAnchor = `        setCurrentPosition(initialPosition);`;
if (source.includes(onlineAnchor) && !source.includes(`localStorage.setItem("${ROLE_KEY}", "entregador")`)) {
  source = source.replace(
    onlineAnchor,
    `        try { localStorage.setItem("${ROLE_KEY}", "entregador"); } catch { /* no-op */ }\n${onlineAnchor}`,
  );
}

// OFFLINE só limpa a trava depois que a RPC foi aceita e o serviço nativo parou.
const offlineAnchor = `        await stopCourierNativeLocation().catch(() => undefined);\n        setCurrentPosition(null);`;
const offlineReplacement = `        await stopCourierNativeLocation().catch(() => undefined);\n        try { if (localStorage.getItem("${ROLE_KEY}") === "entregador") localStorage.removeItem("${ROLE_KEY}"); } catch { /* no-op */ }\n        setCurrentPosition(null);`;
if (source.includes(offlineAnchor)) source = source.replace(offlineAnchor, offlineReplacement);

// Logout: como a função já confirmou OFFLINE acima, remove a trava antes da sessão.
const logoutAnchor = `    await stopCourierNativeLocation().catch(() => undefined);\n    await removeCourierPushRegistration();`;
const logoutReplacement = `    await stopCourierNativeLocation().catch(() => undefined);\n    try { if (localStorage.getItem("${ROLE_KEY}") === "entregador") localStorage.removeItem("${ROLE_KEY}"); } catch { /* no-op */ }\n    await removeCourierPushRegistration();`;
if (source.includes(logoutAnchor)) source = source.replace(logoutAnchor, logoutReplacement);

// Troca segura de perfil: backend OFFLINE e FGS já foram reconciliados pelo hardener anterior.
const switchAnchor = `      await stopCourierNativeLocation().catch(() => undefined);\n      await removeCourierPushRegistration().catch((pushError) => {`;
const switchReplacement = `      await stopCourierNativeLocation().catch(() => undefined);\n      try { if (localStorage.getItem("${ROLE_KEY}") === "entregador") localStorage.removeItem("${ROLE_KEY}"); } catch { /* no-op */ }\n      await removeCourierPushRegistration().catch((pushError) => {`;
if (source.includes(switchAnchor)) source = source.replace(switchAnchor, switchReplacement);

for (const marker of [
  `localStorage.setItem("${ROLE_KEY}", "entregador")`,
  `localStorage.getItem("${ROLE_KEY}") === "entregador"`,
  `localStorage.removeItem("${ROLE_KEY}")`,
  'availabilityRes.data?.is_online || jobsRes.data',
]) {
  if (!source.includes(marker)) throw new Error(`[FAIL] Entregador Parceiro: trava operacional incompleta (${marker})`);
}

writeFileSync(path, source, 'utf8');
console.log('[OK] Entregador Parceiro: ONLINE/entrega ativa travam o shell na função Entregador; OFFLINE, logout e troca segura removem a trava somente após reconciliação.');
