import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  FORBIDDEN_FRONTEND_FINANCIAL_ORIGINS,
  REQUIRED_CSP_DIRECTIVES,
} from './web-csp-policy.mjs';

const target = resolve(process.argv[2] || 'superapp/shell/dist');
const capacitorConfig = process.argv[3] ? resolve(process.argv[3]) : null;
let failures = 0;

function fail(message) {
  failures += 1;
  console.error(`[FAIL] ${message}`);
}
function ok(message) {
  console.log(`[OK] ${message}`);
}
function filesRecursive(directory, predicate = () => true) {
  const files = [];
  for (const entry of readdirSync(directory)) {
    const path = resolve(directory, entry);
    const stat = statSync(path);
    if (stat.isDirectory()) files.push(...filesRecursive(path, predicate));
    else if (predicate(path)) files.push(path);
  }
  return files;
}
function parsePolicy(value) {
  const map = new Map();
  for (const segment of value.split(';')) {
    const trimmed = segment.trim();
    if (!trimmed) continue;
    const [name, ...values] = trimmed.split(/\s+/);
    map.set(name, values);
  }
  return map;
}
function inlineScriptHashes(html) {
  const hashes = [];
  const re = /<script\b(?![^>]*\bsrc\s*=)[^>]*>([\s\S]*?)<\/script>/gi;
  for (const match of html.matchAll(re)) {
    const body = match[1];
    if (!body.trim()) continue;
    hashes.push(`'sha256-${createHash('sha256').update(body, 'utf8').digest('base64')}'`);
  }
  return [...new Set(hashes)];
}

if (!existsSync(target)) {
  fail(`CSP target not found: ${target}`);
} else {
  const htmlFiles = filesRecursive(target, (file) => file.toLowerCase().endsWith('.html'));
  if (htmlFiles.length === 0) fail(`no HTML files found under ${target}`);

  for (const file of htmlFiles) {
    const html = readFileSync(file, 'utf8');
    const meta = html.match(/<meta\s+http-equiv=["']Content-Security-Policy["']\s+content=["']([^"']+)["'][^>]*>/i)
      ?? html.match(/<meta\s+content=["']([^"']+)["']\s+http-equiv=["']Content-Security-Policy["'][^>]*>/i);
    if (!meta) {
      fail(`${file}: missing CSP meta`);
      continue;
    }
    const policyText = meta[1].replaceAll('&quot;', '"').replaceAll('&amp;', '&');
    const policy = parsePolicy(policyText);
    if (policyText.includes("'unsafe-eval'")) fail(`${file}: unsafe-eval is forbidden`);
    if ((policy.get('script-src') ?? []).includes("'unsafe-inline'")) {
      fail(`${file}: script-src must use hashes instead of unsafe-inline`);
    }

    for (const [directive, requiredValues] of Object.entries(REQUIRED_CSP_DIRECTIVES)) {
      const values = policy.get(directive) ?? [];
      if (!policy.has(directive)) fail(`${file}: missing ${directive}`);
      for (const required of requiredValues) {
        if (!values.includes(required)) fail(`${file}: ${directive} missing ${required}`);
      }
    }

    const scriptValues = policy.get('script-src') ?? [];
    for (const hash of inlineScriptHashes(html)) {
      if (!scriptValues.includes(hash)) fail(`${file}: inline script hash missing from script-src`);
    }
    ok(`${file}: CSP present, no unsafe-eval, inline scripts hashed`);
  }

  const frontendText = filesRecursive(target, (file) => /\.(?:html|js|mjs|css|json)$/i.test(file))
    .map((file) => {
      try { return readFileSync(file, 'utf8'); } catch { return ''; }
    })
    .join('\n');
  for (const origin of FORBIDDEN_FRONTEND_FINANCIAL_ORIGINS) {
    if (frontendText.includes(origin)) fail(`financial provider origin leaked into frontend bundle: ${origin}`);
  }
  if (frontendText.includes('unsafe-eval')) fail('generated frontend contains unsafe-eval');
}

if (capacitorConfig) {
  if (!existsSync(capacitorConfig)) fail(`Capacitor config not found: ${capacitorConfig}`);
  else {
    const config = readFileSync(capacitorConfig, 'utf8');
    if (!/allowMixedContent\s*:\s*false/.test(config)) {
      fail(`${capacitorConfig}: android.allowMixedContent must remain false`);
    } else {
      ok(`${capacitorConfig}: mixed content disabled`);
    }
  }
}

if (failures > 0) {
  console.error(`[FAIL] CSP verification failed with ${failures} issue(s)`);
  process.exit(1);
}
console.log('[OK] APOIS web CSP verification passed');
