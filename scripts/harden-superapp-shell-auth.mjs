import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const path = resolve('superapp/shell/index.html');
let html = readFileSync(path, 'utf8');

const oldResetBlock = `        if(path==='corridas-reset'){
          try{sessionStorage.setItem(CORRIDAS_RECOVERY_KEY,rawUrl);}catch{}
          window.location.replace('./modules/corridas/index.html');
          return true;
        }`;
const newResetBlock = `        if(path==='corridas-google'){
          try{sessionStorage.setItem('apois-superapp:corridas-google-url',rawUrl);}catch{}
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
  if (!html.includes(oldResetBlock)) throw new Error('[FAIL] shell cliente: bloco corridas-reset não encontrado');
  html = html.replace(oldResetBlock, newResetBlock);
}

const oldCallbackBlock = `        if(path==='callback'){
          window.location.replace(\`./modules/entregas/index.html#/auth/callback\${suffix()}\`);
          return true;
        }`;
const newCallbackBlock = `        if(path==='callback'){
          try{
            const pendingProduct=sessionStorage.getItem('apois-superapp:pending-oauth-product');
            if(pendingProduct==='corridas'){
              sessionStorage.removeItem('apois-superapp:pending-oauth-product');
              sessionStorage.setItem('apois-superapp:corridas-google-url',rawUrl);
              void window.Capacitor?.Plugins?.Browser?.close?.().catch(()=>undefined);
              window.location.replace('./modules/corridas/index.html#/login');
              return true;
            }
          }catch{}
          window.location.replace(\`./modules/entregas/index.html#/auth/callback\${suffix()}\`);
          return true;
        }`;
if (!html.includes("pendingProduct==='corridas'")) {
  if (!html.includes(oldCallbackBlock)) throw new Error('[FAIL] shell cliente: bloco callback compartilhado não encontrado');
  html = html.replace(oldCallbackBlock, newCallbackBlock);
}

writeFileSync(path, html, 'utf8');

if (!html.includes("path==='corridas-google'")) throw new Error('[FAIL] shell cliente: callback Google Corridas ausente');
if (!html.includes("pendingProduct==='corridas'")) throw new Error('[FAIL] shell cliente: callback compartilhado não diferencia Corridas');
console.log('[OK] shell cliente encaminha OAuth Google de Corridas pelo callback permitido');
