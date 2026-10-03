import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const resRoot = resolve('superapp/partner-shell/android/app/src/main/res');
if (!existsSync(resRoot)) throw new Error(`Recursos Android do APOIS Parceiro ausentes: ${resRoot}`);

function walk(directory) {
  const files = [];
  for (const entry of readdirSync(directory)) {
    const full = join(directory, entry);
    if (statSync(full).isDirectory()) files.push(...walk(full));
    else files.push(full);
  }
  return files;
}

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

const markPath = join(resRoot, 'drawable', 'apois_launcher_mark.xml');
const backgroundPath = join(resRoot, 'drawable', 'apois_launcher_background.xml');
const legacyPath = join(resRoot, 'mipmap-anydpi', 'ic_launcher.xml');
const adaptivePath = join(resRoot, 'mipmap-anydpi-v26', 'ic_launcher.xml');

for (const required of [markPath, backgroundPath, legacyPath, adaptivePath]) {
  if (!existsSync(required)) throw new Error(`APOIS Parceiro: recurso visual ausente após saneamento: ${required}`);
}

const mark = readFileSync(markPath, 'utf8');
const background = readFileSync(backgroundPath, 'utf8');
const legacy = readFileSync(legacyPath, 'utf8');
const adaptive = readFileSync(adaptivePath, 'utf8');

if (!mark.includes('#E51B23') || !mark.includes('#111111')) {
  throw new Error('APOIS Parceiro: símbolo do launcher não usa vermelho/preto oficiais.');
}
if (!background.includes('#FFFFFF')) {
  throw new Error('APOIS Parceiro: launcher não usa fundo branco oficial.');
}
if (!legacy.includes('@drawable/apois_launcher_mark') || !adaptive.includes('@drawable/apois_launcher_mark')) {
  throw new Error('APOIS Parceiro: launcher legado/adaptativo não usa o símbolo vetorial oficial.');
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

console.log(`[OK] Launcher Parceiro saneado sem destruir o vetor oficial; ${removedDefinitions} definição(ões) duplicáveis removida(s), ${rewrittenReferences} referência(s) migrada(s).`);
