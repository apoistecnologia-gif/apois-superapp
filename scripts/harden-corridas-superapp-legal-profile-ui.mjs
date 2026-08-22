import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const path = resolve('.work/corridas/src/components/profile/PassengerProfileCenter.tsx');
let source = readFileSync(path, 'utf8');

const combined = `          <MenuButton\n            icon={Shield}\n            title="Termos e privacidade"\n            description="Regras do serviço e proteção dos seus dados"\n            onClick={() => void navigate({ to: "/termos" })}\n          />`;
const separate = `          <MenuButton\n            icon={Shield}\n            title="Termos de Uso"\n            description="Regras vigentes para utilizar a APOIS"\n            onClick={() => void navigate({ to: "/termos" })}\n          />\n          <MenuButton\n            icon={Shield}\n            title="Política de Privacidade"\n            description="Como seus dados são tratados e protegidos"\n            onClick={() => void navigate({ to: "/privacidade" })}\n          />`;

if (source.includes(combined)) source = source.replace(combined, separate);

for (const marker of [
  'title="Termos de Uso"',
  'navigate({ to: "/termos" })',
  'title="Política de Privacidade"',
  'navigate({ to: "/privacidade" })',
]) {
  if (!source.includes(marker)) throw new Error(`[FAIL] Passageiro: documento legal inacessível pelo Perfil (${marker})`);
}
if (source.includes('title="Termos e privacidade"')) {
  throw new Error('[FAIL] Passageiro: atalho legal combinado ainda esconde um dos documentos.');
}

writeFileSync(path, source, 'utf8');
console.log('[OK] Passageiro: Termos de Uso e Política de Privacidade ficam acessíveis separadamente no Perfil.');
