import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { relative, resolve } from 'node:path';

const root = resolve('.');
const dist = resolve(root, 'superapp/shell/dist');
const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';

function run(command, args) {
  execFileSync(command, args, { cwd: root, stdio: 'inherit', env: process.env });
}

function hashTree(dir) {
  if (!existsSync(dir)) throw new Error(`dist ausente: ${dir}`);
  const hash = createHash('sha256');
  const stack = [dir];
  const files = [];
  while (stack.length) {
    const current = stack.pop();
    for (const name of readdirSync(current).sort()) {
      const path = resolve(current, name);
      const stat = statSync(path);
      if (stat.isDirectory()) stack.push(path);
      else if (stat.isFile()) files.push(path);
    }
  }
  files.sort((a, b) => relative(dir, a).localeCompare(relative(dir, b)));
  for (const path of files) {
    hash.update(relative(dir, path).replaceAll('\\', '/'));
    hash.update('\0');
    hash.update(readFileSync(path));
    hash.update('\0');
  }
  return hash.digest('hex');
}

function buildFinalArtifact() {
  run(npm, ['run', 'build:shell']);
  run(npm, ['run', 'harden:auth-deeplinks']);
  run(npm, ['run', 'inject:push-routing']);
  run(process.execPath, ['scripts/verify-superapp-final-artifact.mjs']);
  return hashTree(dist);
}

const first = buildFinalArtifact();
const second = buildFinalArtifact();
if (first !== second) {
  console.error(`[FAIL] build não determinístico: primeira árvore ${first}, segunda ${second}`);
  process.exit(1);
}
console.log(`[OK] build do shell é idempotente/determinístico em duas execuções consecutivas: ${first}`);
