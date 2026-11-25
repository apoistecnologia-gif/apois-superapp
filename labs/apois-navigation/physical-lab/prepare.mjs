import assert from 'node:assert/strict'
import {readFileSync,writeFileSync,cpSync,mkdirSync,realpathSync} from 'node:fs'
import {join} from 'node:path'
import {createHash} from 'node:crypto'
const [hostArg,packArg,routeArg]=process.argv.slice(2)
const host=realpathSync(hostArg),temp=realpathSync(process.env.RUNNER_TEMP)
assert.ok(host===join(temp,'apois-physical-host'))
const lab=new URL('../',import.meta.url),root=join(host,'android')
const get=p=>readFileSync(join(root,p),'utf8'),put=(p,s)=>writeFileSync(join(root,p),s)
const swap=(s,a,b)=>{assert.equal(s.split(a).length,2,a);return s.replace(a,()=>b)}
const hash=b=>createHash('sha256').update(b).digest('hex')
const manifest=readFileSync(join(packArg,'manifest.json'))
assert.equal(hash(manifest),'367c0104a8a5de7f11bdf2c965eb91a73e1cf21b5a3809f78f53e7170b7cdebb')
const m=JSON.parse(manifest)
assert.equal(m.pack_id,'8b27746f727f258c8180c0d3a1c917c62f14a94c083025767eef4ec7682dba40')
assert.equal(m.extract_sha256,'c50dd021ab11518b230c191bc9fa85f683c9b82810f605476532c16172f55238')
const assets=join(root,'navigation-probe/src/main/assets'),out=join(assets,'apois-regional')
mkdirSync(out,{recursive:true})
for(const f of m.files){
 assert.match(f.path,/^(vale\.pmtiles|style\.json|OSM-NOTICE\.txt|LICENSE-Open-Sans\.txt|glyphs\/Open Sans Regular\/\d+-\d+\.pbf)$/)
 const data=readFileSync(join(packArg,f.path));assert.equal(data.length,f.bytes);assert.equal(hash(data),f.sha256)
 const dest=join(out,f.path);mkdirSync(join(dest,'..'),{recursive:true});writeFileSync(dest,data)
}
writeFileSync(join(out,'manifest.json'),manifest)
const report=JSON.parse(readFileSync(join(routeArg,'v21-regional-report.json'),'utf8'))
assert.equal(report.extract_sha256,m.extract_sha256);assert.equal(report.source,'OSM_PBF')
for(const phase of ['pickup','trip']){
 const data=readFileSync(join(routeArg,'v21_'+phase+'.json'));assert.ok(data.length<1024*1024)
 const r=JSON.parse(data);assert.equal(r.code,'Ok');assert.ok(r.routes[0].distance>500)
 assert.ok(r.routes[0].legs.flatMap(l=>l.steps).some(s=>s.voiceInstructions?.length>0))
 writeFileSync(join(assets,'apois-physical-'+phase+'.json'),data)
}
const native='navigation-probe/src/main/java/br/com/apois/navigation/lab/'
cpSync(new URL('physical-lab/PhysicalGpsActivity.kt',lab),join(root,native+'PhysicalGpsActivity.kt'))
let act=get(native+'LabNavigationActivity.kt')
act=swap(act,'val failure by model.failure.collectAsState()','val failure by model.failure.collectAsState()\n            var map by remember { mutableStateOf<BaseStyle.Json?>(null) }\n            var mapFailed by remember { mutableStateOf(false) }\n            LaunchedEffect(Unit){map=BundledRegionalMap.verifiedStyle(applicationContext);mapFailed=map==null}')
act=swap(act,'LaunchedEffect(current.token){','LaunchedEffect(current.token,map){')
act=swap(act,'if(token==null)model.stopNavigation()','if(token==null||map==null)model.stopNavigation()')
act=swap(act,'LABORATÓRIO • trajeto fictício, sem GPS real','LABORATÓRIO • trajeto OSM reproduzido, sem GPS real')
act=swap(act,'                    ApoisNavigationScreen(','                    val verified=map\n                    if(verified==null){Text(if(mapFailed) "Falha na verificação do mapa regional. Volte e informe o erro." else "Verificando mapa regional…",Modifier.padding(12.dp));TextButton(onClick={LabNavigationBridge.close(id);finish()}){Text("Voltar")}} else ApoisNavigationScreen(')
act=swap(act,'BaseStyle.Uri("asset://apois-lab-style.json")','verified')
put(native+'LabNavigationActivity.kt',act)
let model=get(native+'LabReplayModel.kt')
model=swap(model,'context.assets.open("apois-lab-route.json")','context.assets.open(if(token.leg==Leg.PICKUP)"apois-physical-pickup.json" else "apois-physical-trip.json")')
put(native+'LabReplayModel.kt',model)
const appManifest='app/src/main/AndroidManifest.xml'
let xml=get(appManifest)
xml=swap(xml,'<application','<application android:usesCleartextTraffic="false"')
xml=swap(xml,'</application>','<activity android:name="br.com.apois.navigation.lab.PhysicalGpsActivity" android:exported="false" />\n    </application>')
// Capacitor template has INTERNET. Remove it, including inherited permissions.
xml=swap(xml,'xmlns:android="http://schemas.android.com/apk/res/android"','xmlns:android="http://schemas.android.com/apk/res/android" xmlns:tools="http://schemas.android.com/tools"')
xml=xml.replace(/<uses-permission\s+android:name="android.permission.INTERNET"\s*\/>/g,'')
xml=swap(xml,'</manifest>','<uses-permission android:name="android.permission.INTERNET" tools:node="remove" />\n<uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />\n<uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION" />\n<queries><intent><action android:name="android.intent.action.TTS_SERVICE" /></intent></queries>\n</manifest>')
put(appManifest,xml)
const plugin='app/src/main/java/br/com/apois/navigation/compat/lab/ApoisNavigationLabPlugin.java'
put(plugin,swap(get(plugin),'    @PluginMethod\n    public void confirmedAvailability','    @PluginMethod\n    public void physicalGps(PluginCall call) {\n        getActivity().runOnUiThread(() -> {\n            try {\n                getActivity().startActivity(new android.content.Intent(getActivity(),br.com.apois.navigation.lab.PhysicalGpsActivity.class));\n                call.resolve();\n            } catch(Exception e) {call.reject("GPS diagnostic unavailable");}\n        });\n    }\n    @PluginMethod\n    public void confirmedAvailability'))
console.log('APOIS_PHYSICAL_ASSETS_VERIFIED',JSON.stringify({pack:m.pack_id,extract:m.extract_sha256,routeFixture:'45707496288',network:false}))
