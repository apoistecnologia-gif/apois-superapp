import test from 'node:test'
import assert from 'node:assert/strict'
import {prepareApprovedPilotMap} from './approved-map-provider.mjs'
test('no enabled configuration or no approved map/catalog pair causes no I/O',async()=>{
 let calls=0;const fail=()=>{calls++;throw Error('unexpected')}
 assert.equal(await prepareApprovedPilotMap({}, {enabled:false,auth:{getSession:fail}}),null)
 assert.equal(await prepareApprovedPilotMap({}, {enabled:true,auth:{getSession:fail},policy:{packId:'a'.repeat(64)}}),null)
 assert.equal(calls,0)
})
