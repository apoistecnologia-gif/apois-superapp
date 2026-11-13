// APOIS_PARCEIRO_QA240_BRANDED_RETURN_BUBBLE_V1
// Install the approved, permission-guided return bubble into a DISPOSABLE Android
// workspace. Must run after QA236's existing notification and location-service hooks.
import {readFileSync,writeFileSync,copyFileSync,mkdirSync} from "node:fs";
import {resolve,dirname} from "node:path";
const root=resolve("superapp/partner-shell/android/app/src/main");
const dir=resolve(root,"java/br/com/apois/parceiro");
const activity=resolve(dir,"MainActivity.java");
const plugin=resolve(dir,"APOISExternalNavigationPlugin.java");
const manifest=resolve(root,"AndroidManifest.xml");
const logoSource=resolve("superapp/branding/apois-client-red-logo.b64");
const logoTarget=resolve(root,"res/drawable-nodpi/apois_return_logo.png");
function once(source,before,after,label){
 const count=source.split(before).length-1;
 if(count!==1)throw Error("[FAIL] QA240 "+label+" anchors="+count);
 return source.replace(before,after);
}
let main=readFileSync(activity,"utf8"),p=readFileSync(plugin,"utf8"),xml=readFileSync(manifest,"utf8");
if(!p.includes("APOIS_PARTNER_QA236_PICKUP_RETURN_V1")
   ||!p.includes("public void setOperation(PluginCall call)")
   ||!main.includes("registerPlugin(APOISExternalNavigationPlugin.class)"))
 throw Error("[FAIL] QA240 requires approved QA236 notification and external navigation.");
if(main.includes("APOISReturnBubble.")||p.includes("public void bubbleStatus("))
 throw Error("[FAIL] QA240 native installer already applied.");

const asset=Buffer.from(readFileSync(logoSource,"utf8").trim(),"base64");
if(asset.length<2000||asset.subarray(0,8).toString("hex")!=="89504e470d0a1a0a")
 throw Error("[FAIL] QA240 official APOIS logo is not a valid PNG.");
mkdirSync(dirname(logoTarget),{recursive:true});
writeFileSync(logoTarget,asset);
copyFileSync(resolve("scripts/android/APOISReturnBubble.java"),resolve(dir,"APOISReturnBubble.java"));

p=once(p,
 '        boolean active = Boolean.TRUE.equals(call.getBoolean("active"));',
 '        boolean active = Boolean.TRUE.equals(call.getBoolean("active"));\n'+
 '        APOISReturnBubble.active(getContext(),role,active);',
 "existing driver operation state");
p=once(p,'    private static final String GPS_STARTUP_PREFS',
 [
 '    // QA240: read OS permission, never promise that permission was granted.',
 '    @PluginMethod public void bubbleStatus(PluginCall call) {',
 '        JSObject data=new JSObject();',
 '        data.put("supported",android.os.Build.VERSION.SDK_INT>=android.os.Build.VERSION_CODES.M);',
 '        data.put("granted",APOISReturnBubble.granted(getContext()));',
 '        call.resolve(data);',
 '    }',
 '    @PluginMethod public void requestBubblePermission(PluginCall call) {',
 '        if(APOISReturnBubble.granted(getContext())) {',
 '            JSObject result=new JSObject();result.put("granted",true);call.resolve(result);return;',
 '        }',
 '        Activity current=getActivity();',
 '        if(current==null){call.reject("Tela do APOIS indisponível.");return;}',
 '        try {',
 '            Intent settings=new Intent(android.provider.Settings.ACTION_MANAGE_OVERLAY_PERMISSION);',
 '            // Android 11+ intentionally ignores package: data. The driver must',
 '            // choose APOIS Parceiro in the system page; only Android may grant.',
 '            if(android.os.Build.VERSION.SDK_INT<android.os.Build.VERSION_CODES.R)',
 '                settings.setData(Uri.parse("package:"+getContext().getPackageName()));',
 '            current.startActivity(settings);',
 '            JSObject result=new JSObject();result.put("granted",false);call.resolve(result);',
 '        }catch(Exception error){call.reject("Não foi possível abrir as permissões do Android.",error);}',
 '    }',
 '    private static final String GPS_STARTUP_PREFS'
 ].join("\n"),"native permission bridge");

p=once(p,'                JSObject response = new JSObject();',
 '                APOISReturnBubble.externalNavigationLaunched();\n'+
 '                JSObject response = new JSObject();',
 "track only actual launched external navigation");
p=once(p,'                call.reject("Não foi possível abrir a navegação externa. Confira os aplicativos instalados.", error);',
 '                APOISReturnBubble.externalNavigationClosed();\n'+
 '                call.reject("Não foi possível abrir a navegação externa. Confira os aplicativos instalados.", error);',
 "disable overlay on navigation failure");

const end=main.lastIndexOf("}");
if(end<0)throw Error("[FAIL] QA240 MainActivity end not found");
main=main.slice(0,end)+
 '    // QA240: the driver bubble is shown only after a real external navigator launch.\n'+
 '    @Override public void onPause(){super.onPause();APOISReturnBubble.show(getApplicationContext());}\n'+
 '    @Override public void onResume(){super.onResume();APOISReturnBubble.externalNavigationClosed();}\n'+
 main.slice(end);

if(!xml.includes('android.permission.SYSTEM_ALERT_WINDOW')){
 const manifestStart=xml.indexOf("<manifest");
 const tag=xml.indexOf(">",manifestStart);
 if(manifestStart<0||tag<manifestStart)throw Error("[FAIL] QA240 invalid AndroidManifest.xml");
 xml=xml.slice(0,tag+1)+'\n    <uses-permission android:name="android.permission.SYSTEM_ALERT_WINDOW" />'+xml.slice(tag+1);
}
for(const s of ["APOISReturnBubble.show","APOISReturnBubble.externalNavigationClosed","registerPlugin(APOISExternalNavigationPlugin.class)"]){
 if(!main.includes(s))throw Error("[FAIL] QA240 MainActivity lost "+s);
}
for(const s of ["bubbleStatus(","requestBubblePermission(","externalNavigationLaunched()","APOISReturnBubble.active(","sendBroadcast(update)"]){
 if(!p.includes(s))throw Error("[FAIL] QA240 plugin lost "+s);
}
writeFileSync(activity,main,"utf8");writeFileSync(plugin,p,"utf8");writeFileSync(manifest,xml,"utf8");
console.log("[OK] QA240: official APOIS PNG bubble, OS permission checked, deep-link return, QA236 GPS preserved.");
