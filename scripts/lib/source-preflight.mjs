import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { resolve } from 'node:path';

export const DEFAULT_SOURCE_SPECS = [
  {
    key: 'entregas',
    path: 'sources/apois-entregas',
    sentinels: [
      { path: 'package.json', type: 'file', json: true },
      { path: 'src', type: 'dir', nonEmpty: true },
      { path: 'supabase/config.toml', type: 'file' },
    ],
  },
  {
    key: 'corridas_passageiro',
    path: 'sources/apois-corridas-passageiro',
    sentinels: [
      { path: 'package.json', type: 'file', json: true },
      { path: 'src', type: 'dir', nonEmpty: true },
      { path: 'capacitor.config.ts', type: 'file' },
      { path: 'supabase/config.toml', type: 'file' },
    ],
  },
  {
    key: 'corridas_motorista_admin',
    path: 'sources/apois-corridas-motorista-admin',
    sentinels: [
      { path: 'package.json', type: 'file', json: true },
      { path: 'src', type: 'dir', nonEmpty: true },
      { path: 'supabase/config.toml', type: 'file' },
    ],
  },
];

const IGNORED_EMPTY_ENTRIES = new Set(['.git', '.gitkeep', '.DS_Store']);

function defaultGitStatusProvider(root, sourcePath) {
  return execFileSync('git', ['-C', root, 'submodule', 'status', '--', sourcePath], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
}

function output(logger, level, message) {
  const fn = logger?.[level] ?? logger?.log;
  if (typeof fn === 'function') fn.call(logger, message);
}

function addIssue(collection, logger, level, issue) {
  collection.push(issue);
  const prefix = level === 'warn' ? '[WARN]' : '[FAIL]';
  output(logger, level === 'warn' ? 'warn' : 'error', `${prefix} ${issue.key}: ${issue.message}`);
}

function isNonEmptyDirectory(path) {
  return readdirSync(path).some((entry) => !IGNORED_EMPTY_ENTRIES.has(entry));
}

function validateSentinel(sourceRoot, sentinel) {
  const full = resolve(sourceRoot, sentinel.path);
  if (!existsSync(full)) return `sentinela ausente: ${sentinel.path}`;
  const stat = statSync(full);
  if (sentinel.type === 'file' && !stat.isFile()) return `sentinela não é arquivo: ${sentinel.path}`;
  if (sentinel.type === 'dir' && !stat.isDirectory()) return `sentinela não é diretório: ${sentinel.path}`;
  if (sentinel.type === 'file' && stat.size === 0) return `sentinela vazia: ${sentinel.path}`;
  if (sentinel.type === 'dir' && sentinel.nonEmpty && !isNonEmptyDirectory(full)) {
    return `diretório sentinela vazio: ${sentinel.path}`;
  }
  if (sentinel.json) {
    try {
      JSON.parse(readFileSync(full, 'utf8'));
    } catch {
      return `JSON sentinela inválido: ${sentinel.path}`;
    }
  }
  return null;
}

function parseSubmoduleStatus(raw, sourcePath) {
  const line = String(raw ?? '').replace(/\r/g, '').split('\n').find((value) => value.length > 0);
  if (!line) return { ok: false, reason: `git submodule status não retornou ${sourcePath}` };
  const match = line.match(/^([ +\-U])([0-9a-fA-F]{40})\s+/);
  if (!match) return { ok: false, reason: `status Git inesperado para ${sourcePath}: ${line}` };
  return { ok: true, prefix: match[1], commit: match[2].toLowerCase(), line };
}

export function runSourcePreflight({
  root = process.cwd(),
  specs = DEFAULT_SOURCE_SPECS,
  lockPath = '.apois/source-lock.json',
  checkPins = true,
  gitStatusProvider = defaultGitStatusProvider,
  logger = console,
} = {}) {
  const errors = [];
  const warnings = [];
  const results = [];
  const rootGitMetadata = existsSync(resolve(root, '.git'));
  const gitmodulesPath = resolve(root, '.gitmodules');
  const gitmodules = existsSync(gitmodulesPath) ? readFileSync(gitmodulesPath, 'utf8') : '';

  let lock = null;
  if (checkPins) {
    const fullLockPath = resolve(root, lockPath);
    if (!existsSync(fullLockPath)) {
      addIssue(errors, logger, 'error', {
        key: 'source-lock',
        code: 'LOCK_MISSING',
        message: `${lockPath} ausente; pins não podem ser validados`,
      });
    } else {
      try {
        lock = JSON.parse(readFileSync(fullLockPath, 'utf8'));
      } catch {
        addIssue(errors, logger, 'error', {
          key: 'source-lock',
          code: 'LOCK_INVALID',
          message: `${lockPath} não contém JSON válido`,
        });
      }
    }
  }

  if (checkPins && rootGitMetadata && !gitmodules) {
    addIssue(errors, logger, 'error', {
      key: 'git-metadata',
      code: 'GITMODULES_MISSING',
      message: '.git existe, mas .gitmodules está ausente; estado dos submodules não é verificável',
    });
  }

  for (const spec of specs) {
    const sourceRoot = resolve(root, spec.path);
    const result = { key: spec.key, path: spec.path, source: 'unknown', pin: 'not-checked' };
    results.push(result);

    if (!existsSync(sourceRoot)) {
      result.source = 'missing';
      addIssue(errors, logger, 'error', {
        key: spec.key,
        code: 'SOURCE_MISSING',
        message: `source ausente: ${spec.path}. Inicialize/restaure as fontes antes da auditoria`,
      });
      continue;
    }

    let sourceStat;
    try {
      sourceStat = statSync(sourceRoot);
    } catch {
      result.source = 'unreadable';
      addIssue(errors, logger, 'error', {
        key: spec.key,
        code: 'SOURCE_UNREADABLE',
        message: `source não pôde ser lido: ${spec.path}`,
      });
      continue;
    }

    if (!sourceStat.isDirectory()) {
      result.source = 'invalid';
      addIssue(errors, logger, 'error', {
        key: spec.key,
        code: 'SOURCE_NOT_DIRECTORY',
        message: `source obrigatório não é diretório: ${spec.path}`,
      });
      continue;
    }

    if (!isNonEmptyDirectory(sourceRoot)) {
      result.source = 'empty';
      addIssue(errors, logger, 'error', {
        key: spec.key,
        code: 'SOURCE_EMPTY',
        message: `source vazio/não inicializado: ${spec.path}`,
      });
      continue;
    }

    const sentinelErrors = spec.sentinels
      .map((sentinel) => validateSentinel(sourceRoot, sentinel))
      .filter(Boolean);
    if (sentinelErrors.length) {
      result.source = 'incomplete';
      for (const message of sentinelErrors) {
        addIssue(errors, logger, 'error', {
          key: spec.key,
          code: 'SOURCE_INCOMPLETE',
          message: `source incompleto em ${spec.path}: ${message}`,
        });
      }
      continue;
    }

    result.source = 'complete';
    output(logger, 'log', `[OK] ${spec.key}: source completo (${spec.path})`);

    if (!checkPins || !lock) continue;
    const expected = lock.sources?.[spec.key]?.commit?.toLowerCase();
    if (!expected) {
      result.pin = 'missing-lock-pin';
      addIssue(errors, logger, 'error', {
        key: spec.key,
        code: 'PIN_MISSING',
        message: `commit fixado ausente em ${lockPath}`,
      });
      continue;
    }

    if (!rootGitMetadata) {
      result.pin = 'unverifiable-no-git-metadata';
      addIssue(warnings, logger, 'warn', {
        key: spec.key,
        code: 'PIN_UNVERIFIABLE_NO_GIT_METADATA',
        message: `pin não verificável: export/ZIP sem metadata .git; source está presente e passou os sentinelas`,
      });
      continue;
    }

    if (!gitmodules.includes(`path = ${spec.path}`)) {
      result.pin = 'unverifiable-not-declared';
      addIssue(errors, logger, 'error', {
        key: spec.key,
        code: 'SUBMODULE_DECLARATION_MISSING',
        message: `metadata Git disponível, mas ${spec.path} não está declarado em .gitmodules`,
      });
      continue;
    }

    let rawStatus;
    try {
      rawStatus = gitStatusProvider(root, spec.path);
    } catch (error) {
      result.pin = 'unverifiable-git-error';
      addIssue(errors, logger, 'error', {
        key: spec.key,
        code: 'PIN_UNVERIFIABLE_GIT_ERROR',
        message: `metadata Git disponível, mas o pin não pôde ser verificado: ${error?.message ?? 'erro Git'}`,
      });
      continue;
    }

    const parsed = parseSubmoduleStatus(rawStatus, spec.path);
    if (!parsed.ok) {
      result.pin = 'unverifiable-status';
      addIssue(errors, logger, 'error', {
        key: spec.key,
        code: 'PIN_STATUS_INVALID',
        message: parsed.reason,
      });
      continue;
    }

    if (parsed.prefix === '-') {
      result.pin = 'uninitialized';
      addIssue(errors, logger, 'error', {
        key: spec.key,
        code: 'SUBMODULE_UNINITIALIZED',
        message: `submodule Git não inicializado em ${spec.path}. Rode git submodule update --init --recursive`,
      });
      continue;
    }
    if (parsed.prefix === 'U') {
      result.pin = 'conflict';
      addIssue(errors, logger, 'error', {
        key: spec.key,
        code: 'SUBMODULE_CONFLICT',
        message: `submodule Git está em conflito em ${spec.path}`,
      });
      continue;
    }
    if (parsed.prefix === '+') {
      result.pin = 'gitlink-diverged';
      addIssue(errors, logger, 'error', {
        key: spec.key,
        code: 'SUBMODULE_GITLINK_DIVERGED',
        message: `submodule inicializado, mas checkout diverge do gitlink do repositório raiz: ${parsed.commit}`,
      });
      continue;
    }
    if (parsed.commit !== expected) {
      result.pin = 'mismatch';
      addIssue(errors, logger, 'error', {
        key: spec.key,
        code: 'PIN_MISMATCH',
        message: `commit incorreto: ${parsed.commit} != ${expected}`,
      });
      continue;
    }

    result.pin = 'verified';
    output(logger, 'log', `[OK] ${spec.key}: pin verificado ${parsed.commit}`);
  }

  return {
    ok: errors.length === 0,
    rootGitMetadata,
    errors,
    warnings,
    results,
  };
}
