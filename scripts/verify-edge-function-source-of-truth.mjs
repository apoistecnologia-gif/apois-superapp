import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { resolve, relative } from 'node:path';

const root = process.cwd();
const manifestPath = resolve(root, 'docs/edge-function-source-of-truth.json');
const checkGenerated = process.argv.includes('--check-generated');
let failed = false;

function fail(message) { failed = true; console.error(`[FAIL] ${message}`); }
function ok(message) { console.log(`[OK] ${message}`); }
function warn(message) { console.warn(`[WARN] ${message}`); }

if (!existsSync(manifestPath)) {
  console.error('[FAIL] docs/edge-function-source-of-truth.json ausente');
  process.exit(1);
}

const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
const roots = new Map((manifest.roots ?? []).map((entry) => [entry.id, entry]));

for (const entry of roots.values()) {
  for (const field of ['id', 'path', 'projectRef', 'owner', 'purpose', 'pipeline']) {
    if (!entry[field]) fail(`root ${entry.id ?? '<sem-id>'}: campo obrigatório ${field} ausente`);
  }
  if (!existsSync(resolve(root, entry.path))) fail(`root ${entry.id}: caminho ausente ${entry.path}`);
}

function normalizedBytes(path) {
  return readFileSync(path, 'utf8').replace(/\r\n/g, '\n');
}

function hashTree(path) {
  const absolute = resolve(root, path);
  if (!existsSync(absolute)) return null;
  const files = [];
  const visit = (current) => {
    for (const entry of readdirSync(current, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      const target = resolve(current, entry.name);
      if (entry.isDirectory()) visit(target);
      else if (entry.isFile()) files.push(target);
    }
  };
  if (statSync(absolute).isDirectory()) visit(absolute);
  else files.push(absolute);
  const hash = createHash('sha256');
  for (const file of files) {
    hash.update(relative(absolute, file).replaceAll('\\', '/'));
    hash.update('\0');
    hash.update(normalizedBytes(file));
    hash.update('\0');
  }
  return hash.digest('hex');
}

function inventoryRoot(entry) {
  const base = resolve(root, entry.path);
  const units = new Map();
  for (const child of readdirSync(base, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
    if (!child.isDirectory()) continue;
    const childPath = resolve(base, child.name);
    if (child.name === '_shared') {
      const stack = [childPath];
      while (stack.length) {
        const current = stack.pop();
        for (const nested of readdirSync(current, { withFileTypes: true })) {
          const target = resolve(current, nested.name);
          if (nested.isDirectory()) stack.push(target);
          else if (nested.isFile()) {
            const rel = relative(base, target).replaceAll('\\', '/');
            units.set(rel, hashTree(relative(root, target)));
          }
        }
      }
    } else {
      units.set(child.name, hashTree(relative(root, childPath)));
    }
  }
  return units;
}

const inventories = new Map();
for (const entry of roots.values()) {
  if (existsSync(resolve(root, entry.path))) inventories.set(entry.id, inventoryRoot(entry));
}

const coveredSameProject = new Set();
for (const rule of manifest.sameProjectDuplicatePolicies ?? []) {
  const [leftId, rightId] = rule.roots ?? [];
  const left = roots.get(leftId);
  const right = roots.get(rightId);
  if (!left || !right) { fail(`regra de duplicidade referencia root inexistente: ${JSON.stringify(rule.roots)}`); continue; }
  if (left.projectRef !== right.projectRef) fail(`regra ${leftId}/${rightId} não é do mesmo projeto Supabase`);
  for (const field of ['relation', 'canonicalRoot', 'owner', 'purpose', 'pipeline']) {
    if (!rule[field]) fail(`regra ${leftId}/${rightId}: campo ${field} ausente`);
  }
  if (!roots.has(rule.canonicalRoot) && rule.canonicalRoot !== 'release-overlay') {
    fail(`regra ${leftId}/${rightId}: canonicalRoot desconhecido ${rule.canonicalRoot}`);
  }
  const leftInventory = inventories.get(leftId) ?? new Map();
  const rightInventory = inventories.get(rightId) ?? new Map();
  for (const path of rule.paths ?? []) {
    const key = [leftId, rightId].sort().join('|') + '::' + path;
    coveredSameProject.add(key);
    if (!leftInventory.has(path) || !rightInventory.has(path)) {
      fail(`duplicidade declarada não existe nos dois roots: ${path} (${leftId}/${rightId})`);
      continue;
    }
    const equal = leftInventory.get(path) === rightInventory.get(path);
    if (rule.relation === 'must-match' && !equal) fail(`${path}: cópias obrigatoriamente sincronizadas divergiram (${leftId}/${rightId})`);
    else if (rule.relation === 'must-match') ok(`${path}: paridade obrigatória confirmada (${leftId}/${rightId})`);
    else if (rule.relation === 'intentional-divergence') ok(`${path}: divergência classificada; canônico=${rule.canonicalRoot}`);
    else fail(`${path}: relation inválida ${rule.relation}`);
  }
}

const sameProjectRoots = [...roots.values()].filter((entry) => entry.projectRef && entry.projectRef !== 'release-overlay');
for (let i = 0; i < sameProjectRoots.length; i += 1) {
  for (let j = i + 1; j < sameProjectRoots.length; j += 1) {
    const left = sameProjectRoots[i];
    const right = sameProjectRoots[j];
    if (left.projectRef !== right.projectRef) continue;
    const leftInventory = inventories.get(left.id) ?? new Map();
    const rightInventory = inventories.get(right.id) ?? new Map();
    for (const path of leftInventory.keys()) {
      if (!rightInventory.has(path)) continue;
      const key = [left.id, right.id].sort().join('|') + '::' + path;
      if (!coveredSameProject.has(key)) fail(`duplicidade não classificada no mesmo projeto ${left.projectRef}: ${path} (${left.id}/${right.id})`);
    }
  }
}

for (const assignment of manifest.canonicalAssignments ?? []) {
  const entry = roots.get(assignment.canonicalRoot);
  if (!entry) { fail(`canonical assignment ${assignment.path}: root inexistente ${assignment.canonicalRoot}`); continue; }
  for (const field of ['path', 'domain', 'owner', 'purpose', 'pipeline']) {
    if (!assignment[field]) fail(`canonical assignment ${assignment.path ?? '<sem-path>'}: campo ${field} ausente`);
  }
  const units = inventories.get(entry.id) ?? new Map();
  if (!units.has(assignment.path)) fail(`canonical assignment ${assignment.path}: não existe em ${entry.id}`);
  else ok(`${assignment.path}: fonte canônica atual = ${entry.id}`);
}

for (const copy of manifest.generatedMustMatch ?? []) {
  const source = resolve(root, copy.source);
  const derived = resolve(root, copy.derived);
  if (!existsSync(source)) { fail(`generated parity: source ausente ${copy.source}`); continue; }
  if (!existsSync(derived)) {
    if (checkGenerated) fail(`generated parity: derivado ausente ${copy.derived}; execute prepare:modules antes`);
    else warn(`generated parity ignorada (workspace ainda não preparado): ${copy.derived}`);
    continue;
  }
  const sourceHash = hashTree(copy.source);
  const derivedHash = hashTree(copy.derived);
  if (sourceHash !== derivedHash) fail(`generated parity divergente: ${copy.source} != ${copy.derived}`);
  else ok(`generated parity: ${copy.source} == ${copy.derived}`);
}

if (failed) process.exit(1);
ok('Governança de source-of-truth das Edge Functions validada.');
