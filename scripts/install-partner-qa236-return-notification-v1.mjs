// APOIS_PARTNER_QA236_PICKUP_RETURN_V1
// This refines the EXISTING foreground location notification (same service and ID).
// Android will not permit forcing Waze/Google Maps to close or hijacking its Activity.
import {readFileSync,writeFileSync} from "node:fs";
import {resolve} from "node:path";
const dir=resolve("superapp/partner-shell/android/app/src/main/java/br/com/apois/parceiro");
const pluginPath=resolve(dir,"APOISExternalNavigationPlugin.java");
const servicePath=resolve(dir,"DriverLocationService.java");
let plugin=readFileSync(pluginPath,"utf8"),service=readFileSync(servicePath,"utf8");
function once(s,a,b,label){const n=s.split(a).length-1;if(n!==1)throw Error("[FAIL] QA236 native "+label+" anchors="+n);return s.replace(a,b);}
if(!service.includes("qa235SendArrival(")||!service.includes("APOIS_PARTNER_EXTERNAL_NAV_NOTIFICATION_V1"))
 throw Error("[FAIL] QA236 existing QA235 service missing");
if(plugin.includes("APOIS_PARTNER_QA236_PICKUP_RETURN_V1"))throw Error("[FAIL] QA236 native duplicate");
plugin=once(plugin,'        update.putExtra("operationActive", active);',
 '        update.putExtra("operationActive", active);\n'+
 '        // APOIS_PARTNER_QA236_PICKUP_RETURN_V1: only our private FGS observes ride phase.\n'+
 '        if ("motorista".equals(role)) update.putExtra("qa236RideStage", call.getString("stage", ""));',
 "native operation stage");
service=once(service,'    private volatile String qa235RideId = "";',
 '    // APOIS_PARTNER_QA236_PICKUP_RETURN_V1: one existing notification changes its action at pickup.\n'+
 '    private volatile boolean qa236PickupReady=false;\n'+
 '    private volatile String qa235RideId = "";',
 "arrival notification state");
service=once(service,
 '            String nextRide=apoisOperationActive ? intent.getStringExtra("qa235RideId") : null;',
 '            String stage=intent.getStringExtra("qa236RideStage");\n'+
 '            if(!apoisOperationActive || "em_viagem".equals(stage)) qa236PickupReady=false;\n'+
 '            String nextRide=apoisOperationActive ? intent.getStringExtra("qa235RideId") : null;',
 "clear arrival CTA once trip starts");
service=once(service,
 '                if(!nextRide.equals(qa235RideId)){qa235Fixes=0;qa235FirstAt=0;qa235Sending=false;}',
 '                if(!nextRide.equals(qa235RideId)){qa235Fixes=0;qa235FirstAt=0;qa235Sending=false;qa236PickupReady=false;}',
 "new ride clears old notification state");
service=once(service,
 '                qa235SendPush("ride.driver_arrived",rideId);',
 '                // The Android OS does not allow taking focus from Google Maps/Waze.\n'+
 '                // Update this same FGS notification with a one-tap return to APOIS.\n'+
 '                qa236PickupReady=true;\n'+
 '                NotificationManager manager=getSystemService(NotificationManager.class);\n'+
 '                if(manager!=null)manager.notify(NOTIFICATION_ID,buildNotification());\n'+
 '                qa235SendPush("ride.driver_arrived",rideId);',
 "native pickup return action after backend committed arrival");
service=once(service,
 '.setContentTitle(apoisOperationActive ? "APOIS — Corrida em andamento" : "APOIS Motorista online")',
 '.setContentTitle(qa236PickupReady ? "APOIS — Chegou ao embarque" : (apoisOperationActive ? "APOIS — Corrida em andamento" : "APOIS Motorista online"))',
 "pickup notification title");
service=once(service,
 '.setContentText(apoisOperationActive ? "Corrida em andamento. Volte ao APOIS para confirmar as etapas." : "Sua localização está sendo compartilhada enquanto você está online.")',
 '.setContentText(qa236PickupReady ? "Toque para voltar ao APOIS e iniciar corrida com PIN." : (apoisOperationActive ? "Corrida em andamento. Volte ao APOIS para confirmar as etapas." : "Sua localização está sendo compartilhada enquanto você está online."))',
 "pickup notification text");
service=once(service,
 '.addAction(R.drawable.ic_stat_apois_notification, "VOLTAR AO APOIS", pendingIntent)',
 '.addAction(R.drawable.ic_stat_apois_notification, qa236PickupReady ? "INICIAR CORRIDA • PIN" : "VOLTAR AO APOIS", pendingIntent)',
 "same existing notification return pending intent");
for(const required of [
 'qa236PickupReady=true',
 'manager.notify(NOTIFICATION_ID,buildNotification())',
 '"APOIS — Chegou ao embarque"',
 'qa236PickupReady ? "INICIAR CORRIDA • PIN"',
 '"em_viagem".equals(stage)',
 'pendingIntent',
 '/rest/v1/rpc/driver_mark_arrived',
 'qa235SendPush("ride.driver_arrived",rideId)']){
 if(!service.includes(required))throw Error("[FAIL] QA236 Android preserved "+required);
}
writeFileSync(pluginPath,plugin,"utf8");writeFileSync(servicePath,service,"utf8");
console.log("[OK] QA236: existing GPS foreground notification promotes PIN return on verified arrival; original MainActivity PendingIntent reused; no auto-close of external apps.");
