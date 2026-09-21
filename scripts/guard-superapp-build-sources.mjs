import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { dirname, relative, resolve } from 'node:path';

const root = resolve('.');
const snapshotPath = resolve(root, '.work/build-integrity/source-snapshot.json');
const mode = process.argv[2];
const excludedDirs = new Set(['.git', 'node_modules', 'dist', '.output', 'android', 'ios', 'build', '.gradle', '.next', 'coverage']);
const fallbackRoots = [
  'package.json',
  'codemagic.yaml',
  '.env.example',
  '.apois',
  'scripts',
  'superapp/shell',
  'supabase',
  'sources',
];

function hashFile(path) {
  return createHash('sha256').update(readFileSync(path)).digest('hex');
}

function collect(path, output) {
  if (!existsSync(path)) return;
  const stat = statSync(path);
  if (stat.isFile()) {
    output[relative(root, path).replaceAll('\\', '/')] = hashFile(path);
    return;
  }
  if (!stat.isDirectory()) return;
  for (const name of readdirSync(path).sort()) {
    if (excludedDirs.has(name)) continue;
    collect(resolve(path, name), output);
  }
}

function fallbackSnapshot() {
  const files = {};
  for (const item of fallbackRoots) collect(resolve(root, item), files);
  return files;
}

function gitStatus() {
  if (!existsSync(resolve(root, '.git'))) return null;
  try {
    return execFileSync('git', ['status', '--porcelain=v1', '--untracked-files=no'], {
      cwd: root,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    }).replace(/\r/g, '');
  } catch (error) {
    throw new Error(`metadata Git disponível, mas git status falhou: ${error?.message ?? 'erro desconhecido'}`);
  }
}

function capture() {
  const snapshot = {
    version: 1,
    createdAt: new Date().toISOString(),
    gitStatus: gitStatus(),
    files: fallbackSnapshot(),
  };
  mkdirSync(dirname(snapshotPath), { recursive: true });
  writeFileSync(snapshotPath, `${JSON.stringify(snapshot, null, 2)}\n`, 'utf8');
  console.log(`[OK] integridade de source capturada: ${Object.keys(snapshot.files).length} arquivos${snapshot.gitStatus === null ? ' (export sem .git)' : ' + git status'}`);
}

function verify() {
  if (!existsSync(snapshotPath)) throw new Error('snapshot de integridade ausente; execute capture antes do build');
  const before = JSON.parse(readFileSync(snapshotPath, 'utf8'));
  const afterFiles = fallbackSnapshot();
  const changes = [];
  const keys = new Set([...Object.keys(before.files ?? {}), ...Object.keys(afterFiles)]);
  for (const key of [...keys].sort()) {
    const previous = before.files?.[key];
    const current = afterFiles[key];
    if (previous !== current) changes.push(`${key}: ${previous ? 'alterado/removido' : 'criado'}`);
  }

  if (before.gitStatus !== null) {
    const currentGitStatus = gitStatus();
    if (currentGitStatus !== before.gitStatus) {
      changes.push('git status mudou durante o build');
      console.error('[DIFF] status antes:');
      console.error(before.gitStatus || '(limpo)');
      console.error('[DIFF] status depois:');
      console.error(currentGitStatus || '(limpo)');
    }
  }

  if (changes.length) {
    console.error('[FAIL] build alterou source versionado/entrada protegida:');
    for (const change of changes.slice(0, 50)) console.error(` - ${change}`);
    if (changes.length > 50) console.error(` - ... ${changes.length - 50} alterações adicionais`);
    process.exit(1);
  }
  console.log('[OK] build não alterou sources/arquivos versionados protegidos.');
}

if (mode === 'capture') capture();
else if (mode === 'verify') verify();
else {
  console.error('Uso: node scripts/guard-superapp-build-sources.mjs <capture|verify>');
  process.exit(2);
}
