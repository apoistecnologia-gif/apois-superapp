// APOIS_MOTORISTA_NAVIGATION_CANONICAL_V1
// Ajustes exclusivamente em .work/partner-motorista; sem APK/AAB ou deploy.
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
const root = resolve(process.env.APOIS_MOTORISTA_WORKSPACE || ".work/partner-motorista");
function one(s, before, after, label) {
  const count=s.split(before).length-1;
  if(count!==1) throw Error("[FAIL] driver navigation "+label+" count="+count);
  return s.replace(before,after);
}
function patch(file, edit, marker) {
  const p=resolve(root,file),src=readFileSync(p,"utf8");
  if(src.includes(marker)) {console.log("[OK] already applied "+file);return;}
  const out=edit(src);
  if(out===src||!out.includes(marker)) throw Error("[FAIL] driver navigation "+file);
  writeFileSync(p,out,"utf8");console.log("[OK] driver navigation "+file);
}
function dropUnusedIconImports(s,names) {
  for(const name of names) {
    if((s.match(new RegExp("\\b"+name+"\\b","g"))||[]).length===1) {
      s=s.replace("  "+name+",\n","");
      s=s.replace("  "+name+", ","  ");
      s=s.replace(", "+name+",",",");
    }
  }
  return s;
}
patch("src/components/DriverSideMenu.tsx",s=>{
  const dup=[
    '  {',
    '    to: "/motorista/perfil",',
    '    label: "Perfil",',
    '    description: "Conta, veículo e documentos",',
    '    icon: UserIcon,',
    '  },',
    ''
  ].join("\n");
  s=one(s,dup,"","profile already exists as clickable header");
  // Existing menu hardeners may have already rewritten descriptions.
  if(s.includes('label: "Carteira",\n    description: "Saldo e movimentações"')) {
    s=one(s,'label: "Carteira",\n    description: "Saldo e movimentações"',
      'label: "Carteira",\n    description: "Saldo e movimentações"',"wallet already meaningful");
  }
  if(s.includes('label: "Financeiro"')) {
    s=one(s,'label: "Financeiro"','label: "Ganhos"',"earnings clear label");
  }
  return one(s,"const NAV_LINKS = [",
    "// APOIS_MOTORISTA_NAVIGATION_CANONICAL_V1\nconst NAV_LINKS = [","side marker");
},"APOIS_MOTORISTA_NAVIGATION_CANONICAL_V1");

patch("src/routes/motorista.configuracoes.tsx",s=>{
  s=one(s,'ShieldCheck, Smartphone,','ShieldCheck, ShieldAlert,',"safety icon");
  const fn=[
    '  // APOIS_MOTORISTA_SETTINGS_CANONICAL_V1',
    '  function openPersonalDataEditor() {',
    '    try { window.sessionStorage.setItem("apois:motorista:profile:edit-intent","1"); }',
    '    catch { toast.message("No Perfil, escolha Informações pessoais para alterar a senha."); }',
    '    void navigate({ to: "/motorista/perfil" });',
    '  }',
    ''
  ].join("\n");
  s=one(s,'  function update<K extends keyof DriverPrefs>(key: K, value: DriverPrefs[K]) {',
    fn+'  function update<K extends keyof DriverPrefs>(key: K, value: DriverPrefs[K]) {',"edit profile action");
  s=one(s,
    '                <SettingsLinkRow icon={Smartphone} title="Telefone e e-mail" hint="Atualize seus contatos" to="/motorista/perfil" />\n',
    '',"duplicate profile data link");
  const oldSecurity=[
    '              <SettingsSection icon={ShieldCheck} title="Segurança">',
    '                <SettingsLinkRow icon={KeyRound} title="Alterar senha" to="/motorista/seguranca" />',
    '                <SettingsLinkRow icon={Shield} title="Sessões ativas" hint="Em breve" onClick={() => toast.message("Sessões ativas em breve.")} />',
    '                <SettingsLinkRow icon={Fingerprint} title="Autenticação biométrica" hint="Em breve" onClick={() => toast.message("Biometria em breve.")} />',
    '                <SettingsLinkRow icon={LockKeyhole} title="Bloqueio por PIN" hint="Em breve" onClick={() => toast.message("PIN em breve.")} />',
    '                <SettingsLinkRow icon={LogOut} title={signingOut ? "Encerrando sessões..." : "Sair de todos os dispositivos"} destructive onClick={() => void handleLogout("global")} />',
    '              </SettingsSection>'
  ].join("\n");
  const newSecurity=[
    '              <SettingsSection icon={ShieldCheck} title="Acesso e segurança">',
    '                <SettingsLinkRow icon={KeyRound} title="Alterar senha" hint="Abrir edição dos dados pessoais" onClick={openPersonalDataEditor} />',
    '                <SettingsLinkRow icon={ShieldAlert} title="Segurança da corrida e SOS" hint="Contatos de emergência e proteção" to="/motorista/seguranca" />',
    '                <SettingsLinkRow icon={LogOut} title={signingOut ? "Encerrando sessões..." : "Sair de todos os dispositivos"} destructive onClick={() => void handleLogout("global")} />',
    '              </SettingsSection>'
  ].join("\n");
  const passwordIndex=s.indexOf('title="Alterar senha"');
  const securityStart=s.lastIndexOf("<SettingsSection",passwordIndex);
  const securityClose=s.indexOf("</SettingsSection>",passwordIndex)+"</SettingsSection>".length;
  if(passwordIndex<0||securityStart<0||securityClose<=passwordIndex||
      !s.slice(securityStart,securityClose).includes("handleLogout"))
    throw Error("[FAIL] Driver security section/password/logout contract changed");
  const securityText=s.slice(securityStart,securityClose);
  const canonicalSecurity=newSecurity.join("\n");
  if(!canonicalSecurity.includes("openPersonalDataEditor") ||
     !canonicalSecurity.includes('to="/motorista/seguranca"'))
     throw Error("[FAIL] canonical password/SOS route");
  s=s.slice(0,securityStart)+canonicalSecurity+s.slice(securityClose);
  const oldSupport=[
    '              <SettingsSection icon={LifeBuoy} title="Suporte">',
    '                <SettingsLinkRow icon={LifeBuoy} title="Central de ajuda" to="/motorista/suporte" />',
    '                <SettingsLinkRow icon={LifeBuoy} title="Perguntas frequentes" to="/motorista/suporte" />',
    '                <SettingsLinkRow icon={LifeBuoy} title="Falar com o suporte" to="/motorista/suporte" />',
    '              </SettingsSection>'
  ].join("\n");
  const newSupport=[
    '              <SettingsSection icon={LifeBuoy} title="Suporte">',
    '                <SettingsLinkRow icon={LifeBuoy} title="Central de ajuda e atendimento" hint="Perguntas frequentes, chamados e contato" to="/motorista/suporte" />',
    '              </SettingsSection>'
  ].join("\n");
  const supportIndex=s.indexOf('title="Suporte"');
  const supportStart=s.lastIndexOf("<SettingsSection",supportIndex);
  const supportClose=s.indexOf("</SettingsSection>",supportIndex)+"</SettingsSection>".length;
  if(supportIndex<0||supportStart<0||supportClose<=supportIndex||
     !s.slice(supportStart,supportClose).includes('/motorista/suporte'))
    throw Error("[FAIL] Driver support section/link contract changed");
  s=s.slice(0,supportStart)+newSupport.join("\n")+s.slice(supportClose);
  return dropUnusedIconImports(s,["Fingerprint","LockKeyhole","Smartphone"]);
},"APOIS_MOTORISTA_SETTINGS_CANONICAL_V1");

patch("src/routes/motorista.perfil.tsx",s=>{
  s=one(s,'  Sparkles,\n  Star,','  Sparkles,\n  Settings,\n  Star,',"add settings icon");
  const effect=[
    '  // APOIS_MOTORISTA_PROFILE_CANONICAL_V1',
    '  useEffect(() => {',
    '    try {',
    '      if (window.sessionStorage.getItem("apois:motorista:profile:edit-intent") === "1") {',
    '        window.sessionStorage.removeItem("apois:motorista:profile:edit-intent");',
    '        setMode("edit");',
    '      }',
    '    } catch { /* keeps normal profile hub if storage is unavailable */ }',
    '  }, []);'
  ].join("\n");
  s=one(s,'  const requestRef = useRef(0);','  const requestRef = useRef(0);\n\n'+effect,"consume edit intent");
  const start=s.indexOf('              <MenuRow icon={Car} label="Veículo e documentos"');
  const next=s.indexOf('              <Divider />',start);
  const docStart=s.indexOf('              <MenuRow\n                icon={FileText}\n                label="Documentos"',next);
  const docEnd=s.indexOf('              />',docStart);
  if(start<0||next<start||docStart<next||docEnd<docStart||docEnd-start>1400)
    throw Error("[FAIL] driver profile document duplicate structure changed");
  const old=s.slice(start,docEnd+'              />'.length);
  if(!old.includes('to="/motorista/documentos"')||!old.includes('StatusPill')||
     !old.includes('label="Documentos"'))throw Error("[FAIL] document merge guard");
  const merged=[
    '              <MenuRow',
    '                icon={Car}',
    '                label="Veículo e documentos"',
    '                sub={vehicleModel ? vehicleModel + " · " + maskPlate(driver?.vehicle_plate) + " · CNH, CRLV e fotos" : "Veículo, CNH, CRLV, selfie e fotos"}',
    '                to="/motorista/documentos"',
    '                trailing={<StatusPill status={documentsApproved ? "accepted" : documentsRejected ? "cancelled" : "searching"} label={documentsApproved ? "Aprovados" : documentsRejected ? "Reenvio" : "Pendentes"} pulse={false} />}',
    '              />'
  ].join("\n");
  s=one(s,old,merged,"unify vehicle/documents");
  const preferences=[
    '              <MenuRow icon={LifeBuoy} label="Suporte" sub="Central de ajuda e contato" to="/motorista/suporte" />',
    '              <Divider />',
    '              <MenuRow icon={ShieldCheck} label="Privacidade e segurança" sub="Dados, permissões e conta" to="/motorista/privacidade" />'
  ].join("\n");
  s=one(s,preferences,
    '              <MenuRow icon={Settings} label="Configurações" sub="Segurança, privacidade, notificações e suporte" to="/motorista/configuracoes" />',
    "avoid misleading privacy/security label");
  return dropUnusedIconImports(s,["LifeBuoy","FileText"]);
},"APOIS_MOTORISTA_PROFILE_CANONICAL_V1");
console.log("[OK] Motorista: single settings, distinct SOS and password, no duplicate profile/document/support entries.");
