import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { relative, resolve } from 'node:path';

const TEXT_EXT = /\.(?:ts|tsx|js|jsx|mjs|cjs)$/i;
const TOOLING_SEGMENTS = /(?:^|\/)(?:scripts?|tests?|test|docs?|migrations?|node_modules|dist|build|coverage|android|ios)(?:\/|$)/i;
const TOOLING_FILE = /(?:^|\/)(?:vite|vitest|eslint|tailwind|postcss|capacitor)\.config\./i;
const TEST_FILE = /\.(?:test|spec)\.[cm]?[jt]sx?$/i;
const FINANCIAL_RUNTIME_PATH = /(?:payment|refund|payout|webhook|charge|billing|subscription)/i;

const HARD_FAIL_PATTERNS = [
  { re: /\b(?:authorization|access[_-]?token|refresh[_-]?token|id[_-]?token|jwt)\b/i, reason: 'credential/token value referenced by console call' },
  { re: /\b(?:oauth[_-]?code|code[_-]?verifier|pkce(?:[_-]?verifier)?)\b/i, reason: 'OAuth/PKCE material referenced by console call' },
  { re: /\b(?:service[_-]?role(?:[_-]?key)?|private[_-]?key|firebase[_-]?private[_-]?key|webhook[_-]?secret|client[_-]?secret)\b/i, reason: 'server secret referenced by console call' },
  { re: /\b(?:mercado\s*[_-]?pago|mp)[A-Za-z0-9_$]*[_-]?(?:access[_-]?)?token\b/i, reason: 'Mercado Pago access token referenced by console call' },
  { re: /\b(?:mapsKey|apiKey|googleMapsKey)\b/, reason: 'API key value referenced by console call' },
  { re: /\b(?:latitude|longitude|lat|lng|coordinates?|coords|gps)\b/i, reason: 'precise location referenced by console call' },
  { re: /(?:await\s+)?[A-Za-z0-9_$\.]+\.text\(\)/, reason: 'raw HTTP response body referenced by console call' },
];

const WARNING_PATTERNS = [
  { re: /\b(?:payload|providerPayload|requestBody|responseBody|body)\b/, reason: 'raw payload/body may contain financial or personal data' },
  { re: /console\.(?:log|warn|error)\s*\(\s*(?:error|err|e)\s*\)/i, reason: 'raw Error object logged without redaction' },
  { re: /\b(?:email|phone|telefone|cpf|cnpj|fullName|nomeCompleto|address|endereco)\b/i, reason: 'personal data referenced by console call' },
];

export function classifyLoggingPath(path) {
  const normalized = path.replaceAll('\\', '/');
  if (TOOLING_SEGMENTS.test(normalized) || TOOLING_FILE.test(normalized) || TEST_FILE.test(normalized)) return 'tooling';
  return 'runtime';
}

function sourceFiles(root) {
  const files = [];
  if (!existsSync(root)) return files;
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    if (['node_modules', '.git', 'dist', 'build', '.output', 'coverage', 'android', 'ios'].includes(entry.name)) continue;
    const full = resolve(root, entry.name);
    if (entry.isDirectory()) files.push(...sourceFiles(full));
    else if (TEXT_EXT.test(entry.name)) files.push(full);
  }
  return files;
}

export function extractConsoleCalls(source) {
  const calls = [];
  const startRe = /console\.(log|warn|error)\s*\(/g;
  let match;
  while ((match = startRe.exec(source))) {
    const method = match[1];
    const start = match.index;
    let index = startRe.lastIndex;
    let depth = 1;
    let quote = null;
    let escaped = false;
    while (index < source.length && depth > 0) {
      const ch = source[index];
      if (quote) {
        if (escaped) escaped = false;
        else if (ch === '\\') escaped = true;
        else if (ch === quote) quote = null;
        index += 1;
        continue;
      }
      if (ch === '"' || ch === "'" || ch === '`') quote = ch;
      else if (ch === '(') depth += 1;
      else if (ch === ')') depth -= 1;
      index += 1;
    }
    const text = source.slice(start, index);
    const line = source.slice(0, start).split('\n').length;
    calls.push({ method, text, line });
    startRe.lastIndex = Math.max(index, startRe.lastIndex);
  }
  return calls;
}

function codeOnly(callText) {
  return callText
    .replace(/"(?:\\.|[^"\\])*"/g, '""')
    .replace(/'(?:\\.|[^'\\])*'/g, "''");
}

export function auditRuntimeLogging(root, options = {}) {
  const { label = root, failOnSensitive = true } = options;
  let runtimeCalls = 0;
  let toolingCalls = 0;
  const failures = [];
  const warnings = [];

  for (const file of sourceFiles(root)) {
    const path = relative(root, file).replaceAll('\\', '/');
    const kind = classifyLoggingPath(path);
    const source = readFileSync(file, 'utf8');
    const calls = extractConsoleCalls(source);
    if (kind === 'tooling') {
      toolingCalls += calls.length;
      continue;
    }
    runtimeCalls += calls.length;
    for (const call of calls) {
      const executable = codeOnly(call.text);
      for (const pattern of HARD_FAIL_PATTERNS) {
        if (pattern.re.test(executable)) failures.push({ path, line: call.line, method: call.method, reason: pattern.reason });
      }
      if (FINANCIAL_RUNTIME_PATH.test(path) && /\b(?:payload|providerPayload|requestBody|responseBody|body)\b/.test(executable)) {
        failures.push({ path, line: call.line, method: call.method, reason: 'full financial payload/body referenced by console call' });
      }
      for (const pattern of WARNING_PATTERNS) {
        if (pattern.re.test(executable)) warnings.push({ path, line: call.line, method: call.method, reason: pattern.reason });
      }
    }
  }

  console.log(`[LOG-AUDIT] ${label}: runtime console calls=${runtimeCalls}; tooling console calls=${toolingCalls}`);
  for (const warning of warnings) console.warn(`[LOG-WARN] ${label}/${warning.path}:${warning.line} ${warning.reason}`);
  for (const failure of failures) console.error(`[LOG-FAIL] ${label}/${failure.path}:${failure.line} ${failure.reason}`);
  if (failOnSensitive && failures.length) throw new Error(`${label}: ${failures.length} unsafe runtime log(s)`);
  return { runtimeCalls, toolingCalls, failures, warnings };
}

function replaceIfPresent(file, search, replacement) {
  if (!existsSync(file)) return false;
  const before = readFileSync(file, 'utf8');
  if (!before.includes(search)) return false;
  writeFileSync(file, before.replaceAll(search, replacement), 'utf8');
  return true;
}

export function hardenRuntimeLogging(root, moduleName = 'module') {
  const changes = [];
  const replacements = [
    {
      paths: ['supabase/functions/driver-ride-action/index.ts'],
      search: 'console.error("[driver-ride-action] push failed", response.status, await response.text());',
      replacement: 'console.error("[driver-ride-action] push failed", { status: response.status });',
    },
    {
      paths: ['supabase/functions/process-ride-dispatch/index.ts'],
      search: 'console.error("[process-ride-dispatch] push failed", response.status, await response.text());',
      replacement: 'console.error("[process-ride-dispatch] push failed", { status: response.status });',
    },
    {
      paths: ['supabase/functions/request-ride/index.ts'],
      search: 'console.error("[request-ride] push failed", response.status, await response.text());',
      replacement: 'console.error("[request-ride] push failed", { status: response.status });',
    },
    {
      paths: ['supabase/functions/request-ride/index.ts'],
      search: 'console.log("[request-ride] google key loaded", {\n    source: "GOOGLE_MAPS_PLATFORM_API_KEY",\n    length: mapsKey.length,\n    prefix: mapsKey.slice(0, 4),\n  });',
      replacement: 'console.log("[request-ride] google key configured", { source: "GOOGLE_MAPS_PLATFORM_API_KEY" });',
    },
    {
      paths: ['supabase/functions/customer-orders/index.ts'],
      search: 'console.error("customer-orders list failed", { code: error.code, userId: authData.user.id });',
      replacement: 'console.error("customer-orders list failed", { code: error.code });',
    },
  ];

  for (const rule of replacements) {
    for (const rel of rule.paths) {
      const file = resolve(root, rel);
      if (replaceIfPresent(file, rule.search, rule.replacement)) changes.push(rel);
    }
  }
  console.log(`[LOG-HARDEN] ${moduleName}: sanitized ${changes.length} known unsafe logging site(s)`);
  return changes;
}
