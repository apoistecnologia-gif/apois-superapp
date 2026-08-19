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

if (after !== before) writeFileSync(path, after, 'utf8');
console.log('[OK] Shell fonte usa deduplicação temporária de deep link antes do build.');
