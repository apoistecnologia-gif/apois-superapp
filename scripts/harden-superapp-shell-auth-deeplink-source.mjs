import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const path = resolve('superapp/shell/index.html');
const before = readFileSync(path, 'utf8');
if (!before.includes('const OAUTH_HANDOFF_TTL_MS=120000;')) {
  throw new Error('Shell perdeu o handoff OAuth Corridas com TTL.');
}
if (!before.includes('clearExpiredCorridasGoogle()') || !before.includes('localStorage.getItem(CORRIDAS_GOOGLE_KEY)===envelope')) {
  throw new Error('Shell perdeu a remoção ativa do authorization code expirado.');
}
const oldBlock = `          const previous=sessionStorage.getItem(AUTH_DEEP_LINK_KEY);\n          if(previous===rawUrl)return true;\n          sessionStorage.setItem(AUTH_DEEP_LINK_KEY,rawUrl);`;
const newBlock = `          const previousRaw=sessionStorage.getItem(AUTH_DEEP_LINK_KEY);\n          if(previousRaw){try{const previous=JSON.parse(previousRaw);if(previous?.url===rawUrl&&Date.now()-Number(previous?.at||0)<5000)return true;}catch{}}\n          sessionStorage.setItem(AUTH_DEEP_LINK_KEY,JSON.stringify({url:rawUrl,at:Date.now()}));`;

let after = before;
if (after.includes(oldBlock)) {
  after = after.replace(oldBlock, newBlock);
} else if (!after.includes('Date.now()-Number(previous?.at||0)<5000')) {
  throw new Error('Padrão de deduplicação de deep link do shell não encontrado.');
}

if (!after.includes("if(path==='corridas-reset')")) {
  throw new Error('Shell perdeu o roteamento de recuperação de senha de Corridas.');
}
if (!after.includes("sessionStorage.setItem(CORRIDAS_RECOVERY_KEY,rawUrl)")) {
  throw new Error('Shell não preserva o callback de recuperação de Corridas.');
}
if (after !== before) writeFileSync(path, after, 'utf8');
console.log('[OK] Shell fonte mantém deduplicação e recuperação Corridas; callback Google é consolidado no build.');
