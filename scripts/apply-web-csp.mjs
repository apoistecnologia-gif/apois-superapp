import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { serializeCsp } from './web-csp-policy.mjs';

const target = resolve(process.argv[2] || 'superapp/shell/dist');
if (!existsSync(target)) {
  console.error(`[FAIL] CSP target not found: ${target}`);
  process.exit(1);
}

function htmlFiles(directory) {
  const files = [];
  for (const entry of readdirSync(directory)) {
    const path = resolve(directory, entry);
    const stat = statSync(path);
    if (stat.isDirectory()) files.push(...htmlFiles(path));
    else if (entry.toLowerCase().endsWith('.html')) files.push(path);
  }
  return files;
}

function inlineScriptHashes(html) {
  const hashes = [];
  const re = /<script\b(?![^>]*\bsrc\s*=)[^>]*>([\s\S]*?)<\/script>/gi;
  for (const match of html.matchAll(re)) {
    const body = match[1];
    if (!body.trim()) continue;
    const digest = createHash('sha256').update(body, 'utf8').digest('base64');
    hashes.push(`'sha256-${digest}'`);
  }
  return [...new Set(hashes)];
}

function injectCsp(html, policy) {
  const meta = `<meta http-equiv="Content-Security-Policy" content="${policy.replaceAll('&', '&amp;').replaceAll('"', '&quot;')}" />`;
  const existing = /\s*<meta\s+http-equiv=["']Content-Security-Policy["'][^>]*>\s*/i;
  if (existing.test(html)) return html.replace(existing, `\n  ${meta}\n`);
  if (/<meta\s+charset=/i.test(html)) {
    return html.replace(/(<meta\s+charset=[^>]*>)/i, `$1\n  ${meta}`);
  }
  return html.replace(/<head>/i, `<head>\n  ${meta}`);
}

const files = htmlFiles(target);
if (files.length === 0) {
  console.error(`[FAIL] no HTML files found under ${target}`);
  process.exit(1);
}

for (const file of files) {
  const source = readFileSync(file, 'utf8');
  const hashes = inlineScriptHashes(source);
  const policy = serializeCsp(hashes);
  const hardened = injectCsp(source, policy);
  writeFileSync(file, hardened, 'utf8');
  console.log(`[OK] CSP applied: ${file} (${hashes.length} inline script hash(es))`);
}
