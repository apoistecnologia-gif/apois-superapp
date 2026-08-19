import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

function replaceRequired(path, search, replacement, label) {
  const full = resolve(path);
  const before = readFileSync(full, 'utf8');
  if (before.includes(replacement)) {
    console.log(`[OK] ${label} (já normalizado)`);
    return;
  }
  if (!before.includes(search)) {
    console.error(`[FAIL] ${label}: saída intermediária esperada não encontrada em ${path}`);
    process.exit(1);
  }
  writeFileSync(full, before.replace(search, replacement), 'utf8');
  console.log(`[OK] ${label}`);
}

// adapt-module-for-superapp é a camada histórica/base. Algumas adaptações de
// Push/Auth ganharam depois uma implementação mais completa em hardeners
// específicos. Normalizamos apenas a cópia .work entre essas duas camadas para
// que cada transformação tenha um único formato de entrada determinístico.
replaceRequired(
  '.work/entregas/src/lib/customer-push.ts',
  '    ? `#/pedido/${encodeURIComponent(orderId)}`\n    : "#/notificacoes";',
  '    ? `/pedido/${encodeURIComponent(orderId)}`\n    : "/notificacoes";',
  'Entregas: handoff de destino Push para o hardener de produto',
);

replaceRequired(
  '.work/entregas/src/lib/customer-push.ts',
  '        if (window.location.hash !== target) window.location.assign(target);',
  '        if (window.location.pathname !== target) window.location.assign(target);',
  'Entregas: handoff de navegação Push para o hardener de Hash',
);

const interimHash =
  '      const routeQuery = window.location.hash.includes("?")\n' +
  '        ? window.location.hash.slice(window.location.hash.indexOf("?") + 1)\n' +
  '        : "";\n' +
  '      const params = new URLSearchParams(window.location.search || routeQuery);';
const originalParams = '      const params = new URLSearchParams(window.location.search);';

for (const [path, label] of [
  ['.work/entregas/src/routes/auth.callback.tsx', 'callback OAuth/e-mail'],
  ['.work/entregas/src/routes/redefinir-senha.tsx', 'recuperação de senha'],
]) {
  replaceRequired(path, interimHash, originalParams, `Entregas: handoff Hash ${label}`);
}

console.log('[OK] Entregas: handoff entre adaptador base e hardeners especializados concluído');
