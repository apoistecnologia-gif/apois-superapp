import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const [script, ...args] = process.argv.slice(2);
if (!script) {
  console.error('Uso: node scripts/run-bash.mjs <script> [args...]');
  process.exit(1);
}

function resolveBash() {
  if (process.platform !== 'win32') return 'bash';
  const candidates = [
    process.env.APOIS_BASH_PATH,
    process.env.ProgramW6432 && resolve(process.env.ProgramW6432, 'Git', 'bin', 'bash.exe'),
    process.env.ProgramFiles && resolve(process.env.ProgramFiles, 'Git', 'bin', 'bash.exe'),
    process.env.LOCALAPPDATA && resolve(process.env.LOCALAPPDATA, 'Programs', 'Git', 'bin', 'bash.exe'),
  ].filter(Boolean);
  const bash = candidates.find((candidate) => existsSync(candidate));
  if (!bash) {
    console.error('[FAIL] Windows: bash.exe não encontrado; instale Git Bash ou defina APOIS_BASH_PATH.');
    process.exit(1);
  }
  return bash;
}

const result = spawnSync(resolveBash(), [script, ...args], {
  cwd: resolve('.'),
  env: process.env,
  stdio: 'inherit',
  shell: false,
});
if (result.error) {
  console.error(result.error.message);
  process.exit(1);
}
process.exit(result.status ?? 1);
