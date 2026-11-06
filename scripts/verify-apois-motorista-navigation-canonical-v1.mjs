// APOIS_DRIVER_NAVIGATION_GATES_V1 — static regression gates; NO APK/AAB.
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
const root=resolve(process.env.APOIS_MOTORISTA_WORKSPACE||".work/partner-motorista");
const get=(file)=>readFileSync(resolve(root,"src",file),"utf8");
const menu=get("components/DriverSideMenu.tsx");
const settings=get("routes/motorista.configuracoes.tsx");
const profile=get("routes/motorista.perfil.tsx");
const bottom=get("components/ApoisDriverBottomNav.tsx");
const form=get("components/profile/ProfileForm.tsx");
for(const marker of [
 "APOIS_MOTORISTA_NAVIGATION_CANONICAL_V1",
 "data-apois-driver-menu-fullscreen-v4",
 "data-apois-driver-sidebar-tools-v1",
]) assert.ok(menu.includes(marker),"menu lost "+marker);
assert.ok(!menu.includes('label: "Perfil"'),"side menu profile header must not have a duplicate entry");
assert.ok(menu.includes('to="/motorista/perfil"'),"profile header link preserved");
assert.ok(menu.includes('to: "/motorista/configuracoes"'),"single settings destination");
assert.ok(menu.includes('to: "/motorista/seguranca"'),"SOS must remain accessible");
assert.equal((settings.match(/to="\/motorista\/suporte"/g)||[]).length,1,"settings support destination must be unique");
assert.ok(settings.includes("APOIS_MOTORISTA_SETTINGS_CANONICAL_V1"));
assert.ok(settings.includes('title="Alterar senha" hint="Abrir edição dos dados pessoais" onClick={openPersonalDataEditor}'));
assert.ok(!settings.includes('title="Alterar senha" to="/motorista/seguranca"'),"password must never go to SOS");
assert.ok(settings.includes('title="Segurança da corrida e SOS"'));
assert.ok(!settings.includes('title="Sessões ativas"')&&!settings.includes('title="Autenticação biométrica"')&&!settings.includes('title="Bloqueio por PIN"'),"fake settings controls removed until implemented");
assert.ok(settings.includes('rpc("request_own_account_deletion")'),"account deletion RPC retained");
assert.ok(settings.includes('onClick={() => void handleSave()}'),"local preferences save retained");
assert.ok(profile.includes("APOIS_MOTORISTA_PROFILE_CANONICAL_V1"));
assert.equal((profile.match(/to="\/motorista\/documentos"/g)||[]).length,1,"document entry should be unique");
assert.ok(profile.includes('label="Configurações" sub="Segurança, privacidade, notificações e suporte"'));
assert.ok(!profile.includes('label="Privacidade e segurança"'),"privacy cannot impersonate SOS");
assert.ok(profile.includes('window.sessionStorage.removeItem("apois:motorista:profile:edit-intent")'),"edit intent must be one-shot");
assert.ok(form.includes('Nova senha')&&form.includes('onSave'),"real password form stays active");
for(const dest of ["app","corridas","carteira","notificacoes","perfil"])assert.ok(bottom.includes('to: "/motorista/'+dest+'"'),"bottom navigation must preserve "+dest);
assert.ok(bottom.includes("DriverActiveRideRecovery"),"active ride recovery must remain");
const candidates=[
 "components/DriverSideMenu.tsx","components/ApoisDriverBottomNav.tsx",
 "routes/motorista.configuracoes.tsx","routes/motorista.perfil.tsx"
];
const links=new Set();
for(const file of candidates){
 const src=get(file);
 for(const match of src.matchAll(/\bto(?:=|:\s*)["'](\/motorista\/[\w-]+)["']/g))links.add(match[1]);
}
for(const dest of links){
 const key=dest.slice(1).replaceAll("/",".");
 assert.ok(existsSync(resolve(root,"src/routes",key+".tsx")),"broken driver menu destination: "+dest);
}
const allRoutes=[
 "app","assinatura","cadastro","carteira","configuracoes","corridas",
 "corridas.$id","documentos","ganhos","login","notificacoes","perfil",
 "preferencias-notificacoes","privacidade","recuperar-senha","redefinir-senha",
 "regalias","seguranca","status","suporte","termos"
];
for(const route of allRoutes)assert.ok(existsSync(resolve(root,"src/routes","motorista."+route+".tsx")),"missing driver page "+route);
console.log("[OK] 21/21 Motorista route files + canonical navigation contracts; no app built.");
