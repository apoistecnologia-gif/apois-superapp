import { existsSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { execFileSync } from 'node:child_process';

/**
 * Leitura do estado Git dos snapshots protegidos em `sources/`.
 *
 * Os snapshots são submódulos: até `git submodule update --init` rodar,
 * `sources/<modulo>` é um diretório vazio e `git -C sources/<modulo> rev-parse
 * HEAD` NÃO falha — ele sobe pela árvore e devolve o HEAD do repositório
 * Superapp. Isso fazia `verify:pins` reprovar (ou, no sentido inverso, aprovar)
 * commits sem relação com o snapshot, deixando o gate de integridade do
 * release sem efeito real.
 *
 * Por isso o estado é sempre classificado explicitamente:
 *   - `uninitialized`: submódulo vazio; o commit pinado vive apenas no índice.
 *   - `checked-out`: worktree Git real em `sources/<modulo>`.
 *   - `broken`: o diretório existe mas não é um worktree Git válido.
 */

function runGit(args, cwd) {
  return execFileSync('git', args, { encoding: 'utf8', cwd, stdio: ['ignore', 'pipe', 'pipe'] }).trim();
}

/**
 * `path` é um worktree Git próprio (e não apenas um diretório dentro do
 * repositório pai)?
 */
export function isOwnWorktree(path) {
  if (!existsSync(path)) return false;
  if (existsSync(resolve(path, '.git'))) return true;
  try {
    return resolve(runGit(['-C', path, 'rev-parse', '--show-toplevel'])) === resolve(path);
  } catch {
    return false;
  }
}

/**
 * SHA do gitlink registrado no índice do repositório pai (`160000 commit ...`).
 */
export function indexSubmoduleCommit(repoRoot, path) {
  try {
    const output = runGit(['-C', repoRoot, 'ls-files', '-s', '--', path]);
    const match = /^160000\s+([0-9a-f]{40})\s+\d+\t/.exec(output);
    return match ? match[1] : null;
  } catch {
    return null;
  }
}

function worktreeDirty(path) {
  try {
    return runGit(['-C', path, 'status', '--porcelain']) !== '';
  } catch {
    return false;
  }
}

/**
 * Estado de um snapshot protegido.
 * @returns {{state: 'uninitialized'|'checked-out'|'broken', commit: string|null, dirty: boolean}}
 */
export function inspectSource(repoRoot, path) {
  const absolute = resolve(repoRoot, path);
  if (!existsSync(absolute)) return { state: 'broken', commit: null, dirty: false };

  if (isOwnWorktree(absolute)) {
    try {
      return { state: 'checked-out', commit: runGit(['-C', absolute, 'rev-parse', 'HEAD']), dirty: worktreeDirty(absolute) };
    } catch {
      return { state: 'broken', commit: null, dirty: false };
    }
  }

  // Sem worktree próprio: só é um submódulo válido se for o diretório vazio
  // que o Git criou. Qualquer conteúdo aqui é cópia manual/parcial e não pode
  // ser tratada como fonte homologada.
  let empty = false;
  try {
    empty = readdirSync(absolute).length === 0;
  } catch {
    empty = false;
  }
  if (empty && indexSubmoduleCommit(repoRoot, path)) {
    return { state: 'uninitialized', commit: null, dirty: false };
  }
  return { state: 'broken', commit: null, dirty: false };
}
