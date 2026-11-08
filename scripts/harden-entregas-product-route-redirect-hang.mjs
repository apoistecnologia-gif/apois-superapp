// APOIS_ENTREGAS_PRODUCT_ROUTE_HANG_V1
//
// Defeito reproduzido em navegador (Playwright, 390x844): ao navegar para uma
// rota de outro produto — por exemplo #/courier no build do Cliente — o
// AuthSessionIsolation redireciona com window.location.replace('#/') e retorna
// sem nunca chamar setReady(true). Como o efeito tem dependências vazias, ele
// não roda de novo e o app fica preso no spinner "Validando sessão" para sempre.
//
// Medição antes da correção: 2s, 6s, 15s e 30s após a navegação, a tela
// continuava com 16 caracteres de texto ("Validando sessão") e hash "#/".
//
// Correção: ao bloquear a rota, marcamos a sessão como resolvida antes do
// redirect. O produto continua isolado (a rota não é montada) e o app deixa de
// travar.
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.env.APOIS_ENTREGAS_WORKSPACE || '.work/entregas';
const path = resolve(root, 'src/components/AuthSessionIsolation.tsx');
let source = readFileSync(path, 'utf8');

const marker = 'APOIS_ENTREGAS_PRODUCT_ROUTE_HANG_V1';
const anchor = `    if (!isPathAllowedForProduct(currentPath, product)) {
      window.location.replace(\`#\${getProductLandingRoute(product)}\`);
      return () => {
        disposed = true;
      };
    }`;
const replacement = `    if (!isPathAllowedForProduct(currentPath, product)) {
      // ${marker}: marcar a sessão como resolvida antes do redirect. Sem isto o
      // componente ficava preso em "Validando sessão" porque o efeito (deps [])
      // nunca voltava a rodar depois da troca de hash.
      setReady(true);
      window.location.replace(\`#\${getProductLandingRoute(product)}\`);
      return () => {
        disposed = true;
      };
    }`;

if (!source.includes(marker)) {
  if (!source.includes(anchor)) {
    console.error('[FAIL] Entregas: bloco de isolamento de rota por produto não encontrado');
    process.exit(1);
  }
  source = source.replace(anchor, replacement);
  writeFileSync(path, source, 'utf8');
  console.log('[OK] Entregas: rota de outro produto não deixa mais o app preso em "Validando sessão"');
} else {
  console.log('[OK] Entregas: correção de rota bloqueada já aplicada');
}

const final = readFileSync(path, 'utf8');
if (!/setReady\(true\);\s*\n\s*window\.location\.replace/.test(final)) {
  console.error('[FAIL] Entregas: setReady(true) não precede o redirect de produto');
  process.exit(1);
}
console.log('[OK] Entregas: contrato confirmado — redirect de produto marca sessão resolvida.');
