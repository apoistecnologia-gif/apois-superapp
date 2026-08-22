import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
const workspace = process.env.APOIS_ENTREGAS_WORKSPACE || '.work/entregas';
const srcRoot = resolve(root, workspace, 'src');
const publicRoot = resolve(root, workspace, 'public');

if (!existsSync(srcRoot)) throw new Error(`Brand sweep: workspace ausente ${srcRoot}`);

const textualExtensions = new Set(['.ts', '.tsx', '.js', '.jsx', '.css', '.mjs', '.svg']);
const legacyGreenHex = ['#39B54A', '#39b54a'];
const legacyPurpleHex = ['#6A1B9A', '#6a1b9a'];
const legacyTealHex = ['#35A9C9', '#35a9c9', '#1F7894', '#1f7894'];

function ext(path) {
  const match = path.match(/\.[^.]+$/);
  return match?.[0] ?? '';
}

function walk(directory, files = []) {
  if (!existsSync(directory)) return files;
  for (const name of readdirSync(directory)) {
    const path = resolve(directory, name);
    const info = statSync(path);
    if (info.isDirectory()) walk(path, files);
    else if (textualExtensions.has(ext(path))) files.push(path);
  }
  return files;
}

const sourceFiles = walk(srcRoot);
const logoFiles = walk(publicRoot).filter((path) => /apois.*logo.*\.svg$/i.test(path));
let changedFiles = 0;

for (const path of sourceFiles) {
  const before = readFileSync(path, 'utf8');
  let after = before;

  // Estes valores eram a identidade antiga da marca. Estados funcionais
  // continuam podendo usar classes semânticas Tailwind (green/red/amber).
  for (const value of legacyGreenHex) after = after.replaceAll(value, '#F6BE1C');
  for (const value of legacyPurpleHex) after = after.replaceAll(value, '#C88A08');
  for (const value of legacyTealHex) after = after.replaceAll(value, '#F6BE1C');
  after = after
    .replaceAll('rgba(57,181,74,', 'rgba(246,190,28,')
    .replaceAll('rgba(57, 181, 74,', 'rgba(246, 190, 28,')
    .replaceAll('rgba(106,27,154,', 'rgba(200,138,8,')
    .replaceAll('rgba(106, 27, 154,', 'rgba(200, 138, 8,')
    .replaceAll('rgba(53,169,201,', 'rgba(246,190,28,')
    .replaceAll('rgba(31,120,148,', 'rgba(200,138,8,')
    .replace('const BRAND_GREEN = "#F6BE1C";\nconst APOIS_GOLD = "#F6BE1C";', 'const APOIS_GOLD = "#F6BE1C";')
    .replace('const BRAND_GREEN = "#F6BE1C";\n', '');

  if (after !== before) {
    writeFileSync(path, after, 'utf8');
    changedFiles += 1;
  }
}

// Logos são identidade, não estado operacional. Neles toda a paleta antiga é
// convertida para a dupla dourada oficial.
for (const path of logoFiles) {
  const before = readFileSync(path, 'utf8');
  let after = before
    .replaceAll('#39B54A', '#F6BE1C')
    .replaceAll('#39b54a', '#F6BE1C')
    .replaceAll('#6A1B9A', '#C88A08')
    .replaceAll('#6a1b9a', '#C88A08')
    .replaceAll('#35A9C9', '#F6BE1C')
    .replaceAll('#35a9c9', '#F6BE1C')
    .replaceAll('#1F7894', '#C88A08')
    .replaceAll('#1f7894', '#C88A08')
    .replaceAll('azul petróleo', 'dourado');
  if (after !== before) {
    writeFileSync(path, after, 'utf8');
    changedFiles += 1;
  }
}

const leftovers = [];
for (const path of sourceFiles) {
  const source = readFileSync(path, 'utf8');
  for (const marker of [
    ...legacyGreenHex,
    ...legacyPurpleHex,
    ...legacyTealHex,
    'rgba(57,181,74,',
    'rgba(57, 181, 74,',
    'rgba(106,27,154,',
    'rgba(106, 27, 154,',
  ]) {
    if (source.includes(marker)) leftovers.push(`${path}: ${marker}`);
  }
}
for (const path of logoFiles) {
  const source = readFileSync(path, 'utf8');
  for (const marker of [...legacyGreenHex, ...legacyPurpleHex, ...legacyTealHex, 'azul petróleo']) {
    if (source.includes(marker)) leftovers.push(`${path}: ${marker}`);
  }
}
if (leftovers.length) {
  throw new Error(`Brand sweep: identidade antiga ainda presente:\n${leftovers.slice(0, 80).join('\n')}`);
}

console.log(`[OK] Brand sweep ${workspace}: ${changedFiles} arquivo(s) normalizado(s); verde/roxo/ciano de marca removidos. Estados semânticos continuam livres para green/red/amber.`);
