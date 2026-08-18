import { execFileSync } from 'node:child_process';

const modules = [
  ['APOIS Entregas', 'apps/entregas'],
  ['APOIS Corridas Passageiro', 'apps/corridas-passageiro'],
  ['APOIS Corridas Motorista/Admin', 'apps/corridas-motorista-admin'],
];

for (const [label, path] of modules) {
  try {
    const head = execFileSync('git', ['-C', path, 'rev-parse', '--short=12', 'HEAD'], { encoding: 'utf8' }).trim();
    const dirty = execFileSync('git', ['-C', path, 'status', '--porcelain'], { encoding: 'utf8' }).trim();
    console.log(`${label}: ${head}${dirty ? ' (alterado localmente)' : ' (limpo)'}`);
  } catch {
    console.log(`${label}: não inicializado`);
  }
}
