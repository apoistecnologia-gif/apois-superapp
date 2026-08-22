import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

let failed = false;
function requireMarkers(path, markers, label) {
  const full = resolve(path);
  if (!existsSync(full)) {
    console.error(`[FAIL] Auth mobile UI v20: arquivo ausente ${path}`);
    failed = true;
    return;
  }
  const source = readFileSync(full, 'utf8');
  const missing = markers.filter((marker) => !source.includes(marker));
  if (missing.length) {
    console.error(`[FAIL] ${label}: ${missing.join(' | ')}`);
    failed = true;
  } else console.log(`[OK] ${label}`);
}

requireMarkers('scripts/harden-entregas-customer-auth-mobile-ui.mjs', [
  "patch('src/routes/login.tsx'",
  'grid h-11 w-11',
  'inline-flex min-h-11 items-center',
  "patch('src/routes/register.tsx'",
  "'src/routes/recuperar-senha.tsx'",
  "'src/routes/redefinir-senha.tsx'",
  "replaceAll('h-screen', 'h-dvh')",
], 'Login, cadastro e recuperação têm viewport dinâmica e alvos de toque adequados');

requireMarkers('scripts/harden-entregas-superapp-checkout-mobile-ui.mjs', [
  "import './harden-entregas-customer-auth-mobile-ui.mjs';",
], 'Hardening móvel de autenticação roda depois da adaptação OAuth e antes do build');

process.exit(failed ? 1 : 0);
