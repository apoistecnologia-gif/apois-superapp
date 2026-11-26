import assert from 'node:assert/strict'
import {readFileSync,writeFileSync,mkdirSync,realpathSync,existsSync} from 'node:fs'
import {dirname,join} from 'node:path'
import {createHash} from 'node:crypto'
import {assertLegacyRequestUnchanged} from './request-legacy-guard.mjs'
const temp=realpathSync(process.env.RUNNER_TEMP)
const output=join(temp,'apois-navigation-edge-candidate')
assert.ok(!existsSync(output))
const source=realpathSync(new URL('..',import.meta.url))
const read=path=>readFileSync(join(source,path),'utf8')
assertLegacyRequestUnchanged(read('production-contract/observed-request-ride-v21.ts'),read('production-contract/candidate-request-ride-v21.ts'))
const entrypoints={
 'request-ride':'production-contract/candidate-request-ride-v21.ts',
 'apois-navigation-control':'production-contract/candidate-navigation-control-edge.ts',
 'apois-navigation-driver-control':'driver-broker/candidate-driver-control-edge.ts'
}
const paths=[
 ...Object.values(entrypoints),
 'production-contract/v21-edge-adapter.mjs','production-contract/request-ride-v21.mjs',
 'production-contract/pilot-remote-quote.mjs','production-contract/edge-session-v21.mjs',
 'production-contract/navigation-control-v21.mjs','production-contract/recovery-v21.mjs','production-contract/catalog-validation.mjs',
 'production-contract/driver-direct-edge-v21.mjs','production-contract/driver-control-v21.mjs',
 'driver-broker/driver-local-session.mjs','driver-broker/driver-proxy.mjs','driver-broker/driver-protocol.mjs','driver-broker/http.mjs',
 'remote-quote/remote-quote-metrics.mjs','remote-quote/quote-protocol.mjs'
]
const sha=b=>createHash('sha256').update(b).digest('hex')
const shared=join(output,'supabase/functions/_shared/apois-navigation')
const records=[]
function emit(path,body){
 const target=join(output,path);mkdirSync(dirname(target),{recursive:true});writeFileSync(target,body,{flag:'wx'})
 records.push({path,sha256:sha(body),bytes:Buffer.byteLength(body)})
}
for(const path of paths){
 assert.equal(realpathSync(join(source,path)),join(source,path))
 const body=read(path)
 // All relative imports must resolve to an explicitly reviewed module.
 for(const match of body.matchAll(/^\s*import\s+[^\n]*?["'](\.[^"']+)["']/gm)){
  const dep=join(dirname(path),match[1]);assert.ok(paths.includes(dep),'unreviewed dependency '+dep)
 }
 emit('supabase/functions/_shared/apois-navigation/'+path,body)
}
for(const [name,path] of Object.entries(entrypoints))emit('supabase/functions/'+name+'/index.ts','import "../_shared/apois-navigation/'+path+'";\n')
emit('supabase/config.toml','project_id = "apois-navigation-candidate-not-linked"\n'+Object.keys(entrypoints).map(n=>'\n[functions.'+n+']\nverify_jwt = true\n').join(''))
emit('READ-ME.txt','Candidate only. Do not link, deploy, or activate. No SQL migrations, credentials, hosted project reference, or real user data. Request-ride legacy path checked byte-for-byte against observed v21, not a guarantee of current production parity. Auth policy, quota, staging environment and operational tests remain mandatory.\n')
const manifest={schema:1,releaseReady:false,active:false,edgeVersionObserved:21,files:records}
writeFileSync(join(output,'manifest.json'),JSON.stringify(manifest,null,2)+'\n',{flag:'wx'})
console.log('APOIS_EDGE_CANDIDATE_BUNDLED',JSON.stringify({functions:Object.keys(entrypoints),files:records.length,active:false}))
