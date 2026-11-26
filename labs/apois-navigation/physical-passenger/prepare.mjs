import assert from 'node:assert/strict'
import {readFileSync,writeFileSync,mkdirSync,cpSync,realpathSync} from 'node:fs'
import {createHash} from 'node:crypto'
import {join} from 'node:path'
import {verifyInactiveValeCatalog} from './verify-catalog.mjs'
const [dirArg,pack,regional]=process.argv.slice(2),dir=realpathSync(dirArg)
assert.equal(dir,join(realpathSync(process.env.RUNNER_TEMP),'apois-passenger-physical'))
const sha=b=>createHash('sha256').update(b).digest('hex')
const manifest=readFileSync(join(pack,'manifest.json'))
assert.equal(sha(manifest),'367c0104a8a5de7f11bdf2c965eb91a73e1cf21b5a3809f78f53e7170b7cdebb')
const m=JSON.parse(manifest),target=join(dir,'www/apois-regional')
mkdirSync(target,{recursive:true})
for(const f of m.files){
 assert.match(f.path,/^(vale\.pmtiles|style\.json|OSM-NOTICE\.txt|LICENSE-Open-Sans\.txt|glyphs\/Open Sans Regular\/\d+-\d+\.pbf)$/)
 const data=readFileSync(join(pack,f.path));assert.equal(data.length,f.bytes);assert.equal(sha(data),f.sha256)
 const dest=join(target,f.path);mkdirSync(join(dest,'..'),{recursive:true});writeFileSync(dest,data)
}
writeFileSync(join(target,'manifest.json'),manifest)
const {catalog:c,sha256:catalogHash}=verifyInactiveValeCatalog(join(regional,'catalog.json'))
assert.equal(c.extract_sha256,m.extract_sha256);assert.equal(c.source,'OSM_PBF');assert.equal(c.version,1)
assert.ok(c.rows.every(r=>r.active===false))
const closest=(lat,lng)=>c.rows.slice().sort((a,b)=>Math.hypot(a.lat-lat,a.lng-lng)-Math.hypot(b.lat-lat,b.lng-lng))[0]
const points=[closest(-9.4165,-40.5035),closest(-9.403901,-40.5040233)]
assert.notEqual(points[0].id,points[1].id)
const rows=points.map(({id,version,extract_sha256,label,lat,lng})=>({id,version,extract_sha256,label,lat,lng,active:true}))
writeFileSync(join(dir,'catalog.json'),JSON.stringify({source:c.source,version:c.version,extract_sha256:c.extract_sha256,rows}))
writeFileSync(join(dir,'policy.json'),JSON.stringify({packId:m.pack_id,manifestSha256:sha(manifest),mapExtractHash:m.extract_sha256,catalog:{version:c.version,extractHash:c.extract_sha256}}))
console.log('APOIS_PASSENGER_PHYSICAL_CATALOG',JSON.stringify({catalogHash,fixtureRows:rows.map(r=>r.label),synthetic:true}))
