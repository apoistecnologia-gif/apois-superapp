import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const path = resolve('superapp/shell/index.html');
let html = readFileSync(path, 'utf8');
const oldBlock = `        if(path==='corridas-reset'){
          try{sessionStorage.setItem(CORRIDAS_RECOVERY_KEY,rawUrl);}catch{}
          window.location.replace('./modules/corridas/index.html');
          return true;
        }`;
const newBlock = `        if(path==='corridas-google'){
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
if (!html.includes('apois-superapp:corridas-google-url')) {
  if (!html.includes(oldBlock)) throw new Error('[FAIL] shell cliente: bloco corridas-reset não encontrado');
  html = html.replace(oldBlock, newBlock);
  writeFileSync(path, html, 'utf8');
}
if (!html.includes("path==='corridas-google'")) throw new Error('[FAIL] shell cliente: callback Google Corridas ausente');
console.log('[OK] shell cliente encaminha OAuth Google de Corridas');
