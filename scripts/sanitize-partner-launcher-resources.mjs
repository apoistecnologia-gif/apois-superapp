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

  // O launcher APOIS usa @drawable/apois_launcher_background. Portanto qualquer
  // definição de color/ic_launcher_background deixada pelo template Capacitor ou
  // por uma execução anterior é desnecessária e pode colidir no AAPT2.
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

  // Se algum XML antigo ainda referencia a cor do template, converte para o
  // drawable oficial em vez de deixar referência órfã após a limpeza.
  if (xml.includes('@color/ic_launcher_background')) {
    const count = (xml.match(/@color\/ic_launcher_background/g) || []).length;
    rewrittenReferences += count;
    xml = xml.replaceAll('@color/ic_launcher_background', '@drawable/apois_launcher_background');
  }

  if (xml !== original) writeFileSync(path, xml, 'utf8');
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
if (!finalXml.includes('@drawable/apois_launcher_background')) {
  throw new Error('APOIS Parceiro: launcher não referencia o fundo preto determinístico após saneamento.');
}

console.log(`[OK] Launcher Parceiro saneado antes do Gradle: ${removedDefinitions} definição(ões) duplicáveis removida(s), ${rewrittenReferences} referência(s) migrada(s).`);
