// APOIS_PARTNER_EXTERNAL_NAV_V1 — generated Capacitor Android host only.
// Run AFTER DriverLocation and CourierLocation installers. No new GPS service.
import {existsSync,readFileSync,writeFileSync,copyFileSync} from "node:fs";
import {resolve} from "node:path";

const root=resolve("superapp/partner-shell/android");
const javaRoot=resolve(root,"app/src/main/java/br/com/apois/parceiro");
const mainPath=resolve(javaRoot,"MainActivity.java");
const manifestPath=resolve(root,"app/src/main/AndroidManifest.xml");
const pluginSource=resolve("scripts/android/APOISExternalNavigationPlugin.java");
const pluginTarget=resolve(javaRoot,"APOISExternalNavigationPlugin.java");

function exactlyOnce(source,from,to,label){
 const count=source.split(from).length-1;
 if(count!==1)throw Error("[FAIL] ExternalNav "+label+" expected one anchor, got "+count);
 return source.replace(from,to);
}
for(const path of [mainPath,manifestPath,pluginSource]){
 if(!existsSync(path))throw Error("[FAIL] ExternalNav required generated file missing: "+path);
}
const plugin=readFileSync(pluginSource,"utf8");
for(const token of ["@CapacitorPlugin(name = \"APOISExternalNavigation\")",
 "public void open(PluginCall call)","public void setOperation(PluginCall call)",
 "com.google.android.apps.maps","com.waze","ACTION_VIEW",
 "sendBroadcast(update)","setPackage(getContext().getPackageName())"]){
 if(!plugin.includes(token))throw Error("[FAIL] ExternalNav native plugin "+token);
}
copyFileSync(pluginSource,pluginTarget);
let main=readFileSync(mainPath,"utf8");
if(main.includes("registerPlugin(APOISExternalNavigationPlugin.class)"))
 throw Error("[FAIL] ExternalNav native plugin registered twice");
main=exactlyOnce(main,
 "        registerPlugin(CourierLocationPlugin.class);",
 "        registerPlugin(CourierLocationPlugin.class);\n        registerPlugin(APOISExternalNavigationPlugin.class);",
 "MainActivity plugin registration");
writeFileSync(mainPath,main,"utf8");

let xml=readFileSync(manifestPath,"utf8");
if(!xml.includes("</queries>"))throw Error("[FAIL] ExternalNav Android package visibility queries absent");
for(const name of ["com.google.android.apps.maps","com.waze"]){
 if(!xml.includes('android:name="'+name+'"')){
  xml=exactlyOnce(xml,"</queries>",
   '    <package android:name="'+name+'" />\n    </queries>',
   "Android package visibility "+name);
 }
}
writeFileSync(manifestPath,xml,"utf8");

function patchService(file,role) {
 const path=resolve(javaRoot,file+"LocationService.java");
 if(!existsSync(path))throw Error("[FAIL] ExternalNav existing Location Service missing: "+file);
 let source=readFileSync(path,"utf8");
 if(source.includes("APOIS_PARTNER_EXTERNAL_NAV_NOTIFICATION_V1"))
  throw Error("[FAIL] ExternalNav already installed in "+file);
 const id=file==="Driver"?"DRIVER":"COURIER";
 const title=file==="Driver"?"Corrida em andamento":"Entrega em andamento";
 const oldTitle=file==="Driver"?'APOIS Motorista online':'APOIS Entregador online';
 const oldBody=file==="Driver"?
   'Sua localização está sendo compartilhada enquanto você está online.':
   'Sua localização está ativa enquanto você recebe ou realiza entregas.';
 const action="br.com.apois.parceiro.action.UPDATE_"+id+"_OPERATION";
 const classAnchor="public class "+file+"LocationService extends Service {";
 source=exactlyOnce(source,classAnchor,
  classAnchor+"\n    // APOIS_PARTNER_EXTERNAL_NAV_NOTIFICATION_V1 — same Foreground Service and notification ID.\n"+
  '    public static final String ACTION_UPDATE_OPERATION = "'+action+'";\n'+
  "    private boolean apoisOperationActive = false;\n",
  file+" class");
 // Existing service is already in foreground. Register a PRIVATE, non-exported
 // runtime receiver for status-only notification updates: no startService()
 // calls, no change to START_REDELIVER_INTENT or app-background semantics.
 source=exactlyOnce(source,"import android.content.Intent;",
  "import android.content.Intent;\nimport android.content.BroadcastReceiver;\nimport android.content.Context;\nimport android.content.IntentFilter;",
  file+" receiver imports");
 source=exactlyOnce(source,"import androidx.core.app.NotificationCompat;",
  "import androidx.core.app.NotificationCompat;\nimport androidx.core.content.ContextCompat;",
  file+" private receiver helper");
 source=exactlyOnce(source,"    private boolean apoisOperationActive = false;",
  [
    "    private boolean apoisOperationActive = false;",
    "    private final BroadcastReceiver apoisOperationReceiver = new BroadcastReceiver() {",
    "        @Override public void onReceive(Context context, Intent intent) {",
    "            if (intent == null || !ACTION_UPDATE_OPERATION.equals(intent.getAction())) return;",
    '            apoisOperationActive = intent.getBooleanExtra("operationActive", false);',
    "            NotificationManager manager = getSystemService(NotificationManager.class);",
    "            if (tracking && manager != null) manager.notify(NOTIFICATION_ID, buildNotification());",
    "        }",
    "    };"
  ].join("\n"),file+" receiver field");
 source=exactlyOnce(source,
  "        super.onCreate();",
  "        super.onCreate();\n"+
  "        ContextCompat.registerReceiver(this, apoisOperationReceiver, "+
  "new IntentFilter(ACTION_UPDATE_OPERATION), ContextCompat.RECEIVER_NOT_EXPORTED);",
  file+" register receiver only while service runs");
 source=exactlyOnce(source,"        super.onDestroy();",
  "        try { unregisterReceiver(apoisOperationReceiver); } catch (IllegalArgumentException ignored) {}\n"+
  "        super.onDestroy();",file+" receiver cleanup");
 source=exactlyOnce(source,
  '.setContentTitle("'+oldTitle+'")',
  '.setContentTitle(apoisOperationActive ? "APOIS — '+title+'" : "'+oldTitle+'")',
  file+" notification title");
 source=exactlyOnce(source,
  '.setContentText("'+oldBody+'")',
  '.setContentText(apoisOperationActive ? "'+title+'. Volte ao APOIS para confirmar as etapas." : "'+oldBody+'")',
  file+" notification text");
 source=exactlyOnce(source,
  ".setContentIntent(pendingIntent)",
  '.setContentIntent(pendingIntent)\n            .addAction(R.drawable.ic_stat_apois_notification, "VOLTAR AO APOIS", pendingIntent)',
  file+" notification action");
 const deepLink="br.com.apois.parceiro://module/"+role;
 for(const marker of [deepLink,"VOLTAR AO APOIS","ACTION_UPDATE_OPERATION","apoisOperationActive","buildNotification()"]){
  if(!source.includes(marker))throw Error("[FAIL] ExternalNav "+file+" missing "+marker);
 }
 writeFileSync(path,source,"utf8");
}
patchService("Driver","motorista");
patchService("Courier","entregador");
console.log("[OK] APOIS: shared external Maps/Waze native plugin; 2 existing GPS service notifications gain contextual 'VOLTAR AO APOIS' action without duplicate service.");
