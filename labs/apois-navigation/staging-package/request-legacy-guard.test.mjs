import assert from 'node:assert/strict'
import test from 'node:test'
import {readFileSync} from 'node:fs'
import {assertLegacyRequestUnchanged} from './request-legacy-guard.mjs'
const read=n=>readFileSync(new URL('../production-contract/'+n,import.meta.url),'utf8')
const observed=read('observed-request-ride-v21.ts'),candidate=read('candidate-request-ride-v21.ts')
test('only three reviewed experimental regions differ from observed v21',()=>assertLegacyRequestUnchanged(observed,candidate))
test('ordinary cancel, fare and dispatch changes fail the bundle guard',()=>{
 for(const change of [
  candidate.replace('const R = 6371;','const R = 7000;'),
  candidate.replace('if (body?.action === "cancel") {','if (body?.action === "cancelled") {'),
  candidate.replace('dispatch_deferred','changed_dispatch'),
  candidate.replace('verifyCurrentSession:','unchecked:')
 ]){assert.notEqual(change,candidate);assert.throws(()=>assertLegacyRequestUnchanged(observed,change))}
})
