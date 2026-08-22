import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
const workspace = process.env.APOIS_ENTREGAS_WORKSPACE || '.work/partner-entregador';
const routePath = resolve(root, workspace, 'src/routes/courier.tsx');
const panelsPath = resolve(root, workspace, 'src/components/CourierPanels.tsx');

let route = readFileSync(routePath, 'utf8');
if (!route.includes('const switchPartnerProfile = async () => {')) {
  const anchor = `  const logout = async () => {\n`;
  const start = route.indexOf(anchor);
  if (start < 0) throw new Error('[FAIL] Entregador Parceiro: função logout não encontrada para inserir troca segura');
  const nextFunction = route.indexOf('\n\n  const submitApplication', start);
  if (nextFunction < 0) throw new Error('[FAIL] Entregador Parceiro: fim do logout não encontrado');
  const handler = `\n\n  const switchPartnerProfile = async () => {\n    if (busy) {\n      toast.error(\"Aguarde a ação atual terminar antes de trocar de perfil.\");\n      return;\n    }\n    if (activeJob) {\n      toast.error(\"Conclua a entrega ativa antes de trocar de perfil.\");\n      return;\n    }\n    setBusy(\"profile-switch\");\n    try {\n      const { error } = await rpc(\"set_courier_online\", { _is_online: false });\n      if (error) throw error;\n      setAvailability((current: any) => current ? { ...current, is_online: false } : current);\n      setCurrentPosition(null);\n      window.location.replace(\"../../index.html\");\n    } catch (error: any) {\n      toast.error(error?.message || \"Não foi possível ficar offline para trocar de perfil.\");\n    } finally {\n      setBusy((current) => current === \"profile-switch\" ? null : current);\n    }\n  };`;
  route = route.slice(0, nextFunction) + handler + route.slice(nextFunction);
}

const profileInvocationAnchor = `          onLogout={() => void logout()}\n          onClose={() => setProfileOpen(false)}`;
if (route.includes(profileInvocationAnchor)) {
  route = route.replace(
    profileInvocationAnchor,
    `          onLogout={() => void logout()}\n          onSwitchProfile={() => void switchPartnerProfile()}\n          switchingProfile={busy === \"profile-switch\"}\n          onClose={() => setProfileOpen(false)}`,
  );
}
for (const marker of [
  'const switchPartnerProfile = async () => {',
  'Conclua a entrega ativa antes de trocar de perfil.',
  'rpc("set_courier_online", { _is_online: false })',
  'window.location.replace("../../index.html")',
  'onSwitchProfile={() => void switchPartnerProfile()}',
  'switchingProfile={busy === "profile-switch"}',
]) {
  if (!route.includes(marker)) throw new Error(`[FAIL] Entregador Parceiro: troca segura incompleta na rota (${marker})`);
}
writeFileSync(routePath, route, 'utf8');

let panels = readFileSync(panelsPath, 'utf8');
panels = panels.replace(
  `  onFinance,\n  onLogout,\n  onClose,`,
  `  onFinance,\n  onLogout,\n  onSwitchProfile,\n  switchingProfile,\n  onClose,`,
);
panels = panels.replace(
  `  onFinance: () => void;\n  onLogout: () => void;\n  onClose: () => void;`,
  `  onFinance: () => void;\n  onLogout: () => void;\n  onSwitchProfile: () => void;\n  switchingProfile: boolean;\n  onClose: () => void;`,
);
const unsafeButton = `        <button\n          type="button"\n          onClick={() => window.location.replace('../../index.html')}\n          className="w-full rounded-2xl border border-primary/25 bg-primary/10 p-4 font-black text-primary active:scale-[0.99]"\n        >\n          Trocar perfil de parceiro\n        </button>`;
const safeButton = `        <button\n          type="button"\n          onClick={onSwitchProfile}\n          disabled={switchingProfile}\n          aria-busy={switchingProfile}\n          className="w-full rounded-2xl border border-primary/25 bg-primary/10 p-4 font-black text-primary active:scale-[0.99] disabled:cursor-wait disabled:opacity-60"\n        >\n          {switchingProfile ? \"Ficando offline...\" : \"Trocar perfil de parceiro\"}\n        </button>`;
if (panels.includes(unsafeButton)) panels = panels.replace(unsafeButton, safeButton);

for (const marker of [
  'onSwitchProfile,',
  'switchingProfile,',
  'onSwitchProfile: () => void;',
  'switchingProfile: boolean;',
  'onClick={onSwitchProfile}',
  'disabled={switchingProfile}',
]) {
  if (!panels.includes(marker)) throw new Error(`[FAIL] Entregador Parceiro: troca segura incompleta no perfil (${marker})`);
}
if (panels.includes(`onClick={() => window.location.replace('../../index.html')}`)) {
  throw new Error('[FAIL] Entregador Parceiro: perfil ainda troca de módulo sem confirmar OFFLINE');
}
writeFileSync(panelsPath, panels, 'utf8');

console.log('[OK] Entregador Parceiro: troca para Motorista confirma OFFLINE no backend antes de sair do módulo e bloqueia a troca durante entrega/ação ativa.');
