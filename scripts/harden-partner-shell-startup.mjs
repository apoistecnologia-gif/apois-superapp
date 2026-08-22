import './harden-partner-shell-mobile-ui.mjs';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const path = resolve('superapp/partner-shell/index.html');
let source = readFileSync(path, 'utf8');

const oldBlock = `    const lockedOnLaunch=operationalRole();\n    if(lockedOnLaunch){\n      window.location.replace(operationalHome(lockedOnLaunch));\n    }else if(!consumePendingPartnerPush()){\n      const appPlugin=window.Capacitor?.Plugins?.App;\n      if(appPlugin){\n        appPlugin.addListener('appUrlOpen',({url})=>{relayDeepLink(url);}).catch(()=>undefined);\n        appPlugin.getLaunchUrl().then((result)=>{if(result?.url)relayDeepLink(result.url);}).catch(()=>undefined);\n      }\n      const pushPlugin=window.Capacitor?.Plugins?.PushNotifications;\n      if(pushPlugin){\n        pushPlugin.addListener('pushNotificationActionPerformed',(action)=>{\n          relayPartnerPush(action?.notification?.data||{});\n        }).catch(()=>undefined);\n      }\n    }`;

const previousSafeBlock = `    async function bootPartnerShell(){\n      const appPlugin=window.Capacitor?.Plugins?.App;\n      if(appPlugin){\n        appPlugin.addListener('appUrlOpen',({url})=>{relayDeepLink(url);}).catch(()=>undefined);\n      }\n      const pushPlugin=window.Capacitor?.Plugins?.PushNotifications;\n      if(pushPlugin){\n        pushPlugin.addListener('pushNotificationActionPerformed',(action)=>{\n          relayPartnerPush(action?.notification?.data||{});\n        }).catch(()=>undefined);\n      }\n\n      // Um callback que abriu o processo precisa ser consumido antes da trava\n      // operacional. Caso contrário um Motorista ONLINE perderia, por exemplo,\n      // o retorno OAuth do Mercado Pago porque o shell redirecionava para /app\n      // antes de consultar App.getLaunchUrl(). relayDeepLink continua aplicando\n      // a própria trava e bloqueia callbacks pertencentes à outra função.\n      if(appPlugin){\n        try{\n          const launch=await appPlugin.getLaunchUrl();\n          if(launch?.url&&relayDeepLink(launch.url))return;\n        }catch{}\n      }\n\n      const lockedOnLaunch=operationalRole();\n      if(lockedOnLaunch){\n        window.location.replace(operationalHome(lockedOnLaunch));\n        return;\n      }\n      consumePendingPartnerPush();\n    }\n\n    void bootPartnerShell();`;

const newBlock = `    async function bootPartnerShell(){\n      const appPlugin=window.Capacitor?.Plugins?.App;\n      if(appPlugin){\n        appPlugin.addListener('appUrlOpen',({url})=>{relayDeepLink(url);}).catch(()=>undefined);\n      }\n      const pushPlugin=window.Capacitor?.Plugins?.PushNotifications;\n      if(pushPlugin){\n        pushPlugin.addListener('pushNotificationActionPerformed',(action)=>{\n          relayPartnerPush(action?.notification?.data||{});\n        }).catch(()=>undefined);\n      }\n\n      // Callback de lançamento tem precedência. A própria relayDeepLink respeita\n      // a trava operacional e não atravessa Motorista/Entregador.\n      if(appPlugin){\n        try{\n          const launch=await appPlugin.getLaunchUrl();\n          if(launch?.url&&relayDeepLink(launch.url))return;\n        }catch{}\n      }\n\n      // Push encaminhado por um módulo também precisa ser consumido antes do\n      // redirect por lock. routeRole mantém a função operacional se o Push for\n      // da outra função, mas a entrada é removida agora para não reaparecer horas\n      // depois quando o parceiro finalmente ficar OFFLINE e voltar ao seletor.\n      if(consumePendingPartnerPush())return;\n\n      const lockedOnLaunch=operationalRole();\n      if(lockedOnLaunch){\n        window.location.replace(operationalHome(lockedOnLaunch));\n        return;\n      }\n    }\n\n    void bootPartnerShell();`;

if (source.includes(oldBlock)) source = source.replace(oldBlock, newBlock);
else if (source.includes(previousSafeBlock)) source = source.replace(previousSafeBlock, newBlock);

for (const marker of [
  'async function bootPartnerShell()',
  "appPlugin.addListener('appUrlOpen'",
  "pushPlugin.addListener('pushNotificationActionPerformed'",
  'const launch=await appPlugin.getLaunchUrl();',
  'if(launch?.url&&relayDeepLink(launch.url))return;',
  'if(consumePendingPartnerPush())return;',
  'const lockedOnLaunch=operationalRole();',
  'void bootPartnerShell();',
]) {
  if (!source.includes(marker)) throw new Error(`[FAIL] Shell Parceiro: bootstrap seguro incompleto (${marker})`);
}

const launchIndex = source.indexOf('const launch=await appPlugin.getLaunchUrl();');
const pendingIndex = source.indexOf('if(consumePendingPartnerPush())return;');
const lockIndex = source.indexOf('const lockedOnLaunch=operationalRole();');
if (!(launchIndex >= 0 && pendingIndex > launchIndex && lockIndex > pendingIndex)) {
  throw new Error('[FAIL] Shell Parceiro: ordem de lançamento precisa ser deep link -> push pendente -> trava operacional');
}
if (source.includes('if(lockedOnLaunch){\n      window.location.replace(operationalHome(lockedOnLaunch));\n    }else if(!consumePendingPartnerPush())')) {
  throw new Error('[FAIL] Shell Parceiro: bootstrap legado ainda descarta callbacks quando existe função operacional');
}

writeFileSync(path, source, 'utf8');
console.log('[OK] Shell Parceiro: deep link e Push pendente são consumidos antes do redirect operacional; Push cruzado não fica órfão para abrir a outra função depois.');
