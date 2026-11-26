// Compile proof only. Never install a host, deploy a backend or register
// the existing GPS/voice services in this disposable Capacitor template.
import assert from 'node:assert/strict'
import {realpathSync,readFileSync,writeFileSync,copyFileSync,mkdirSync,existsSync,statSync} from 'node:fs'
import {join,dirname} from 'node:path'
import {createHash} from 'node:crypto'
import {confirmedOnlyPlugin} from './confirmed-only-plugin.mjs'
import {execFileSync} from 'node:child_process'
const [hostArg,labArg,assetsArg]=process.argv.slice(2)
const host=realpathSync(hostArg),lab=realpathSync(labArg),assets=realpathSync(assetsArg)
const temp=realpathSync(process.env.RUNNER_TEMP)
assert.equal(host,join(temp,'apois-compat-host'))
assert.equal(assets,join(temp,'apois-vale-runtime-assets'))
const android=join(host,'android'),module=join(android,'navigation-probe')
const java=join(module,'src/main/java/br/com/apois/navigation/lab')
const app=join(android,'app/src/main')
const read=p=>readFileSync(p,'utf8')
const main=read(join(app,'java/br/com/apois/navigation/compat/lab/MainActivity.java'))
const manifest=read(join(app,'AndroidManifest.xml'))
for(const name of ['DriverLocationService','DriverLocationPlugin','DriverVoicePlugin','ValeNativeHostBootstrap']){
 assert.ok(!main.includes(name)&&!manifest.includes(name),'unexpected registration: '+name)
}
assert.ok(existsSync(join(app,'java/br/com/apois/navigation/compat/lab/DriverLocationService.java')))
assert.ok(existsSync(join(app,'java/com/apois/motorista/DriverVoicePlugin.java')))
const pins={
 'apois-regional/manifest.json':'367c0104a8a5de7f11bdf2c965eb91a73e1cf21b5a3809f78f53e7170b7cdebb',
 'apois-regional/vale.pmtiles':'18dc74cfea6ab6a8365b48df0731173b794825b108ed1f72db740ed16c3490fe',
 'apois-vale-data/graph.tar':'38cf6df5fdd080ac4feb5c053a417fb4b814119765bc8214ad7593da985a1433',
 'apois-vale-data/search.json':'9864919ce496184b917818f56d00406ef367c1987cdf37f24cc524c324bc08fa'
}
const sha=b=>createHash('sha256').update(b).digest('hex')
const data=new Map()
function collect(name,expected,bytes){
 assert.match(name,/^(apois-regional\/(?:manifest\.json|vale\.pmtiles|style\.json|OSM-NOTICE\.txt|LICENSE-Open-Sans\.txt|glyphs\/Open Sans Regular\/\d+-\d+\.pbf)|apois-vale-data\/(?:graph\.tar|search\.json))$/)
 const file=join(assets,name)
 assert.equal(file,realpathSync(file));assert.ok(statSync(file).size<=16*1024*1024)
 const b=readFileSync(file);assert.equal(sha(b),expected)
 if(bytes!==undefined)assert.equal(b.length,bytes)
 data.set(name,b)
}
for(const [name,pin] of Object.entries(pins))collect(name,pin)
const m=JSON.parse(data.get('apois-regional/manifest.json'))
assert.equal(m.pack_id,'8b27746f727f258c8180c0d3a1c917c62f14a94c083025767eef4ec7682dba40')
assert.ok(Array.isArray(m.files)&&m.files.length<=36)
for(const f of m.files)collect('apois-regional/'+f.path,f.sha256,f.bytes)
assert.ok([...data.values()].reduce((n,b)=>n+b.length,0)<=32*1024*1024)
for(const [name,b] of data){
 const target=join(app,'assets',name)
 mkdirSync(dirname(target),{recursive:true});writeFileSync(target,b,{flag:'wx'})
}
for(const [dir,file] of [['launch-vale','ValeOfflineResolver.kt'],['launch-vale','ValeRuntimePack.kt'],['pack-store','OfflinePackStore.kt']]){
 const target=join(java,file);assert.ok(!existsSync(target));copyFileSync(join(lab,dir,file),target)
}
const gradle=join(module,'build.gradle'),before=read(gradle)
assert.ok(!before.includes('valhalla-mobile'))
writeFileSync(gradle,before+"\ndependencies {\n implementation 'io.github.rallista:valhalla-mobile:0.6.3'\n implementation 'io.github.rallista:valhalla-models:0.5.2'\n implementation 'io.github.rallista:valhalla-models-config:0.5.2'\n implementation 'com.stadiamaps:osrm-openapi:0.0.10'\n}\n")
// Compile the real-ride-only variant alongside the lab transport. The
// actual registration is deliberately left to a separately reviewed host.
execFileSync(process.execPath,['--test',join(lab,'host-compat/confirmed-only-plugin.test.mjs')],{stdio:'inherit'})
writeFileSync(join(app,'java/br/com/apois/navigation/compat/lab/ApoisConfirmedNavigationPlugin.java'),
 confirmedOnlyPlugin(read(join(lab,'host-compat/ApoisNavigationLabPlugin.java'))),{flag:'wx'})
assert.equal(read(join(app,'AndroidManifest.xml')),manifest)
assert.equal(read(join(app,'java/br/com/apois/navigation/compat/lab/MainActivity.java')),main)
console.log('APOIS_QA290_NATIVE_VALE_STAGED',JSON.stringify({assets:data.size,activated:false,gpsRegistered:false,voiceRegistered:false}))
