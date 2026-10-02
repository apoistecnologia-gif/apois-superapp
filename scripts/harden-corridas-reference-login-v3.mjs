import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
const workspace = process.env.APOIS_CORRIDAS_WORKSPACE || '.work/corridas';
const path = resolve(root, workspace, 'src/routes/_public.login.tsx');
const before = readFileSync(path, 'utf8');
let next = before;

if (!next.includes('data-apois-reference-login-v3="true"')) {
  const returnIndex = next.indexOf('return (');
  const divIndex = next.indexOf('<div', returnIndex);
  const divEnd = next.indexOf('>', divIndex);
  if (returnIndex < 0 || divIndex < 0 || divEnd < 0) {
    throw new Error('[FAIL] Corridas reference login V3: root JSX não localizada');
  }

  let opening = next.slice(divIndex, divEnd + 1);
  opening = opening.replace('<div', '<div data-apois-reference-login-v3="true"');
  next = next.slice(0, divIndex) + opening + next.slice(divEnd + 1);

  const insertedEnd = divIndex + opening.length;
  const style = `
      <style>{\`
        [data-apois-reference-login-v3="true"] {
          position: relative !important;
          min-height: 100dvh !important;
          overflow-x: hidden !important;
          color: #FFFFFF !important;
          background:
            radial-gradient(circle at 78% 8%, rgba(245,34,45,.22), transparent 28%),
            radial-gradient(circle at 20% 25%, rgba(217,165,32,.09), transparent 24%),
            linear-gradient(180deg, #08090B 0%, #0B0C0F 52%, #08090B 100%) !important;
          padding-top: max(18px, env(safe-area-inset-top)) !important;
        }
        [data-apois-reference-login-v3="true"]::before {
          content: "";
          position: absolute;
          pointer-events: none;
          z-index: 0;
          left: 0; right: 0; top: 0;
          height: 42%;
          opacity: .42;
          background:
            linear-gradient(180deg, transparent 0 58%, rgba(8,9,11,.72) 86%, #08090B 100%),
            repeating-linear-gradient(90deg, transparent 0 31px, rgba(255,255,255,.025) 32px 33px);
        }
        [data-apois-reference-login-v3="true"]::after {
          content: "";
          position: absolute;
          pointer-events: none;
          z-index: 0;
          left: -15%; right: -15%; top: 32%;
          height: 2px;
          background: linear-gradient(90deg, transparent, #F5222D 30%, #D9A520 70%, transparent);
          box-shadow: 0 0 28px rgba(245,34,45,.35);
          transform: rotate(-4deg);
        }
        [data-apois-reference-login-v3="true"] > * {
          position: relative;
          z-index: 1;
        }
        [data-apois-reference-login-v3="true"] img[alt*="APOIS" i],
        [data-apois-reference-login-v3="true"] img[src*="apois"] {
          display: block !important;
          width: min(72vw, 290px) !important;
          height: auto !important;
          max-height: 104px !important;
          object-fit: contain !important;
          object-position: center !important;
          padding: 0 !important;
          margin-left: auto !important;
          margin-right: auto !important;
          border: 0 !important;
          border-radius: 0 !important;
          background: transparent !important;
          box-shadow: none !important;
        }
        [data-apois-reference-login-v3="true"] form {
          border: 1px solid rgba(255,255,255,.06);
          background: rgba(17,19,24,.62);
          backdrop-filter: blur(14px);
          border-radius: 28px;
          box-shadow: 0 24px 60px rgba(0,0,0,.36);
        }
        [data-apois-reference-login-v3="true"] input {
          min-height: 56px !important;
          border-color: rgba(255,255,255,.16) !important;
          background: #111318 !important;
          color: #FFFFFF !important;
        }
        [data-apois-reference-login-v3="true"] input:focus {
          border-color: #F5222D !important;
          box-shadow: 0 0 0 2px rgba(245,34,45,.16) !important;
        }
        [data-apois-reference-login-v3="true"] form button[type="submit"] {
          min-height: 56px !important;
          border-radius: 16px !important;
          background: linear-gradient(135deg,#F5222D,#FF1F2D) !important;
          color: #FFFFFF !important;
          box-shadow: 0 14px 32px rgba(245,34,45,.28) !important;
        }
      \`}</style>`;
  next = next.slice(0, insertedEnd) + style + next.slice(insertedEnd);
}

next = next
  .replace('Bem-vindo ao APOIS', 'Entrar na APOIS')
  .replace('Faça login para continuar sua jornada.', 'Acesse sua conta e continue sua jornada com mais mobilidade.');

const required = [
  'data-apois-reference-login-v3="true"',
  'linear-gradient(135deg,#F5222D,#FF1F2D)',
  'object-fit: contain !important',
  'Entrar na APOIS',
  'Continuar com Google',
];
const missing = required.filter((marker) => !next.includes(marker));
if (missing.length) throw new Error('[FAIL] Corridas reference login V3: ' + missing.join(' | '));

if (next !== before) writeFileSync(path, next, 'utf8');
console.log('[OK] Corridas login V3 segue referência premium sem alterar handlers de senha/Google/recuperação.');
