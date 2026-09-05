import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const path = resolve('superapp/shell/index.html');
const before = readFileSync(path, 'utf8');
const oldBlock = `          const previous=sessionStorage.getItem(AUTH_DEEP_LINK_KEY);\n          if(previous===rawUrl)return true;\n          sessionStorage.setItem(AUTH_DEEP_LINK_KEY,rawUrl);`;
const newBlock = `          const previousRaw=sessionStorage.getItem(AUTH_DEEP_LINK_KEY);\n          if(previousRaw){try{const previous=JSON.parse(previousRaw);if(previous?.url===rawUrl&&Date.now()-Number(previous?.at||0)<5000)return true;}catch{}}\n          sessionStorage.setItem(AUTH_DEEP_LINK_KEY,JSON.stringify({url:rawUrl,at:Date.now()}));`;

let after = before;
if (after.includes(oldBlock)) {
  after = after.replace(oldBlock, newBlock);
} else if (!after.includes('Date.now()-Number(previous?.at||0)<5000')) {
  throw new Error('Padrão de deduplicação de deep link do shell não encontrado.');
}

const staleGoogleBlock = `        if(path==='corridas-google'){\n          try{sessionStorage.setItem('apois-superapp:corridas-google-url',rawUrl);}catch{}\n          void window.Capacitor?.Plugins?.Browser?.close?.().catch(()=>undefined);\n          window.location.replace('./modules/corridas/index.html#/login');\n          return true;\n        }\n`;
after = after.replace(staleGoogleBlock, '');

if (!after.includes("if(path==='corridas-reset')")) {
  throw new Error('Shell perdeu o roteamento de recuperação de senha de Corridas.');
}
if (!after.includes("sessionStorage.setItem(CORRIDAS_RECOVERY_KEY,rawUrl)")) {
  throw new Error('Shell não preserva o callback de recuperação de Corridas.');
}
if (after.includes("path==='corridas-google'") || after.includes('corridas-google-url')) {
  throw new Error('Shell ainda contém callback Google Corridas sem fluxo suportado.');
}

if (after !== before) writeFileSync(path, after, 'utf8');
console.log('[OK] Shell fonte mantém recuperação Corridas e remove callback Google não suportado.');
