import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
const workspace = process.env.APOIS_ENTREGAS_WORKSPACE || '.work/entregas';
const srcRoot = resolve(root, workspace, 'src');
const publicRoot = resolve(root, workspace, 'public');

if (!existsSync(srcRoot)) throw new Error(`Brand sweep: workspace ausente ${srcRoot}`);

const textualExtensions = new Set(['.ts', '.tsx', '.js', '.jsx', '.css', '.mjs', '.svg']);
const legacyPurpleHex = ['#6A1B9A', '#6a1b9a'];
const legacyTealHex = ['#35A9C9', '#35a9c9', '#1F7894', '#1f7894'];
const legacyGoldHex = ['#FFD700', '#F6B900', '#FACC15', '#F6BE1C', '#C88A08'];

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

  // Roxo/ciano/amarelo eram identidade antiga. Verde NÃO é trocado de forma
  // genérica porque também representa sucesso/online em estados operacionais.
  for (const value of legacyPurpleHex) after = after.replaceAll(value, '#E51B23');
  for (const value of legacyTealHex) after = after.replaceAll(value, '#E51B23');
  for (const value of legacyGoldHex) after = after.replaceAll(value, '#E51B23');

  after = after
    .replaceAll('rgba(106,27,154,', 'rgba(229,27,35,')
    .replaceAll('rgba(106, 27, 154,', 'rgba(229, 27, 35,')
    .replaceAll('rgba(53,169,201,', 'rgba(229,27,35,')
    .replaceAll('rgba(31,120,148,', 'rgba(229,27,35,')
    .replaceAll('rgba(246,190,28,', 'rgba(229,27,35,')
    .replaceAll('rgba(200,138,8,', 'rgba(201,20,27,');

  // Constante de marca explícita: muda só o valor, não o identificador nem o contrato.
  after = after
    .replace('const BRAND_GREEN = "#39B54A";', 'const BRAND_GREEN = "#E51B23";')
    .replace("const BRAND_GREEN = '#39B54A';", "const BRAND_GREEN = '#E51B23';");

  if (after !== before) {
    writeFileSync(path, after, 'utf8');
    changedFiles += 1;
  }
}

// Logo é identidade, não estado. Aqui a paleta antiga inteira pode ser migrada.
for (const path of logoFiles) {
  const before = readFileSync(path, 'utf8');
  let after = before
    .replaceAll('#39B54A', '#E51B23')
    .replaceAll('#39b54a', '#E51B23')
    .replaceAll('#6A1B9A', '#111111')
    .replaceAll('#6a1b9a', '#111111')
    .replaceAll('#35A9C9', '#E51B23')
    .replaceAll('#35a9c9', '#E51B23')
    .replaceAll('#1F7894', '#111111')
    .replaceAll('#1f7894', '#111111')
    .replaceAll('#F6BE1C', '#E51B23')
    .replaceAll('#C88A08', '#C9141B')
    .replaceAll('azul petróleo', 'vermelho e preto')
    .replaceAll('dourado', 'vermelho e preto');
  if (after !== before) {
    writeFileSync(path, after, 'utf8');
    changedFiles += 1;
  }
}

const leftovers = [];
for (const path of sourceFiles) {
  const source = readFileSync(path, 'utf8');
  for (const marker of [
    ...legacyPurpleHex,
    ...legacyTealHex,
    ...legacyGoldHex,
    'rgba(106,27,154,',
    'rgba(106, 27, 154,',
    'rgba(53,169,201,',
    'rgba(31,120,148,',
    'rgba(246,190,28,',
    'rgba(200,138,8,',
  ]) {
    if (source.includes(marker)) leftovers.push(`${path}: ${marker}`);
  }
}
for (const path of logoFiles) {
  const source = readFileSync(path, 'utf8');
  for (const marker of ['#39B54A', '#39b54a', ...legacyPurpleHex, ...legacyTealHex, ...legacyGoldHex, 'azul petróleo', 'dourado']) {
    if (source.includes(marker)) leftovers.push(`${path}: ${marker}`);
  }
}
if (leftovers.length) {
  throw new Error(`Brand sweep: identidade antiga ainda presente:\n${leftovers.slice(0, 80).join('\n')}`);
}

console.log(`[OK] Brand sweep ${workspace}: ${changedFiles} arquivo(s) visualmente normalizado(s); identidade roxo/ciano/dourado removida. Verde semântico continua preservado.`);
