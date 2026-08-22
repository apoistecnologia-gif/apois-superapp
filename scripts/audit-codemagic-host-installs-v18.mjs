import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';

let failed = false;
const fail = (message) => { console.error(`[FAIL] Codemagic host installs v18: ${message}`); failed = true; };
const ok = (message) => console.log(`[OK] Codemagic host installs v18: ${message}`);

function read(path) {
  const full = resolve(path);
  if (!existsSync(full)) { fail(`arquivo ausente: ${path}`); return ''; }
  return readFileSync(full, 'utf8');
}

function assertPinnedCapacitorPackage(path, label) {
  const raw = read(path);
  if (!raw) return;
  const pkg = JSON.parse(raw);
  const expected = {
    '@capacitor/android': '8.5.0',
    '@capacitor/core': '8.5.0',
    '@capacitor/app': '8.1.1',
    '@capacitor/browser': '8.0.0',
    '@capacitor/geolocation': '8.2.0',
    '@capacitor/push-notifications': '8.1.2',
    '@capacitor/splash-screen': '8.0.2',
    '@capacitor/status-bar': '8.0.3',
    '@capacitor/cli': '8.5.0',
  };
  for (const [name, version] of Object.entries(expected)) {
    const actual = pkg.dependencies?.[name] ?? pkg.devDependencies?.[name];
    if (actual !== version) fail(`${label}: ${name} precisa ficar exatamente em ${version}; encontrado ${actual ?? 'ausente'}`);
  }
  const allVersions = { ...(pkg.dependencies ?? {}), ...(pkg.devDependencies ?? {}) };
  for (const [name, version] of Object.entries(allVersions)) {
    if (name.startsWith('@capacitor/') && /^[~^*><=]/.test(String(version))) {
      fail(`${label}: dependência Capacitor usa faixa não determinística (${name}=${version})`);
    }
  }
  if (!failed) ok(`${label}: versões Capacitor diretas permanecem fixadas`);
}

function hasLockfile(directory) {
  if (!existsSync(resolve(directory))) return false;
  const names = new Set(readdirSync(resolve(directory)));
  return names.has('bun.lock') || names.has('bun.lockb');
}

for (const [directory, label] of [
  ['superapp/shell', 'shell Cliente'],
  ['superapp/partner-shell', 'shell Parceiro'],
]) {
  if (hasLockfile(directory)) fail(`${label}: lockfile apareceu; reveja a política antes de mudar o workflow`);
  else ok(`${label}: ausência de bun.lock confirmada, portanto o host não deve usar --frozen-lockfile`);
}

assertPinnedCapacitorPackage('superapp/shell/package.json', 'shell Cliente');
assertPinnedCapacitorPackage('superapp/partner-shell/package.json', 'shell Parceiro');

const codemagic = read('codemagic.yaml');
const workflows = [
  ['android-superapp-experimental', 'superapp/shell', 'O shell Cliente também não possui bun.lock próprio.'],
  ['android-partner-superapp', 'superapp/partner-shell', 'Este host não possui bun.lock próprio.'],
];
for (let i = 0; i < workflows.length; i += 1) {
  const [key, directory, explanatoryMarker] = workflows[i];
  const start = codemagic.indexOf(`  ${key}:`);
  if (start < 0) { fail(`workflow ${key} ausente`); continue; }
  const next = codemagic.indexOf('\n  android-', start + key.length + 3);
  const section = codemagic.slice(start, next > start ? next : codemagic.length);
  const cdMarker = `cd ${directory}`;
  if (!section.includes(cdMarker)) fail(`${key}: não entra em ${directory}`);
  if (!section.includes(explanatoryMarker)) fail(`${key}: ausência de lockfile não está documentada`);
  if (!section.includes(`${cdMarker}\n`)) fail(`${key}: etapa de host não encontrada`);
  if (!section.includes('\n          bun install\n          rm -rf android')) fail(`${key}: deve instalar dependências antes de recriar Android`);
  if (section.includes('bun install --frozen-lockfile')) fail(`${key}: --frozen-lockfile reapareceu no host sem lockfile`);
  else ok(`${key}: instalação do host é compatível com a ausência de lockfile`);
}

const modules = read('.apois/modules.json');
if (!modules.includes('"install": ["bun", "install", "--frozen-lockfile"]')) {
  fail('módulos protegidos deixaram de exigir os próprios lockfiles');
} else ok('módulos protegidos continuam com --frozen-lockfile onde há lockfiles versionados');

process.exit(failed ? 1 : 0);
