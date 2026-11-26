import assert from 'node:assert/strict'
export function assertLegacyRequestUnchanged(observed,candidate){
 const exact=(s,a,b)=>{assert.equal(s.split(a).length,2,'request-ride overlay anchor');return s.replace(a,()=>b)}
 const marker='import "jsr:@supabase/functions-js/edge-runtime.d.ts";'
 const start='// Only the experimental quote/create path uses this extra session gate.'
 const serve='Deno.serve(async (req: Request) => {'
 const action='    // APOIS_NAVIGATION_LAB_V21: opt-in verified pilot, private HTTPS quote only.'
 const cancel='    if (body?.action === "cancel") {'
 assert.equal(candidate.split(marker).length,2)
 assert.equal(candidate.split(start).length,2)
 assert.equal(candidate.split(serve).length,2)
 assert.equal(candidate.split(action).length,2)
 assert.equal(candidate.split(cancel).length,2)
 const imports=candidate.slice(0,candidate.indexOf(marker))
 assert.equal(imports,'import { createV21ExperimentalAction } from "./v21-edge-adapter.mjs";\nimport { pilotRemoteQuoteMetrics, pilotAllowed } from "./pilot-remote-quote.mjs";\nimport { bearerToken, createV21EdgeSession } from "./edge-session-v21.mjs";\n')
 const helper=candidate.slice(candidate.indexOf(start),candidate.indexOf(serve))
 const experimental=candidate.slice(candidate.indexOf(action),candidate.indexOf(cancel))
 assert.ok(helper.includes('existence-not-after-reviewed'))
 assert.ok(experimental.includes('APOIS_NAVIGATION_EXPERIMENTAL_ENABLED')&&experimental.includes('verifyCurrentSession')&&experimental.includes('pilotAllowed'))
 const baseline=exact(exact(exact(candidate,imports,''),helper,''),experimental,'')
 assert.equal(baseline,observed,'conventional request-ride must be byte-identical to observed v21')
}
