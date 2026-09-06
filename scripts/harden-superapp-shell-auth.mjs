import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const path = resolve('superapp/shell/index.html');
let html = readFileSync(path, 'utf8');

if (html.includes('const OAUTH_HANDOFF_TTL_MS=120000;') && html.includes('const storeCorridasGoogle=()=>{')) {
  for (const marker of [
    "params.get('code')",
    "params.has('access_token')",
    "params.has('refresh_token')",
    'JSON.stringify({url:rawUrl,createdAt:Date.now()})',
    'clearExpiredCorridasGoogle()',
    'window.setTimeout(()=>{try{if(localStorage.getItem(CORRIDAS_GOOGLE_KEY)===envelope)',
    'hasPendingCorridas()&&storeCorridasGoogle()',
    "if(path==='corridas-reset')",
    'sessionStorage.setItem(CORRIDAS_RECOVERY_KEY,rawUrl)',
    "window.location.replace(`./modules/entregas/index.html#/auth/callback${suffix()}`)",
  ]) {
    if (!html.includes(marker)) throw new Error(`[FAIL] shell cliente: handoff OAuth endurecido incompleto (${marker})`);
  }
  console.log('[OK] shell cliente encaminha somente authorization code PKCE com TTL e consumo único');
  process.exit(0);
}

const oldResetBlock = `        if(path==='corridas-reset'){
          try{sessionStorage.setItem(CORRIDAS_RECOVERY_KEY,rawUrl);}catch{}
          window.location.replace('./modules/corridas/index.html');
          return true;
        }`;
const newResetBlock = `        if(path==='corridas-google'){
          try{localStorage.setItem('apois-superapp:corridas-google-url',rawUrl);}catch{}
          void window.Capacitor?.Plugins?.Browser?.close?.().catch(()=>undefined);
          window.location.replace('./modules/corridas/index.html#/login');
          return true;
        }
        if(path==='corridas-reset'){
          try{sessionStorage.setItem(CORRIDAS_RECOVERY_KEY,rawUrl);}catch{}
          window.location.replace('./modules/corridas/index.html');
          return true;
        }`;
if (!html.includes("path==='corridas-google'")) {
  if (html.includes(oldResetBlock)) {
    html = html.replace(oldResetBlock, newResetBlock);
  } else {
    const resetPattern = /        if\(path==='corridas-reset'\)\{\r?\n          try\{sessionStorage\.setItem\(CORRIDAS_RECOVERY_KEY,rawUrl\);\}catch\{\}\r?\n          window\.location\.replace\('\.\/modules\/corridas\/index\.html'\);\r?\n          return true;\r?\n        \}/;
    if (!resetPattern.test(html)) throw new Error('[FAIL] shell cliente: bloco corridas-reset não encontrado');
    html = html.replace(resetPattern, newResetBlock);
  }
}

const oldCallbackBlock = `        if(path==='callback'){
          window.location.replace(\`./modules/entregas/index.html#/auth/callback\${suffix()}\`);
          return true;
        }`;
const newCallbackBlock = `        if(path==='callback'){
          try{
            const pendingProduct=localStorage.getItem('apois-superapp:pending-oauth-product');
            if(pendingProduct==='corridas'){
              localStorage.removeItem('apois-superapp:pending-oauth-product');
              localStorage.setItem('apois-superapp:corridas-google-url',rawUrl);
              void window.Capacitor?.Plugins?.Browser?.close?.().catch(()=>undefined);
              window.location.replace('./modules/corridas/index.html#/login');
              return true;
            }
          }catch{}
          window.location.replace(\`./modules/entregas/index.html#/auth/callback\${suffix()}\`);
          return true;
        }`;
if (!html.includes("pendingProduct==='corridas'")) {
  if (html.includes(oldCallbackBlock)) {
    html = html.replace(oldCallbackBlock, newCallbackBlock);
  } else {
    const callbackPattern = /        if\(path==='callback'\)\{\r?\n          window\.location\.replace\(`\.\/modules\/entregas\/index\.html#\/auth\/callback\$\{suffix\(\)\}`\);\r?\n          return true;\r?\n        \}/;
    if (!callbackPattern.test(html)) throw new Error('[FAIL] shell cliente: bloco callback compartilhado não encontrado');
    html = html.replace(callbackPattern, newCallbackBlock);
  }
} else {
  html = html
    .replace("sessionStorage.getItem('apois-superapp:pending-oauth-product')", "localStorage.getItem('apois-superapp:pending-oauth-product')")
    .replace("sessionStorage.removeItem('apois-superapp:pending-oauth-product')", "localStorage.removeItem('apois-superapp:pending-oauth-product')")
    .replace("sessionStorage.setItem('apois-superapp:corridas-google-url',rawUrl)", "localStorage.setItem('apois-superapp:corridas-google-url',rawUrl)");
}

writeFileSync(path, html, 'utf8');

if (!html.includes("path==='corridas-google'")) throw new Error('[FAIL] shell cliente: callback Google Corridas ausente');
if (!html.includes("pendingProduct==='corridas'")) throw new Error('[FAIL] shell cliente: callback compartilhado não diferencia Corridas');
if (!html.includes("localStorage.getItem('apois-superapp:pending-oauth-product')")) throw new Error('[FAIL] shell cliente: marcador OAuth Corridas não é persistente');
console.log('[OK] shell cliente encaminha OAuth Google de Corridas pelo callback permitido com marcador persistente');
