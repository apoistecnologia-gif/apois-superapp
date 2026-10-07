import { existsSync, readFileSync, readdirSync, statSync, writeFileSync, rmSync, mkdirSync, copyFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const resRoot = resolve('superapp/partner-shell/android/app/src/main/res');
const officialLauncherBase64 = resolve('superapp/branding/apois-client-red-logo.b64');
const officialLauncher = '/tmp/apois-partner-red-logo-sanitized.png';
if (!existsSync(resRoot)) throw new Error(`Recursos Android do APOIS Parceiro ausentes: ${resRoot}`);
if (!existsSync(officialLauncherBase64)) throw new Error(`Arte vermelha oficial do APOIS ausente: ${officialLauncherBase64}`);
writeFileSync(officialLauncher, Buffer.from(readFileSync(officialLauncherBase64, 'utf8').trim(), 'base64'));

function walk(directory) {
  const files = [];
  for (const entry of readdirSync(directory)) {
    const full = join(directory, entry);
    if (statSync(full).isDirectory()) files.push(...walk(full));
    else files.push(full);
  }
  return files;
}

// Primeiro elimina a antiga colisão color/ic_launcher_background independentemente
// de qual arquivo o template Capacitor tenha criado.
const xmlFiles = walk(resRoot).filter((path) => path.endsWith('.xml'));
let removedDefinitions = 0;
let rewrittenReferences = 0;
for (const path of xmlFiles) {
  let xml = readFileSync(path, 'utf8');
  const original = xml;
  const colorPatterns = [
    /\s*<color\b[^>]*\bname\s*=\s*["']ic_launcher_background["'][^>]*>[\s\S]*?<\/color\s*>/gi,
    /\s*<color\b[^>]*\bname\s*=\s*["']ic_launcher_background["'][^>]*\/\s*>/gi,
    /\s*<item\b[^>]*\btype\s*=\s*["']color["'][^>]*\bname\s*=\s*["']ic_launcher_background["'][^>]*>[\s\S]*?<\/item\s*>/gi,
    /\s*<item\b[^>]*\bname\s*=\s*["']ic_launcher_background["'][^>]*\btype\s*=\s*["']color["'][^>]*>[\s\S]*?<\/item\s*>/gi,
  ];
  for (const pattern of colorPatterns) {
    xml = xml.replace(pattern, () => {
      removedDefinitions += 1;
      return '';
    });
  }
  if (xml.includes('@color/ic_launcher_background')) {
    const count = (xml.match(/@color\/ic_launcher_background/g) || []).length;
    rewrittenReferences += count;
    xml = xml.replaceAll('@color/ic_launcher_background', '@drawable/apois_launcher_background');
  }
  if (xml !== original) writeFileSync(path, xml, 'utf8');
}

// O Samsung estava exibindo apenas o fundo do adaptive icon. Para o launcher
// do Parceiro, a arte oficial passa a ser o próprio bitmap final em cada density.
// Removemos os aliases anydpi/adaptive para o Android não escolher um foreground
// diferente, monocromático ou residual. O launcher OEM mascara o bitmap legado
// normalmente, mas o A oficial permanece exatamente como está na arte fonte.
for (const dirName of ['mipmap-anydpi', 'mipmap-anydpi-v26']) {
  const dir = join(resRoot, dirName);
  rmSync(join(dir, 'ic_launcher.xml'), { force: true });
  rmSync(join(dir, 'ic_launcher_round.xml'), { force: true });
}
for (const stale of [
  join(resRoot, 'drawable', 'apois_launcher_a.xml'),
  join(resRoot, 'drawable', 'apois_launcher_a_monochrome.xml'),
  join(resRoot, 'drawable', 'ic_launcher_monochrome.xml'),
]) rmSync(stale, { force: true });

function render(size, output) {
  const result = spawnSync('sips', ['-s', 'format', 'png', '-z', String(size), String(size), officialLauncher, '--out', output], { encoding: 'utf8' });
  if (result.error || result.status !== 0 || !existsSync(output)) {
    throw new Error(`APOIS Parceiro: falha ao materializar launcher oficial ${size}px: ${result.error?.message || result.stderr || result.stdout || 'erro desconhecido'}`);
  }
}

const densities = [
  ['mipmap-mdpi', 48],
  ['mipmap-hdpi', 72],
  ['mipmap-xhdpi', 96],
  ['mipmap-xxhdpi', 144],
  ['mipmap-xxxhdpi', 192],
];
for (const [dirName, size] of densities) {
  const dir = join(resRoot, dirName);
  mkdirSync(dir, { recursive: true });
  for (const stale of ['ic_launcher.webp', 'ic_launcher_round.webp', 'ic_launcher_foreground.webp', 'ic_launcher_foreground.png']) {
    rmSync(join(dir, stale), { force: true });
  }
  const tmp = `/tmp/apois-partner-official-${size}.png`;
  render(size, tmp);
  copyFileSync(tmp, join(dir, 'ic_launcher.png'));
  copyFileSync(tmp, join(dir, 'ic_launcher_round.png'));
  rmSync(tmp, { force: true });
  if (!existsSync(join(dir, 'ic_launcher.png')) || !existsSync(join(dir, 'ic_launcher_round.png'))) {
    throw new Error(`APOIS Parceiro: launcher raster não foi gravado em ${dirName}.`);
  }
}

const finalXml = walk(resRoot)
  .filter((path) => path.endsWith('.xml'))
  .map((path) => readFileSync(path, 'utf8'))
  .join('\n');
if (/name\s*=\s*["']ic_launcher_background["']/.test(finalXml)) {
  throw new Error('APOIS Parceiro: ainda existe definição residual de ic_launcher_background após saneamento.');
}
if (finalXml.includes('@color/ic_launcher_background')) {
  throw new Error('APOIS Parceiro: ainda existe referência residual a @color/ic_launcher_background.');
}
if (existsSync(join(resRoot, 'mipmap-anydpi-v26', 'ic_launcher.xml'))) {
  throw new Error('APOIS Parceiro: adaptive icon residual pode esconder a arte oficial.');
}

console.log(`[OK] Launcher Parceiro finalizado com raster vermelho oficial APOIS em 5 densities; ${removedDefinitions} definição(ões) duplicáveis removida(s), ${rewrittenReferences} referência(s) migrada(s).`);
