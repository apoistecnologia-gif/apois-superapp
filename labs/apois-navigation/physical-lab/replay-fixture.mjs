import assert from 'node:assert/strict'
import {readFileSync,statSync} from 'node:fs'
import {join} from 'node:path'
import {createHash} from 'node:crypto'
const sha=b=>createHash('sha256').update(b).digest('hex')
const extract='c50dd021ab11518b230c191bc9fa85f683c9b82810f605476532c16172f55238'
function read(root,name,limit){
 const file=join(root,name),s=statSync(file)
 assert.ok(s.isFile()&&s.size>0&&s.size<=limit,name)
 return readFileSync(file)
}
export function verifyReplayFixture(root){
 const reportBytes=read(root,'v21-regional-report.json',65536),report=JSON.parse(reportBytes)
 assert.equal(report.source,'OSM_PBF');assert.equal(report.extract_sha256,extract)
 assert.equal(report.auth,'synthetic');assert.equal(report.dispatch,'synthetic after commit')
 assert.equal(report.recoveredWithoutDuplicate,true)
 assert.equal(report.selectedPublicNodes,2)
 assert.equal(report.routes.length,3)
 const entries=[{name:'v21-regional-report.json',sha256:sha(reportBytes)}]
 for(const name of ['pickup','reroute','trip']){
  const file='v21_'+name+'.json',bytes=read(root,file,1024*1024),data=JSON.parse(bytes)
  assert.equal(data.code,'Ok');assert.ok(data.routes.length>0)
  const r=data.routes[0],expected=report.routes.filter(x=>x.name===name)
  assert.equal(expected.length,1);assert.equal(expected[0].distanceM,r.distance)
  assert.ok(Number.isFinite(r.distance)&&r.distance>500&&r.distance<25000)
  assert.ok(Number.isFinite(r.duration)&&r.duration>0)
  const voice=r.legs.flatMap(l=>l.steps).flatMap(s=>s.voiceInstructions??[]).map(v=>v.announcement).filter(Boolean)
  assert.equal(expected[0].voiceCount,voice.length);assert.ok(voice.length>0)
  const replay='v21_'+name+'-replay.txt',log=read(root,replay,65536)
  assert.match(log.toString('utf8'),/APOIS_REPLAY_OK.*spoken_instruction_fixes=[1-9][0-9]*/)
  entries.push({name:file,sha256:sha(bytes)},{name:replay,sha256:sha(log)})
 }
 return {sourceRun:45707496288,extract,synthetic:true,entries}
}
