import './harden-superapp-shell-copy.mjs';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const path = resolve(process.env.APOIS_SHELL_HTML_PATH?.trim() || 'superapp/shell/index.html');
let source = readFileSync(path, 'utf8');
const isReferenceV4 = source.includes('data-apois-reference-home-v4="true"');

const carSvg = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 17h14l-1.2-6.1a2 2 0 0 0-2-1.6H8.2a2 2 0 0 0-2 1.6L5 17Z"/><path d="M7 9.3 8.4 6h7.2L17 9.3M5 13H3.5M20.5 13H19"/><circle cx="7.5" cy="17.5" r="1.5"/><circle cx="16.5" cy="17.5" r="1.5"/></svg>';
const motoSvg = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="6" cy="17" r="3"/><circle cx="18" cy="17" r="3"/><path d="m7 17 4-7h3l3 7M9 13h7M12 10l-2-3H7"/></svg>';
const bagSvg = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 8h14l-1 12H6L5 8Z"/><path d="M9 9V6a3 3 0 0 1 6 0v3"/></svg>';
const boxSvg = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m4 7 8-4 8 4-8 4-8-4Z"/><path d="M4 7v10l8 4 8-4V7M12 11v10"/></svg>';

if (!isReferenceV4) {
  source = source.replace(
    '.vehicle,.delivery{position:relative;z-index:1;margin-bottom:20px;font-size:62px;filter:drop-shadow(0 8px 12px rgba(0,0,0,.45))}',
    '.vehicle,.delivery{position:relative;z-index:1;margin-bottom:20px;display:flex;align-items:center;justify-content:center;gap:8px;color:#f6be1c;filter:drop-shadow(0 8px 12px rgba(0,0,0,.45))}.vehicle svg,.delivery svg{width:54px;height:54px;fill:none;stroke:currentColor;stroke-width:1.65;stroke-linecap:round;stroke-linejoin:round}.badge svg{width:23px;height:23px;fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round}',
  );
  source = source.replace('<div class="badge">🚘</div><div class="vehicle">🚗🏍️</div>', `<div class="badge">${carSvg}</div><div class="vehicle">${carSvg}${motoSvg}</div>`);
  source = source.replace('<div class="badge">🛍</div><div class="delivery">🛵📦</div>', `<div class="badge">${bagSvg}</div><div class="delivery">${motoSvg}${boxSvg}</div>`);
}

if (/🚘|🚗|🏍️|🛍|🛵|📦/.test(source)) {
  throw new Error('[FAIL] Shell Cliente: emoji de serviço variável por dispositivo ainda está presente.');
}

const iconographyOk = isReferenceV4
  ? source.includes('.visual svg') && source.includes('<svg viewBox="0 0 24 24">')
  : source.includes('.vehicle svg,.delivery svg') && source.includes('<svg viewBox="0 0 24 24" aria-hidden="true">');

if (!iconographyOk) throw new Error('[FAIL] Shell Cliente: iconografia SVG determinística ausente');
if (!source.includes('<strong>Apois, <span>vamos?</span></strong>')) {
  throw new Error('[FAIL] Shell Cliente: slogan oficial ausente');
}

writeFileSync(path, source, 'utf8');
console.log(`[OK] Shell Cliente: categorias, slogan e ícones ficam consistentes em todos os dispositivos (${path}).`);
