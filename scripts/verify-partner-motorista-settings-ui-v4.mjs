// V4 contract: no operations outside the isolated Motorista workspace.
import assert from "node:assert/strict";
import {existsSync, readFileSync} from "node:fs";
import {resolve} from "node:path";
const root=resolve(process.env.APOIS_MOTORISTA_WORKSPACE || ".work/partner-motorista");
const read=(name)=>readFileSync(resolve(root,"src",name),"utf8");
const settings=read("routes/motorista.configuracoes.tsx");
const side=read("components/DriverSideMenu.tsx");
const row=read("components/settings/SettingsRow.tsx");
const css=read("styles.css");
const header=read("components/MovviHeader.tsx");
const sections=read("components/settings/SettingsSection.tsx");
const hero=read("components/settings/SettingsPageShell.tsx");
for(const route of [
  "motorista.app.tsx","motorista.perfil.tsx","motorista.corridas.tsx",
  "motorista.suporte.tsx","motorista.seguranca.tsx","motorista.notificacoes.tsx",
  "motorista.configuracoes.tsx","motorista.privacidade.tsx",
]) assert.ok(existsSync(resolve(root,"src/routes",route)), "Driver settings/navigation lost route "+route);
for(const token of [
  "data-apois-driver-settings-contrast-v4",
  'onClick={() => void handleSave()}',
  'onChange={(event) => update("navigation_app"',
  'onClick={handleTestLocation}',
  'onClick={() => void handleEnablePush()}',
  'onChange={(value) => value ? void handleEnablePush() : void handleDisablePush()}',
  'onChange={(value) => update("ride_alerts", value)}',
  'onChange={(value) => update("sound", value)}',
  'onChange={(value) => update("vibration", value)}',
  'onClick={handleClearCache}',
  'to="/motorista/suporte"',
  'to="/motorista/privacidade"',
  'to="/motorista/perfil"',
  'onClick={() => void handleLogout("local")}',
  'onClick={() => void handleLogout("global")}',
  'role="dialog"',
  'aria-modal="true"',
  'setDeleteConfirmOpen(true)',
  'deletePhrase.trim() !== "EXCLUIR"',
  'rpc("request_own_account_deletion")',
  "data?.ok !== true",
]) assert.ok(settings.includes(token), "Settings V4 lost real action/confirmation: "+token);
assert.ok(!settings.includes("window.confirm(")&&!settings.includes("window.prompt("),
  "Native dialogs can trigger unexpected navigation; use explicit React modal");
assert.ok(!settings.includes('functions.invoke("delete-my-account"'),
  "Motorista cannot call undeployed legacy account deletion Edge Function");
const opened=settings.indexOf("function handleDeleteAccount()");
const requested=settings.indexOf('rpc("request_own_account_deletion")',opened);
const signedOut=settings.indexOf('await supabase.auth.signOut({ scope: "local" });',requested);
const navigated=settings.indexOf('await navigate({ to: "/motorista/login", replace: true });',signedOut);
assert.ok(opened!==-1&&requested>opened&&signedOut>requested&&navigated>signedOut,
  "Account deletion must never navigate to login before server confirmation");

assert.ok(row.includes('driver ? "text-[#111827]"'),"Settings text visible on white cards");
assert.ok(hero.includes('font-black leading-tight tracking-tight text-[#111827]"'),"Settings hero title visible");
assert.ok(sections.includes('text-[#475569]"'),"Settings group headings readable");
assert.ok(header.includes("pt-[max(28px,env(safe-area-inset-top))]"),"Native Android status bar safe-area");
assert.ok(css.includes("APOIS_MOTORISTA_SETTINGS_CONTRAST_V4"),"Settings scoped CSS missing");
assert.ok(css.includes("APOIS_MOTORISTA_MENU_OVERLAY_V4"),"Side menu scoped CSS missing");
assert.ok(side.includes('data-apois-driver-menu-fullscreen-v4'),"Side menu must obscure map on mobile");
assert.ok(side.includes('!w-[100vw] !max-w-none'),"Sidebar must fill mobile width");
assert.ok(side.includes("data-apois-driver-sidebar-tools-v1"),"Driver menu retained diagnostics and calls");
assert.ok(side.includes('to: "/motorista/app"'),"Map remains accessible");
assert.ok(side.includes('onClick={() => openOperationalTool("calls")}'),"Available calls still accessible");
assert.ok(side.includes('onClick={() => openOperationalTool("status")}'),"Diagnostics still accessible");
assert.ok(!css.includes("pointer-events:none !important;"),"UI must remain clickable");
console.log("[OK] Motorista V4: menu fullscreen, settings readable and interactive, deletion confirmation safe and old routes preserved.");
