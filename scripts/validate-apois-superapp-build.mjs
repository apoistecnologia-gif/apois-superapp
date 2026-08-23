import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const root = resolve(process.cwd());
const expectedPackage = 'br.com.apois.superapp';
const androidRoot = join(root, 'superapp/shell/android');
const manifestPath = join(androidRoot, 'app/src/main/AndroidManifest.xml');
const gradlePath = join(androidRoot, 'app/build.gradle');
const launcherPath = join(root, 'superapp/branding/apois-launcher.png');
const failures = [];

for (const [label, path] of [
  ['Android platform', androidRoot],
  ['AndroidManifest.xml', manifestPath],
  ['app/build.gradle', gradlePath],
  ['APOIS launcher', launcherPath],
]) {
  if (!existsSync(path)) failures.push(`${label} ausente: ${path}`);
}

if (existsSync(manifestPath)) {
  const manifest = readFileSync(manifestPath, 'utf8');
  const packageMatch = manifest.match(/package="([^"]+)"/);
  if (!packageMatch || packageMatch[1] !== expectedPackage) {
    failures.push(`package do Manifest inválido: esperado ${expectedPackage}`);
  }
}

if (existsSync(gradlePath)) {
  const gradle = readFileSync(gradlePath, 'utf8');
  if (!gradle.includes(`applicationId '${expectedPackage}'`) && !gradle.includes(`applicationId "${expectedPackage}"`)) {
    failures.push(`applicationId inválido: esperado ${expectedPackage}`);
  }
}

if (failures.length) {
  console.error('[FAIL] Validação pré-build do APOIS SuperApp');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`[OK] Validação pré-build concluída: ${expectedPackage}`);
