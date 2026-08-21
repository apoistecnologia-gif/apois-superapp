import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
const workspace = process.env.APOIS_MOTORISTA_WORKSPACE || '.work/partner-motorista';
const path = resolve(root, workspace, 'src/routes/motorista.app.tsx');
let source = readFileSync(path, 'utf8');

const listenerAnchor = `    window.addEventListener("focus", onFocus);
    window.addEventListener("online", onFocus);`;
const listenerReplacement = `${listenerAnchor}
    // Push recebido com o módulo Motorista aberto deve ressincronizar imediatamente
    // a corrida/oferta, sem depender de polling, focus ou troca de tela.
    const onDriverPush = () => { void resyncDriverRides(); };
    window.addEventListener("apois:driver-push", onDriverPush);
    window.addEventListener("apois:driver-push-open", onDriverPush);`;

if (!source.includes('window.addEventListener("apois:driver-push", onDriverPush);')) {
  if (!source.includes(listenerAnchor)) throw new Error('Motorista Parceiro: âncora de ressincronização por focus não encontrada.');
  source = source.replace(listenerAnchor, listenerReplacement);
}

const cleanupAnchor = `      window.removeEventListener("focus", onFocus);
      window.removeEventListener("online", onFocus);
      window.clearInterval(poll);`;
const cleanupReplacement = `      window.removeEventListener("focus", onFocus);
      window.removeEventListener("online", onFocus);
      window.removeEventListener("apois:driver-push", onDriverPush);
      window.removeEventListener("apois:driver-push-open", onDriverPush);
      window.clearInterval(poll);`;

if (!source.includes('window.removeEventListener("apois:driver-push", onDriverPush);')) {
  if (!source.includes(cleanupAnchor)) throw new Error('Motorista Parceiro: cleanup da ressincronização não encontrado.');
  source = source.replace(cleanupAnchor, cleanupReplacement);
}

for (const marker of [
  'const onDriverPush = () => { void resyncDriverRides(); };',
  'window.addEventListener("apois:driver-push", onDriverPush);',
  'window.addEventListener("apois:driver-push-open", onDriverPush);',
  'window.removeEventListener("apois:driver-push", onDriverPush);',
  'window.removeEventListener("apois:driver-push-open", onDriverPush);',
]) {
  if (!source.includes(marker)) throw new Error(`Motorista Parceiro: retomada por Push incompleta (${marker}).`);
}

writeFileSync(path, source, 'utf8');
console.log('[OK] Motorista Parceiro: Push de corrida força ressincronização imediata de oferta/corrida ativa.');
