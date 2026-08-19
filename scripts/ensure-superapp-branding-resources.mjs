import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const resRoot = resolve('superapp/shell/android/app/src/main/res');
const valuesDir = join(resRoot, 'values');
const colorsPath = join(valuesDir, 'colors.xml');
const colorEntry = '<color name="ic_launcher_background">#050505</color>';

mkdirSync(valuesDir, { recursive: true });

if (!existsSync(colorsPath)) {
  writeFileSync(
    colorsPath,
    `<?xml version="1.0" encoding="utf-8"?>\n<resources>\n    ${colorEntry}\n</resources>\n`,
    'utf8',
  );
  console.log('[OK] Branding Android: colors.xml criado com fundo preto APOIS.');
  process.exit(0);
}

let colors = readFileSync(colorsPath, 'utf8');
if (/<color name="ic_launcher_background">[^<]*<\/color>/.test(colors)) {
  colors = colors.replace(
    /<color name="ic_launcher_background">[^<]*<\/color>/,
    colorEntry,
  );
} else if (colors.includes('</resources>')) {
  colors = colors.replace('</resources>', `    ${colorEntry}\n</resources>`);
} else {
  throw new Error('colors.xml existe, mas não contém um bloco <resources> válido.');
}

writeFileSync(colorsPath, colors, 'utf8');
console.log('[OK] Branding Android: fundo do launcher confirmado em #050505.');
