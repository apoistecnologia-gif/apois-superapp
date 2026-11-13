// APOIS_PARTNER_QA239_OPTIONAL_BUBBLE_V1
// Runs after existing GPS, external-navigation, QA235 and QA236 native installers.
// No new background service, notifications, location permissions or source-pin edits.
import {existsSync,readFileSync,writeFileSync,copyFileSync} from "node:fs";
import {resolve} from "node:path";
const base=resolve("superapp/partner-shell/android/app/src/main");
const javaDir=resolve(base,"java/br/com/apois/parceiro");
const pluginFile=resolve(javaDir,"APOISExternalNavigationPlugin.java");
const bubbleSource=resolve("scripts/android/ApoisNavigationBubble.java");
const bubbleTarget=resolve(javaDir,"ApoisNavigationBubble.java");
const manifestFile=resolve(base,"AndroidManifest.xml");
for(const file of [pluginFile,bubbleSource,manifestFile])if(!existsSync(file))throw Error("[QA239] required generated Android file "+file);
function once(s,a,b,label){const n=s.split(a).length-1;if(n!==1)throw Error("[QA239] "+label+" anchor="+n);return s.replace(a,b);}
let java=readFileSync(pluginFile,"utf8");
if(java.includes("APOIS_PARTNER_QA239_OPTIONAL_BUBBLE_V1"))throw Error("[QA239] native already patched");
if(!java.includes("APOIS_PARTNER_QA236_PICKUP_RETURN_V1"))throw Error("[QA239] QA236 arrival notification required");
java=once(java,
'                response.put("provider", provider);\n                call.resolve(response);',
'                response.put("provider", provider);\n'+
'                // QA239: optional return bubble only after external Activity opened.\n'+
'                ApoisNavigationBubble.showIfEnabled(activity.getApplicationContext());\n'+
'                call.resolve(response);',
"show after opening external navigation");
java=once(java,
'        if (!status.getBoolean(key, false)) {',
'        if ("motorista".equals(role)) ApoisNavigationBubble.setMotoristaActive(getContext(), active && status.getBoolean(key,false));\n'+
'        if (!status.getBoolean(key, false)) {',
"bubble follows existing active Motorista GPS service");
const methods=[
'    // APOIS_PARTNER_QA239_OPTIONAL_BUBBLE_V1',
'    @PluginMethod',
'    public void bubbleStatus(PluginCall call) {',
'        JSObject state=new JSObject();',
'        state.put("enabled",ApoisNavigationBubble.enabled(getContext()));',
'        state.put("permission",ApoisNavigationBubble.permitted(getContext()));',
'        call.resolve(state);',
'    }',
'',
'    @PluginMethod',
'    public void setBubbleEnabled(PluginCall call) {',
'        boolean enabled=Boolean.TRUE.equals(call.getBoolean("enabled"));',
'        ApoisNavigationBubble.setEnabled(getContext(),enabled);',
'        JSObject state=new JSObject();',
'        state.put("enabled",ApoisNavigationBubble.enabled(getContext()));',
'        state.put("permission",ApoisNavigationBubble.permitted(getContext()));',
'        call.resolve(state);',
'    }',
'',
'    @PluginMethod',
'    public void openBubbleSettings(PluginCall call) {',
'        Activity activity=getActivity();',
'        if(activity==null){call.reject("O APOIS precisa estar aberto.");return;}',
'        try {',
'            Intent settings=new Intent(android.provider.Settings.ACTION_MANAGE_OVERLAY_PERMISSION);',
'            settings.setData(Uri.parse("package:"+activity.getPackageName()));',
'            activity.startActivity(settings);',
'            call.resolve();',
'        } catch (Exception failure) {',
'            call.reject("Abra Permissões especiais nas configurações do Android.",failure);',
'        }',
'    }',
''
].join("\n");
const pos=java.lastIndexOf("}");
if(pos<0)throw Error("[QA239] plugin close missing");
java=java.slice(0,pos)+methods+"\n"+java.slice(pos);
const required=["setMotoristaActive","showIfEnabled","bubbleStatus","setBubbleEnabled","openBubbleSettings"];
for(const marker of required)if(!java.includes(marker))throw Error("[QA239] native plugin missing "+marker);
let xml=readFileSync(manifestFile,"utf8");
if(xml.includes("android.permission.SYSTEM_ALERT_WINDOW"))throw Error("[QA239] overlay declared twice");
if(!/<application\b/.test(xml))throw Error("[QA239] application tag missing");
xml=xml.replace(/<application\b/,'<uses-permission android:name="android.permission.SYSTEM_ALERT_WINDOW" />\n    <application');
writeFileSync(pluginFile,java,"utf8");
writeFileSync(manifestFile,xml,"utf8");
copyFileSync(bubbleSource,bubbleTarget);
console.log("[OK] QA239: user-consented TYPE_APPLICATION_OVERLAY on live Motorista only, notification fallback, no new GPS service");
