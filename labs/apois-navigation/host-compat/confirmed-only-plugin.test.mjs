import {readFileSync} from 'node:fs'
import test from 'node:test'
import assert from 'node:assert/strict'
import {confirmedOnlyPlugin} from './confirmed-only-plugin.mjs'
const original=readFileSync(new URL('./ApoisNavigationLabPlugin.java',import.meta.url),'utf8')
test('confirmed transport retains only reviewed ride reference methods',()=>{
 const generated=confirmedOnlyPlugin(original)
 assert.match(generated,/@CapacitorPlugin\(name="ApoisConfirmedNavigation"\)/)
 assert.match(generated,/ConfirmedNavigationRequest\.sessionId/)
 assert.match(generated,/ConfirmedLiveNavigationBridge\.INSTANCE\.closeAcknowledged/)
 assert.doesNotMatch(generated,/LabNavigationBridge|rideIntent"\)/)
})
test('missing or repeated replay boundaries fail closed',()=>{
 assert.throws(()=>confirmedOnlyPlugin(original.replace('public void open(PluginCall call)','public void replay(PluginCall call)')))
 assert.throws(()=>confirmedOnlyPlugin(original+original))
})
