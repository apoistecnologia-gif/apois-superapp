import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
const workspace = process.env.APOIS_ENTREGAS_WORKSPACE || '.work/partner-entregador';
const path = resolve(root, workspace, 'src/routes/courier.tsx');
let source = readFileSync(path, 'utf8');
const ROLE_KEY = 'apois-parceiro:operational-role';

const LOAD_MARKER = '// APOIS_PARTNER_COURIER_OPERATIONAL_LOCK_RECONCILED';
const ONLINE_MARKER = '// APOIS_PARTNER_COURIER_OPERATIONAL_LOCK_ONLINE';
const OFFLINE_MARKER = '// APOIS_PARTNER_COURIER_OPERATIONAL_LOCK_OFFLINE';
const LOGOUT_MARKER = '// APOIS_PARTNER_COURIER_OPERATIONAL_LOCK_LOGOUT';
const SWITCH_MARKER = '// APOIS_PARTNER_COURIER_OPERATIONAL_LOCK_SWITCH';

// O hardener de estados operacionais roda antes deste arquivo e transforma os
// setters brutos em setters condicionais por erro. A trava precisa respeitar
// exatamente essa forma pós-transformação: uma falha de refresh NUNCA pode
// apagar uma trava válida. Atividade confirmada por qualquer leitura válida
// reafirma a trava; limpeza só ocorre quando disponibilidade E job responderam
// sem erro e ambos confirmam ausência de operação.
if (!source.includes(LOAD_MARKER)) {
  const hardenedAnchor = `    if (!availabilityRes.error) setAvailability(availabilityRes.data ?? null);\n    if (!offersRes.error) setOffers(Array.isArray(offersRes.data) ? offersRes.data : []);\n    if (!merchantsRes.error) setNearbyMerchants(merchantsRes.data ?? []);\n    if (!jobsRes.error) setActiveJob(jobsRes.data ?? null);\n    if (!walletRes.error) setWallet(walletRes.data ?? null);`;
  const hardenedReplacement = `${hardenedAnchor}\n\n    ${LOAD_MARKER}\n    try {\n      const availabilityConfirmedActive = !availabilityRes.error && Boolean(availabilityRes.data?.is_online);\n      const jobConfirmedActive = !jobsRes.error && Boolean(jobsRes.data);\n      const bothConfirmedInactive = !availabilityRes.error && !jobsRes.error && !availabilityRes.data?.is_online && !jobsRes.data;\n      if (availabilityConfirmedActive || jobConfirmedActive) {\n        localStorage.setItem("${ROLE_KEY}", "entregador");\n      } else if (bothConfirmedInactive && localStorage.getItem("${ROLE_KEY}") === "entregador") {\n        localStorage.removeItem("${ROLE_KEY}");\n      }\n    } catch {\n      // Backend continua sendo a autoridade; storage é somente trava de navegação do shell.\n    }`;

  if (source.includes(hardenedAnchor)) {
    source = source.replace(hardenedAnchor, hardenedReplacement);
  } else {
    // Compatibilidade defensiva caso a ordem de hardeners seja alterada no futuro.
    // Ainda assim, não permitimos seguir silenciosamente sem instalar a reconciliação.
    const legacyAnchor = `    setAvailability(availabilityRes.data ?? null);\n    setOffers(Array.isArray(offersRes.data) ? offersRes.data : []);\n    setNearbyMerchants(merchantsRes.data ?? []);\n    setActiveJob(jobsRes.data ?? null);\n    setWallet(walletRes.data ?? null);`;
    const legacyReplacement = `${legacyAnchor}\n\n    ${LOAD_MARKER}\n    try {\n      if (availabilityRes.data?.is_online || jobsRes.data) {\n        localStorage.setItem("${ROLE_KEY}", "entregador");\n      } else if (localStorage.getItem("${ROLE_KEY}") === "entregador") {\n        localStorage.removeItem("${ROLE_KEY}");\n      }\n    } catch {\n      // Backend continua sendo a autoridade; storage é somente trava de navegação do shell.\n    }`;
    if (!source.includes(legacyAnchor)) {
      throw new Error('[FAIL] Entregador Parceiro: não foi possível localizar loadCourierOperations para instalar a trava operacional.');
    }
    source = source.replace(legacyAnchor, legacyReplacement);
  }
}

// Depois que ONLINE + serviço nativo de background estiverem confirmados, grava
// a função operacional para impedir que relançar o app exponha a outra função.
if (!source.includes(ONLINE_MARKER)) {
  const onlineAnchor = `        setCurrentPosition(initialPosition);`;
  if (!source.includes(onlineAnchor)) {
    throw new Error('[FAIL] Entregador Parceiro: confirmação ONLINE não encontrada para instalar trava operacional.');
  }
  source = source.replace(
    onlineAnchor,
    `        ${ONLINE_MARKER}\n        try { localStorage.setItem("${ROLE_KEY}", "entregador"); } catch { /* no-op */ }\n${onlineAnchor}`,
  );
}

// OFFLINE só limpa a trava depois que a RPC foi aceita e o serviço nativo parou.
if (!source.includes(OFFLINE_MARKER)) {
  const offlineAnchor = `        await stopCourierNativeLocation().catch(() => undefined);\n        setCurrentPosition(null);`;
  const offlineReplacement = `        await stopCourierNativeLocation().catch(() => undefined);\n        ${OFFLINE_MARKER}\n        try { if (localStorage.getItem("${ROLE_KEY}") === "entregador") localStorage.removeItem("${ROLE_KEY}"); } catch { /* no-op */ }\n        setCurrentPosition(null);`;
  if (!source.includes(offlineAnchor)) {
    throw new Error('[FAIL] Entregador Parceiro: caminho OFFLINE reconciliado não encontrado para limpar trava operacional.');
  }
  source = source.replace(offlineAnchor, offlineReplacement);
}

// Logout: como a função já confirmou OFFLINE no fluxo protegido, remove a trava
// antes de destruir a sessão de Entregas.
if (!source.includes(LOGOUT_MARKER)) {
  const logoutAnchor = `    await stopCourierNativeLocation().catch(() => undefined);\n    await removeCourierPushRegistration();`;
  const logoutReplacement = `    await stopCourierNativeLocation().catch(() => undefined);\n    ${LOGOUT_MARKER}\n    try { if (localStorage.getItem("${ROLE_KEY}") === "entregador") localStorage.removeItem("${ROLE_KEY}"); } catch { /* no-op */ }\n    await removeCourierPushRegistration();`;
  if (!source.includes(logoutAnchor)) {
    throw new Error('[FAIL] Entregador Parceiro: caminho de logout reconciliado não encontrado para limpar trava operacional.');
  }
  source = source.replace(logoutAnchor, logoutReplacement);
}

// Troca segura de perfil: backend OFFLINE e FGS já foram reconciliados pelo
// hardener anterior. Só então a trava do shell pode ser removida.
if (!source.includes(SWITCH_MARKER)) {
  const switchAnchor = `      await stopCourierNativeLocation().catch(() => undefined);\n      await removeCourierPushRegistration().catch((pushError) => {`;
  const switchReplacement = `      await stopCourierNativeLocation().catch(() => undefined);\n      ${SWITCH_MARKER}\n      try { if (localStorage.getItem("${ROLE_KEY}") === "entregador") localStorage.removeItem("${ROLE_KEY}"); } catch { /* no-op */ }\n      await removeCourierPushRegistration().catch((pushError) => {`;
  if (!source.includes(switchAnchor)) {
    throw new Error('[FAIL] Entregador Parceiro: troca segura de perfil não encontrada para limpar trava operacional.');
  }
  source = source.replace(switchAnchor, switchReplacement);
}

for (const marker of [
  LOAD_MARKER,
  ONLINE_MARKER,
  OFFLINE_MARKER,
  LOGOUT_MARKER,
  SWITCH_MARKER,
  `localStorage.setItem("${ROLE_KEY}", "entregador")`,
  `localStorage.getItem("${ROLE_KEY}") === "entregador"`,
  `localStorage.removeItem("${ROLE_KEY}")`,
  'availabilityConfirmedActive',
  'jobConfirmedActive',
  'bothConfirmedInactive',
]) {
  if (!source.includes(marker)) throw new Error(`[FAIL] Entregador Parceiro: trava operacional incompleta (${marker})`);
}

writeFileSync(path, source, 'utf8');
console.log('[OK] Entregador Parceiro: trava operacional é aplicada após o hardening de estados, preservada em falhas de refresh e removida somente após inatividade/OFFLINE confirmados.');
