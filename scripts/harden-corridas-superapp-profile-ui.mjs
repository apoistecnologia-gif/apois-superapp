import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const path = resolve('.work/corridas/src/routes/_authenticated.perfil.tsx');
let source = readFileSync(path, 'utf8');

// Migração estritamente visual: preserva dados, ações, rotas e autenticação,
// mas impede que o Perfil volte ao tema preto/amarelo depois do hardener mobile.
source = source
  .replace(
    '  const currentProfile = normalizeProfile(profile, user?.email);',
    '  const currentProfile = normalizeProfile(profile, user?.email);\n  const profileAvatarUrl = currentProfile.avatarUrl ?? readNonEmptyString(user?.user_metadata?.avatar_url) ?? readNonEmptyString(user?.user_metadata?.picture);',
  )
  .replace(
    '<AvatarImage src={currentProfile.avatarUrl} />',
    '<AvatarImage src={profileAvatarUrl} />',
  )
  .replace('className="flex flex-col min-h-screen bg-black text-white pb-24"', 'className="flex min-h-screen flex-col bg-[#F7F7F8] pb-24 text-[#111111]"')
  .replace('className="flex min-h-0 flex-1 flex-col bg-black text-white"', 'className="flex min-h-0 flex-1 flex-col bg-[#F7F7F8] text-[#111111]"')
  .replace('className="p-6 pt-12 flex flex-col items-center border-b border-gray-900"', 'className="flex flex-col items-center border-b border-[#E2E4E8] bg-white px-6 pb-6 pt-[max(env(safe-area-inset-top),1.25rem)]"')
  .replace('border-2 border-yellow-500 p-1', 'border-2 border-[#E51B23] p-1')
  .replace('bg-gray-800 text-yellow-500 text-3xl font-bold', 'bg-[#FFF1F2] text-[#E51B23] text-3xl font-bold')
  .replace('className="text-gray-400 text-sm"', 'className="text-sm text-[#666B73]"')
  .replace('className="flex items-center gap-4 mt-4 bg-[#121212] px-4 py-2 rounded-full"', 'className="mt-4 flex items-center gap-4 rounded-full border border-[#E2E4E8] bg-white px-4 py-2 shadow-sm"')
  .replace('className="flex items-center gap-1 text-yellow-500"', 'className="flex items-center gap-1 text-[#E51B23]"')
  .replaceAll('className="text-sm font-bold text-white"', 'className="text-sm font-bold text-[#111111]"')
  .replace('className="w-px h-4 bg-gray-800"', 'className="h-4 w-px bg-[#E2E4E8]"')
  .replaceAll('bg-[#121212]', 'bg-white')
  .replaceAll('hover:bg-[#1a1a1a]', 'hover:bg-[#FFF7F7]')
  .replaceAll('text-yellow-500', 'text-[#E51B23]')
  .replaceAll('group-hover:text-yellow-500', 'group-hover:text-[#C9141B]')
  .replaceAll('text-gray-700', 'text-[#8A9098]')
  .replaceAll('text-gray-500', 'text-[#666B73]')
  .replaceAll('rounded-xl', 'rounded-2xl')
  .replace('className="w-full flex items-center justify-between p-4', 'className="w-full min-h-[68px] flex items-center justify-between p-4')
  .replace('className="text-xs font-bold text-gray-500 px-2 pt-4 pb-2 uppercase tracking-wider"', 'className="px-2 pb-2 pt-4 text-[11px] font-black uppercase tracking-[0.16em] text-[#666B73]"')
  .replace('className="text-xs font-bold text-gray-500 px-2 pt-6 pb-2 uppercase tracking-wider"', 'className="px-2 pb-2 pt-6 text-[11px] font-black uppercase tracking-[0.16em] text-[#666B73]"')
  .replace('className="text-center text-gray-600 text-xs mt-8"', 'className="mt-8 text-center text-xs text-[#8A9098]"');

if (!source.includes('profileAvatarUrl') || !source.includes('user?.user_metadata?.picture')) {
  throw new Error('[FAIL] Corridas: Perfil perdeu fallback da foto do usuário autenticado');
}
if (!source.includes('min-h-[68px]')) throw new Error('[FAIL] Corridas: Perfil sem alvos de toque adequados');
if (!source.includes('env(safe-area-inset-top)')) throw new Error('[FAIL] Corridas: Perfil sem safe area superior');
// QA216: the branded round photo moved to a dedicated component. Verify the
// actual red border there, rather than requiring an obsolete Avatar class in
// the profile route. All other visual/interaction assertions remain enforced.
const generatedPhoto = resolve('.work/corridas/src/components/profile/PassengerProfilePhoto.tsx');
const photoBrandRingVerified =
  source.includes('APOIS_PASSENGER_PROFILE_QA216_V1') &&
  existsSync(generatedPhoto) &&
  readFileSync(generatedPhoto, 'utf8').includes('rounded-full border-2 border-[#E51B23]');
if (
  !source.includes('bg-[#F7F7F8]') ||
  !source.includes('text-[#111111]') ||
  (!source.includes('border-[#E51B23]') && !photoBrandRingVerified)
) {
  throw new Error('[FAIL] Corridas: Perfil não recebeu a identidade vermelho/branco');
}
if (source.includes('PassengerProfileCenter')) throw new Error('[FAIL] Corridas: Perfil obsoleto reapareceu');

writeFileSync(path, source, 'utf8');
console.log('[OK] Corridas: Perfil usa identidade APOIS vermelho/branco sem alterar comportamento.');

await import('./harden-corridas-profile-actions.mjs');
await import('./harden-corridas-password-recovery.mjs');
