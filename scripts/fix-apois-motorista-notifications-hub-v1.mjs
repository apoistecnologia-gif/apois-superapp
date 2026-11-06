// APOIS_DRIVER_NOTIFICATION_HUB_V1
// Unifica atalhos. Permissao push nativa permanece em Configuracoes,
// categorias/som/vibracao permanecem na tela funcional de Preferencias.
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
const file=resolve(process.env.APOIS_MOTORISTA_WORKSPACE||".work/partner-motorista","src/routes/motorista.configuracoes.tsx");
const source=readFileSync(file,"utf8");
if(source.includes("APOIS_DRIVER_NOTIFICATION_HUB_V1")) {
  console.log("[OK] notification hub already applied");
} else {
  const start=source.indexOf('              <SettingsSection icon={Bell} title="Notificações"');
  const next=source.indexOf('              <SettingsSection icon={Palette} title="Aplicativo">',start);
  if(start<0||next<start||next-start>2300)throw Error("[FAIL] notification block changed");
  const existing=source.slice(start,next);
  for(const marker of [
    'title="Notificações push"','title="Alertas de corrida"',
    'title="Som"','title="Vibração"','title="Central de notificações"'
  ])if(!existing.includes(marker))throw Error("[FAIL] missing notification control "+marker);
  const merged=[
    '              {/* APOIS_DRIVER_NOTIFICATION_HUB_V1: no duplicate sound/vibration or categories */}',
    '              <SettingsSection icon={Bell} title="Notificações" description="Permissão do dispositivo e preferências detalhadas.">',
    '                <SettingsToggleRow icon={Bell} title="Notificações push neste aparelho" checked={prefs.push} onChange={(value) => value ? void handleEnablePush() : void handleDisablePush()} />',
    '                <SettingsLinkRow icon={Bell} title="Escolher alertas, som e vibração" hint="Tipos de aviso e preferências do seu aparelho" to="/motorista/preferencias-notificacoes" />',
    '                <SettingsLinkRow icon={Bell} title="Central de notificações" hint="Avisos e mensagens recebidos" to="/motorista/notificacoes" />',
    '              </SettingsSection>',
    ''
  ].join("\n");
  let nextSource=source.slice(0,start)+merged+source.slice(next);
  if((nextSource.match(/\bVibrate\b/g)||[]).length===1 && (nextSource.match(/\bVolume2\b/g)||[]).length===1) {
    nextSource=nextSource.replace("Vibrate, Volume2, ","");
  }
  writeFileSync(file,nextSource,"utf8");
  console.log("[OK] Driver notifications central is unique; native push toggle retained.");
}
