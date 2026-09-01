import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const path = resolve(process.cwd(), process.env.APOIS_ENTREGAS_WORKSPACE || '.work/partner-entregador', 'src/components/AuthSessionIsolation.tsx');
const source = readFileSync(path, 'utf8');
const before = '    const currentPath = window.location.pathname || "/";';
const after = `    const hashPath = window.location.hash.replace(/^#/, "").split(/[?#]/, 1)[0];
    const currentPath = hashPath || (window.location.pathname.endsWith("/index.html") ? "/courier" : window.location.pathname || "/");`;

if (source.includes('const hashPath = window.location.hash') && source.includes('endsWith("/index.html") ? "/courier"')) {
  console.log('[OK] Entregador Parceiro: boundary usa rota Hash do módulo aninhado');
  process.exit(0);
}
if (!source.includes(before)) throw new Error('Entregador Parceiro: AuthSessionIsolation.tsx não está no formato esperado.');
writeFileSync(path, source.replace(before, after), 'utf8');
console.log('[OK] Entregador Parceiro: boundary de sessão normalizada para Hash History');
