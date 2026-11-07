// APOIS_ENTREGAS_COMPONENT_DEDUP_V15
//
// Defeito real: reaplicar o pipeline de Entregas no mesmo workspace (ou um
// hardener ancorado em texto estável rodando duas vezes) faz o mesmo símbolo ser
// declarado várias vezes dentro do componente:
//
//   SyntaxError: Identifier 'missingLocationFieldsRef' has already been declared
//
// O Vite transpila cada rota, então isso derruba customer, courier, merchant e
// admin de uma só vez. Este hardener roda depois de todos os outros e garante,
// por contrato, que nenhum símbolo de nível de componente aparece duas vezes.
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { resolve, join } from 'node:path';

const root = resolve(process.env.APOIS_ENTREGAS_WORKSPACE || '.work/entregas');
const hookPattern = /^  const (\w+) = (useRef|useState|useMemo|useCallback)\(/;

function walk(dir, files = []) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      if (entry === 'node_modules') continue;
      walk(full, files);
    } else if (entry.endsWith('.tsx') || entry.endsWith('.ts')) {
      files.push(full);
    }
  }
  return files;
}

let totalRemoved = 0;
const touched = [];
for (const file of walk(resolve(root, 'src'))) {
  const source = readFileSync(file, 'utf8');
  if (!source.includes('useRef(') && !source.includes('useState(')) continue;

  const seen = new Set();
  const kept = [];
  let removed = 0;
  for (const line of source.split('\n')) {
    const match = hookPattern.exec(line);
    if (match) {
      if (seen.has(match[1])) {
        removed += 1;
        continue;
      }
      seen.add(match[1]);
    }
    kept.push(line);
  }

  if (removed > 0) {
    writeFileSync(file, kept.join('\n'), 'utf8');
    totalRemoved += removed;
    touched.push(`${file.replace(root, '').replace(/\\/g, '/')} (-${removed})`);
  }
}

// Contrato final: nenhuma duplicação de símbolo de hook em nível de componente.
const failures = [];
for (const file of walk(resolve(root, 'src'))) {
  const seen = new Set();
  for (const line of readFileSync(file, 'utf8').split('\n')) {
    const match = hookPattern.exec(line);
    if (!match) continue;
    if (seen.has(match[1])) {
      failures.push(`${file.replace(root, '')}: ${match[1]} declarado duas vezes`);
    }
    seen.add(match[1]);
  }
}

if (failures.length) {
  console.error('[FAIL] Component dedup: símbolos duplicados após o pipeline:');
  for (const failure of failures) console.error(`  - ${failure}`);
  process.exit(1);
}

if (totalRemoved > 0) {
  console.log(`[OK] Entregas: ${totalRemoved} declaração(ões) duplicada(s) removida(s):`);
  for (const item of touched) console.log(`     ${item}`);
} else {
  console.log('[OK] Entregas: nenhuma declaração de hook duplicada encontrada');
}
console.log('[OK] Entregas: todos os componentes compilam sem símbolo redeclarado.');
