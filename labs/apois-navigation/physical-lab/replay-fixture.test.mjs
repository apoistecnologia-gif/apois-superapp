import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync,writeFileSync,mkdtempSync,rmSync,copyFileSync} from 'node:fs'
import {join} from 'node:path'
import {tmpdir} from 'node:os'
import {verifyReplayFixture,REPLAY_HASHES} from './replay-fixture.mjs'
test('retained fixture matches exact hashes; changed and missing data rejected',()=>{
 const root=process.env.APOIS_REPLAY_FIXTURE
 assert.ok(root)
 assert.equal(verifyReplayFixture(root).entries.length,7)
 const dir=mkdtempSync(join(tmpdir(),'apois-replay-'))
 try{
  for(const name of Object.keys(REPLAY_HASHES))copyFileSync(join(root,name),join(dir,name))
  const name='v21_trip.json',raw=readFileSync(join(dir,name))
  writeFileSync(join(dir,name),Buffer.concat([raw,Buffer.from(' ')]))
  assert.throws(()=>verifyReplayFixture(dir),/identity mismatch/)
  rmSync(join(dir,name))
  assert.throws(()=>verifyReplayFixture(dir))
 }finally{rmSync(dir,{recursive:true,force:true})}
})
