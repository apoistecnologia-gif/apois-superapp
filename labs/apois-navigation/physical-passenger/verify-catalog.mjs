import assert from 'node:assert/strict'
import {readFileSync,statSync} from 'node:fs'
import {createHash} from 'node:crypto'
import {pathToFileURL} from 'node:url'
import {resolve} from 'node:path'
const extract='c50dd021ab11518b230c191bc9fa85f683c9b82810f605476532c16172f55238'
export const VALE_CATALOG_SHA256='bec83aeb51bb7dbcde8795714ceb9e67598443144c1d8ff73e6c717970474ff6'
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/
export function verifyInactiveValeCatalog(file){
 assert.ok(statSync(file).size>0&&statSync(file).size<=512*1024)
 const raw=readFileSync(file),digest=createHash('sha256').update(raw).digest('hex')
 assert.equal(digest,VALE_CATALOG_SHA256,'catalog byte identity mismatch')
 const c=JSON.parse(raw.toString('utf8'))
 assert.equal(c.format,'apois-independent-catalog-v1')
 assert.equal(c.source,'OSM_PBF');assert.equal(c.extract_sha256,extract)
 assert.equal(c.version,1);assert.equal(c.license,'ODbL-1.0')
 assert.equal(c.attribution,'© OpenStreetMap contributors')
 assert.equal(c.count,390);assert.equal(c.rows.length,c.count)
 const ids=new Set(),osm=new Set()
 for(const r of c.rows){
  assert.equal(Object.keys(r).length,9)
  assert.ok(uuid.test(r.id)&&!ids.has(r.id));ids.add(r.id)
  assert.equal(r.osm_kind,'node')
  assert.ok(Number.isSafeInteger(r.osm_id)&&r.osm_id>0&&!osm.has(r.osm_id));osm.add(r.osm_id)
  assert.equal(r.version,1);assert.equal(r.extract_sha256,extract);assert.equal(r.active,false)
  assert.ok(typeof r.label==='string'&&r.label.trim().length>0&&[...r.label].length<=120&&!/[\p{C}]/u.test(r.label))
  assert.ok(Number.isFinite(r.lat)&&r.lat>=-9.65&&r.lat<=-9.10&&Number.isFinite(r.lng)&&r.lng>=-40.80&&r.lng<=-40.20)
  // Recompute UUIDv5 from the exact namespace and OSM node ID.
  const ns=Buffer.from('a5a0d35970e14d7e8c39b0370471b677','hex')
  const digest=createHash('sha1').update(ns).update('osm:node:'+r.osm_id).digest().subarray(0,16)
  digest[6]=(digest[6]&15)|80;digest[8]=(digest[8]&63)|128
  const hex=digest.toString('hex')
  assert.equal(r.id,hex.replace(/^(........)(....)(....)(....)(............)$/,'$1-$2-$3-$4-$5'))
 }
 return {catalog:c,sha256:digest}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
 const {catalog,sha256}=verifyInactiveValeCatalog(process.argv[2])
 console.log('APOIS_VALE_INACTIVE_CATALOG_VERIFIED',JSON.stringify({count:catalog.count,extract:catalog.extract_sha256,sha256,active:0}))
}
