import test from 'node:test'
import assert from 'node:assert/strict'
import {createTileScheduler} from './tile-scheduler.mjs'
test('bounded queue serializes and does not start a cancelled request',async()=>{
 const s=createTileScheduler({parallel:1,maxQueued:1}),c=new AbortController()
 let release,started=0
 const a=s.run(()=>{started++;return new Promise(r=>{release=r})})
 const b=s.run(()=>{started++;return 2},c.signal)
 await assert.rejects(s.run(()=>3),/queue full/)
 c.abort();await assert.rejects(b,/Cancelled/);assert.equal(started,1)
 release(1);assert.equal(await a,1)
 assert.equal(await s.run(()=>4),4);assert.equal(started,1)
 s.close();await assert.rejects(s.run(()=>5),/Cancelled/)
})
test('close cancels pending work and never returns a late active result',async()=>{
 const s=createTileScheduler({parallel:1,maxQueued:2})
 let release
 const a=s.run(()=>new Promise(r=>{release=r}));const b=s.run(()=>{throw Error('must not start')})
 await Promise.resolve();s.close()
 await assert.rejects(b,/Cancelled/);release(1);await assert.rejects(a,/Cancelled/)
})
