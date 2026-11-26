import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync,writeFileSync,mkdtempSync,rmSync} from 'node:fs'
import {join} from 'node:path'
import {tmpdir} from 'node:os'
import {verifyInactiveValeCatalog,VALE_CATALOG_SHA256} from './verify-catalog.mjs'
test('exact retained catalogue and rejection of plausible altered copies',()=>{
 const file=process.env.APOIS_RETAINED_CATALOG
 assert.ok(file,'CI must provide retained catalog')
 const raw=readFileSync(file),result=verifyInactiveValeCatalog(file)
 assert.equal(result.sha256,VALE_CATALOG_SHA256)
 assert.equal(result.catalog.rows.length,390)
 const dir=mkdtempSync(join(tmpdir(),'apois-catalog-'))
 try{
  const target=join(dir,'catalog.json')
  const change=JSON.parse(raw.toString('utf8'))
  change.rows[0].label+=' alterado'
  for(const data of [JSON.stringify(change),Buffer.concat([raw,Buffer.from(' ')]),raw.subarray(0,raw.length-1),Buffer.alloc(512*1024+1)]){
   writeFileSync(target,data)
   assert.throws(()=>verifyInactiveValeCatalog(target))
  }
 }finally{rmSync(dir,{recursive:true,force:true})}
})
