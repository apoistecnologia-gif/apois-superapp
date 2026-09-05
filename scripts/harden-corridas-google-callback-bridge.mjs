import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const path = resolve('.work/corridas/dist/index.html');
let html = readFileSync(path, 'utf8');

const oldBlock = `      if (moduleName === 'corridas') {
        if (path === 'reset' || path === 'callback' || path === 'email-change') {
          try { sessionStorage.setItem(entregasAuthForwardKey, rawUrl); } catch {}
          window.location.replace('../entregas/index.html');
          return true;
        }
        return false;
      }`;

const newBlock = `      if (moduleName === 'corridas') {
        if (path === 'callback') {
          try {
            const pendingProduct = sessionStorage.getItem('apois-superapp:pending-oauth-product');
            if (pendingProduct === 'corridas') {
              sessionStorage.removeItem('apois-superapp:pending-oauth-product');
              sessionStorage.setItem('apois-superapp:corridas-google-url', rawUrl);
              window.location.replace('./index.html#/login');
              return true;
            }
          } catch {}
        }
        if (path === 'reset' || path === 'callback' || path === 'email-change') {
          try { sessionStorage.setItem(entregasAuthForwardKey, rawUrl); } catch {}
          window.location.replace('../entregas/index.html');
          return true;
        }
        return false;
      }`;

if (!html.includes("apois-superapp:pending-oauth-product")) {
  if (!html.includes(oldBlock)) throw new Error('[FAIL] corridas: bridge base de auth não encontrado');
  html = html.replace(oldBlock, newBlock);
  writeFileSync(path, html, 'utf8');
}

if (!html.includes("sessionStorage.setItem('apois-superapp:corridas-google-url', rawUrl)")) {
  throw new Error('[FAIL] corridas: callback Google compartilhado não retorna ao módulo');
}

console.log('[OK] corridas: callback OAuth compartilhado retorna ao módulo Corridas');
