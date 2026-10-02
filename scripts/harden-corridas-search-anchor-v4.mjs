import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
const workspace = process.env.APOIS_CORRIDAS_WORKSPACE || '.work/corridas';
const path = resolve(root, workspace, 'src/routes/_authenticated.buscar-destino.tsx');
const before = readFileSync(path, 'utf8');
let next = before;

if (!next.includes('data-apois-search-anchor-v4="true"')) {
  const marker = 'data-apois-search-fullscreen-v3="true"';
  const markerIndex = next.indexOf(marker);
  if (markerIndex < 0) throw new Error('[FAIL] Corridas search anchor V4: fullscreen-v3 ausente');

  const tagStart = next.lastIndexOf('<', markerIndex);
  const tagEnd = next.indexOf('>', markerIndex);
  if (tagStart < 0 || tagEnd < 0) throw new Error('[FAIL] Corridas search anchor V4: root fullscreen inválida');

  let opening = next.slice(tagStart, tagEnd + 1);
  opening = opening.replace(
    marker,
    marker + '\n      data-apois-search-anchor-v4="true"',
  );
  if (!opening.includes('onFocusCapture=')) {
    opening = opening.replace(
      />$/,
      ` onFocusCapture={() => {
        window.requestAnimationFrame(() => {
          document.scrollingElement?.scrollTo({ top: 0, left: 0, behavior: "auto" });
        });
      }}>`,
    );
  }
  next = next.slice(0, tagStart) + opening + next.slice(tagEnd + 1);

  const insertedTagEnd = tagStart + opening.length;
  const style = `
      <style>{\`
        html:has([data-apois-search-anchor-v4="true"]),
        body:has([data-apois-search-anchor-v4="true"]) {
          overflow: hidden !important;
          overscroll-behavior: none !important;
        }
        [data-apois-search-anchor-v4="true"] {
          position: fixed !important;
          inset: 0 !important;
          width: 100% !important;
          height: 100dvh !important;
          max-height: 100dvh !important;
          overflow: hidden !important;
          overscroll-behavior: none !important;
          transform: none !important;
          padding-top: max(42px, env(safe-area-inset-top)) !important;
          box-sizing: border-box !important;
        }
        [data-apois-search-anchor-v4="true"] input {
          scroll-margin-top: 96px !important;
        }
      \`}</style>`;
  next = next.slice(0, insertedTagEnd) + style + next.slice(insertedTagEnd);
}

// Browser/WebView may auto-pan the document when an input receives focus.
// There must be no explicit scrollIntoView/scrollTo from older keyboard patches
// fighting the fixed fullscreen container.
next = next
  .replace(/[^\n;]*\.scrollIntoView\([^;]*\);?/g, '')
  .replace(/window\.scrollTo\([^;]*\);?/g, '');

const required = [
  'data-apois-search-fullscreen-v3="true"',
  'data-apois-search-anchor-v4="true"',
  'position: fixed !important',
  'height: 100dvh !important',
  'overflow: hidden !important',
  'padding-top: max(42px, env(safe-area-inset-top)) !important',
  'onFocusCapture={() => {',
  'preventScroll',
];
const missing = required.filter((marker) => !next.includes(marker));
if (missing.length) throw new Error('[FAIL] Corridas search anchor V4: ' + missing.join(' | '));
if (next.includes('.scrollIntoView(')) throw new Error('[FAIL] Corridas search anchor V4: scrollIntoView regressivo permaneceu');

if (next !== before) writeFileSync(path, next, 'utf8');
console.log('[OK] Corridas search anchor V4 mantém header/campo estáveis com teclado e preserva fullscreen-v3.');
