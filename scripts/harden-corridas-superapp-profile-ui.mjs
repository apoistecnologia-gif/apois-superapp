import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const path = resolve('.work/corridas/src/components/profile/PassengerProfileCenter.tsx');
let source = readFileSync(path, 'utf8');

source = source
  .replace('  CreditCard,\n', '')
  .replace('  WalletCards,\n', '')
  .replaceAll('className="app-pressable flex h-10 w-10 items-center justify-center rounded-2xl', 'className="app-pressable flex h-11 w-11 items-center justify-center rounded-2xl')
  .replaceAll('className="app-pressable flex h-9 w-9 items-center justify-center rounded-xl', 'className="app-pressable flex h-11 w-11 items-center justify-center rounded-xl')
  .replace('className="mt-1 truncate text-[11px] text-zinc-500"', 'className="mt-1 line-clamp-2 text-[11px] leading-4 text-zinc-500"')
  .replaceAll('max-h-[92dvh] w-[calc(100vw-24px)]', 'max-h-[calc(100dvh-max(env(safe-area-inset-top),1rem)-max(env(safe-area-inset-bottom),1rem))] w-[calc(100vw-24px)]');

for (const forbidden of [
  'title="Carteira e pagamentos"',
  'title="Central de notificações"',
  'MainHamburgerMenu',
]) {
  if (source.includes(forbidden)) throw new Error(`[FAIL] Passageiro: navegação duplicada permaneceu no Perfil (${forbidden})`);
}
for (const marker of [
  'title="Termos e privacidade"',
  'Suporte e informações',
  'h-11 w-11',
  'line-clamp-2 text-[11px] leading-4',
  'max-h-[calc(100dvh-max(env(safe-area-inset-top),1rem)-max(env(safe-area-inset-bottom),1rem))]',
]) {
  if (!source.includes(marker)) throw new Error(`[FAIL] Passageiro: hardening visual do Perfil incompleto (${marker})`);
}

writeFileSync(path, source, 'utf8');
console.log('[OK] Passageiro: Perfil sem atalhos duplicados, botões tocáveis e diálogos adaptados à viewport móvel.');
