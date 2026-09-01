import { lstat, readFile, readdir, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';

const roots = process.argv.slice(2).map((path) => resolve(path));
const skippedDirectories = new Set([
  'android',
  'ios',
  'backend-standalone',
  'node_modules',
  'dist',
  '.output',
  'build',
  '.gradle',
  '.tanstack',
  '.git',
]);
const textExtensions = new Set([
  '.ts',
  '.tsx',
  '.js',
  '.jsx',
  '.mjs',
  '.cjs',
  '.json',
  '.css',
  '.scss',
  '.html',
  '.md',
  '.yml',
  '.yaml',
  '.sql',
  '.toml',
]);

function isTextFile(name) {
  return textExtensions.has(name.slice(name.lastIndexOf('.')).toLowerCase()) || name.startsWith('.env');
}

async function normalizeDirectory(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (!skippedDirectories.has(entry.name)) await normalizeDirectory(join(directory, entry.name));
      continue;
    }
    if (!entry.isFile() || !isTextFile(entry.name)) continue;

    const path = join(directory, entry.name);
    const before = await readFile(path, 'utf8');
    const after = before.replace(/\r\n?/g, '\n');
    if (after !== before) await writeFile(path, after, 'utf8');
  }
}

if (roots.length !== 2) {
  throw new Error('Uso: node scripts/normalize-partner-workspaces.mjs <motorista> <entregador>');
}

for (const root of roots) {
  const stats = await lstat(root);
  if (!stats.isDirectory()) throw new Error(`Workspace Parceiro ausente: ${root}`);
  await normalizeDirectory(root);
}
