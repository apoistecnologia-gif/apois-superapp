import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
const workspace = process.env.APOIS_MOTORISTA_WORKSPACE || '.work/partner-motorista';
const path = resolve(root, workspace, 'src/routes/motorista.configuracoes.tsx');
let source = readFileSync(path, 'utf8');

source = source.replace('  Bell, Info, KeyRound, Languages, LifeBuoy, Loader2,\n', '  Bell, Info, LifeBuoy, Loader2,\n');
source = source.replace('  LockKeyhole, LogOut, MapPin, Moon, Navigation, Palette,\n', '  LogOut, MapPin, Moon, Navigation, Palette,\n');
source = source.replace('  Save, Settings as SettingsIcon, Shield, ShieldCheck, Smartphone,\n', '  Save, Settings as SettingsIcon, ShieldCheck, Smartphone,\n');
source = source.replace('  Sun, Trash2, User, Vibrate, Volume2, FileText, Fingerprint,\n', '  Sun, Trash2, User, Vibrate, Volume2, FileText,\n');

source = source.replace(
  '<SettingsLinkRow icon={KeyRound} title="Alterar senha" to="/motorista/seguranca" />',
  '<SettingsLinkRow icon={ShieldCheck} title="Segurança e emergência" hint="SOS e contatos de emergência" to="/motorista/seguranca" />',
);

for (const row of [
  '                <SettingsLinkRow icon={Shield} title="Sessões ativas" hint="Em breve" onClick={() => toast.message("Sessões ativas em breve.")} />\n',
  '                <SettingsLinkRow icon={Fingerprint} title="Autenticação biométrica" hint="Em breve" onClick={() => toast.message("Biometria em breve.")} />\n',
  '                <SettingsLinkRow icon={LockKeyhole} title="Bloqueio por PIN" hint="Em breve" onClick={() => toast.message("PIN em breve.")} />\n',
]) {
  source = source.replace(row, '');
}

const languageBlock = `                <SettingsRow\n                  icon={Languages}\n                  title="Idioma"\n                  hint="Preferência local de interface"\n                  right={\n                    <select\n                      value={prefs.language}\n                      onChange={(event) => update("language", event.target.value as DriverPrefs["language"])}\n                      aria-label="Idioma preferido"\n                      className="min-h-11 rounded-xl border border-white/8 bg-[#111315] px-3 text-sm font-semibold text-white outline-none focus-visible:border-[#F6BE1C]/55 focus-visible:ring-2 focus-visible:ring-[#F6BE1C]/40"\n                    >\n                      <option value="pt">Português</option>\n                      <option value="en">English</option>\n                      <option value="es">Español</option>\n                    </select>\n                  }\n                />\n`;
source = source.replace(languageBlock, '');

// Limpar cache nunca pode apagar os marcadores que representam presença operacional.
// Se apois:driver:online ou a trava do host fossem removidos enquanto o backend ainda
// estivesse ONLINE, um reload poderia abrir o seletor/mostrar OFFLINE localmente e
// deixar o motorista disponível no servidor sem perceber.
const oldCacheFilter = `      const keys = Object.keys(localStorage).filter((key) =>\n        (key.startsWith("movvi:") || key.startsWith("apois:")) && !key.includes(":prefs:"),\n      );`;
const safeCacheFilter = `      const protectedOperationalKeys = new Set([\n        "apois:driver:online",\n        "apois-parceiro:operational-role",\n      ]);\n      const keys = Object.keys(localStorage).filter((key) =>\n        (key.startsWith("movvi:") || key.startsWith("apois:")) &&\n        !key.includes(":prefs:") &&\n        !protectedOperationalKeys.has(key),\n      );`;
if (source.includes(oldCacheFilter)) source = source.replace(oldCacheFilter, safeCacheFilter);

for (const forbidden of [
  'title="Alterar senha" to="/motorista/seguranca"',
  'Sessões ativas em breve.',
  'Biometria em breve.',
  'PIN em breve.',
  'aria-label="Idioma preferido"',
  'SettingsLinkRow icon={Shield} title="Sessões ativas"',
]) {
  if (source.includes(forbidden)) throw new Error(`[FAIL] Motorista Parceiro: configuração incompleta permaneceu (${forbidden})`);
}

for (const marker of [
  'title="Segurança e emergência"',
  'Sair de todos os dispositivos',
  'const protectedOperationalKeys = new Set([',
  '"apois:driver:online"',
  '"apois-parceiro:operational-role"',
  '!protectedOperationalKeys.has(key)',
]) {
  if (!source.includes(marker)) throw new Error(`[FAIL] Motorista Parceiro: configuração segura incompleta (${marker})`);
}

writeFileSync(path, source, 'utf8');
console.log('[OK] Motorista Parceiro: configurações removem recursos falsos, corrigem Segurança e limpar cache preserva presença/trava operacional.');
