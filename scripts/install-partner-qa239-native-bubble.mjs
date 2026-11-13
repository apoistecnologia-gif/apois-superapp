// QA239 native opt-in overlay applied to generated host AFTER QA236.
import {readFileSync,writeFileSync,copyFileSync} from "node:fs";
import {resolve} from "node:path";
const root=resolve("superapp/partner-shell/android/app/src/main");
const dir=resolve(root,"java/br/com/apois/parceiro");
const activity=resolve(dir,"MainActivity.java"), plugin=resolve(dir,"APOISExternalNavigationPlugin.java"),manifest=resolve(root,"AndroidManifest.xml");
function one(s,a,b,label){const n=s.split(a).length-1;if(n!==1)throw Error("[QA239] "+label+" anchor "+n);return s.replace(a,b);}
let a=readFileSync(activity,"utf8"),p=readFileSync(plugin,"utf8"),m=readFileSync(manifest,"utf8");
if(!p.includes("APOIS_PARTNER_QA236_PICKUP_RETURN_V1"))throw Error("[QA239] QA236 prerequisite");
p=one(p,'        boolean active = Boolean.TRUE.equals(call.getBoolean("active"));',
 '        boolean active = Boolean.TRUE.equals(call.getBoolean("active"));\n'+
 '        if ("motorista".equals(role)) APOISReturnBubble.active(getContext(),active);',
 "ride activity");
p=one(p,'    private static final String GPS_STARTUP_PREFS',
 [
 '    // QA239: explicit optional overlay permission; no service creation.',
 '    @PluginMethod public void bubbleStatus(PluginCall call) {',
 '        JSObject data=new JSObject();',
 '        data.put("enabled",APOISReturnBubble.enabled(getContext()));',
 '        data.put("granted",APOISReturnBubble.granted(getContext()));',
 '        call.resolve(data);',
 '    }',
 '    @PluginMethod public void configureBubble(PluginCall call) {',
 '        boolean enabled=Boolean.TRUE.equals(call.getBoolean("enabled"));',
 '        APOISReturnBubble.configure(getContext(),enabled);',
 '        boolean granted=APOISReturnBubble.granted(getContext());',
 '        JSObject data=new JSObject();data.put("enabled",enabled);data.put("granted",granted);',
 '        if(enabled&&!granted&&getActivity()!=null){',
 '            Intent settings=new Intent(android.provider.Settings.ACTION_MANAGE_OVERLAY_PERMISSION,',
 '                Uri.parse("package:"+getContext().getPackageName()));',
 '            getActivity().startActivity(settings);',
 '        }',
 '        call.resolve(data);',
 '    }',
 '    private static final String GPS_STARTUP_PREFS'
 ].join("\n"),"bridge");
const end=a.lastIndexOf("}");
if(end<0||a.includes("APOISReturnBubble."))throw Error("[QA239] MainActivity anchor");
a=a.slice(0,end)+
 '    // QA239: only display while the app is backgrounded; hide on return.\n'+
 '    @Override protected void onPause(){super.onPause();APOISReturnBubble.show(getApplicationContext());}\n'+
 '    @Override protected void onResume(){super.onResume();APOISReturnBubble.hide();}\n'+
 a.slice(end);
if(!m.includes("android.permission.SYSTEM_ALERT_WINDOW")){
 const tag=m.indexOf(">");
 if(tag<0)throw Error("[QA239] manifest tag missing");
 m=m.slice(0,tag+1)+'\n<uses-permission android:name="android.permission.SYSTEM_ALERT_WINDOW" />'+m.slice(tag+1);
}
copyFileSync(resolve("scripts/android/APOISReturnBubble.java"),resolve(dir,"APOISReturnBubble.java"));
writeFileSync(activity,a);writeFileSync(plugin,p);writeFileSync(manifest,m);
console.log("[OK] QA239 return bubble only with explicit Android permission/real active ride.");
