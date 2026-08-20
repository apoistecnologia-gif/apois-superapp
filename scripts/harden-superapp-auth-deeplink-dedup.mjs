import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const targets = [
  'superapp/shell/dist/index.html',
  'superapp/shell/dist/modules/corridas/index.html',
  'superapp/shell/dist/modules/entregas/index.html',
  'superapp/shell/dist/modules/motorista/index.html',
];

const oldBlock = `          const previous=sessionStorage.getItem(AUTH_DEEP_LINK_KEY);\n          if(previous===rawUrl)return true;\n          sessionStorage.setItem(AUTH_DEEP_LINK_KEY,rawUrl);`;
const oldModuleBlock = `        const previous = sessionStorage.getItem(authDeepLinkKey);\n        if (previous === rawUrl) return true;\n        sessionStorage.setItem(authDeepLinkKey, rawUrl);`;

function replacement(keyExpression, compact = false) {
  if (compact) {
    return `          const previousRaw=sessionStorage.getItem(${keyExpression});\n          if(previousRaw){try{const previous=JSON.parse(previousRaw);if(previous?.url===rawUrl&&Date.now()-Number(previous?.at||0)<5000)return true;}catch{}}\n          sessionStorage.setItem(${keyExpression},JSON.stringify({url:rawUrl,at:Date.now()}));`;
  }
  return `        const previousRaw = sessionStorage.getItem(${keyExpression});\n        if (previousRaw) {\n          try {\n            const previous = JSON.parse(previousRaw);\n            if (previous?.url === rawUrl && Date.now() - Number(previous?.at || 0) < 5000) return true;\n          } catch {}\n        }\n        sessionStorage.setItem(${keyExpression}, JSON.stringify({ url: rawUrl, at: Date.now() }));`;
}

function hasTemporaryDedup(source) {
  return (
    source.includes('Date.now()-Number(previous?.at||0)<5000') ||
    source.includes('Date.now() - Number(previous?.at || 0) < 5000')
  );
}

for (const relative of targets) {
  const path = resolve(relative);
  const before = readFileSync(path, 'utf8');
  let after = before;

  if (after.includes(oldBlock)) {
    after = after.replace(oldBlock, replacement('AUTH_DEEP_LINK_KEY', true));
  }
  if (after.includes(oldModuleBlock)) {
    after = after.replace(oldModuleBlock, replacement('authDeepLinkKey'));
  }

  if (after === before) {
    if (hasTemporaryDedup(after)) {
      console.log(`[OK] ${relative}: deduplicação temporária já aplicada`);
      continue;
    }
    console.error(`[FAIL] ${relative}: padrão de deduplicação de deep link não encontrado`);
    process.exit(1);
  }

  if (!hasTemporaryDedup(after)) {
    console.error(`[FAIL] ${relative}: deduplicação temporária não ficou presente após hardening`);
    process.exit(1);
  }

  writeFileSync(path, after, 'utf8');
  console.log(`[OK] ${relative}: deep link duplicado só é suprimido por 5 segundos`);
}
