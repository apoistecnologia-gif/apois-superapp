// INV-035/036/039/043: evaluate exact FCM classifier and log status expressions
// extracted from versioned Edge source. Pure synthetic mocks; NEVER call Firebase.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const source=readFileSync("supabase/functions/send-ride-push/index.ts","utf8");
const generator=readFileSync("scripts/harden-corridas-backend-identity-boundary.mjs","utf8");
assert(source.includes("FcmError")&&source.includes("UNREGISTERED"),"typed FCM error inspection missing");
const match=source.match(/const unregistered = ([\s\S]*?);\s*if \(unregistered\)/);
assert(match,"FCM classifier not found in source");
const classify=new Function("response","failureBody","return Boolean("+match[1]+");");
const fcm=(errorCode)=>({error:{details:[{"@type":"type.googleapis.com/google.firebase.fcm.v1.FcmError",errorCode}]}});
const payload400={error:{details:[{"@type":"type.googleapis.com/google.rpc.BadRequest",fieldViolations:[{field:"message.data"}]}]}};
const cases=[
  [400,payload400,false,"400 payload"],
  [400,fcm("INVALID_ARGUMENT"),false,"400 token not proven"],
  [404,fcm("UNREGISTERED"),true,"404 UNREGISTERED"],
  [404,{error:{status:"NOT_FOUND"}},false,"404 without FCM detail"],
  [403,fcm("SENDER_ID_MISMATCH"),false,"403 sender mismatch"],
  [429,{error:{status:"RESOURCE_EXHAUSTED"}},false,"quota"],
  [500,{error:{status:"UNAVAILABLE"}},false,"temporary failure"],
];
let checked=0;
for(const [status,body,expected,label]of cases){
 assert.equal(classify({status},body),expected,label);
 checked++;
}
assert(source.includes('error: "too_many_recipients", maximum: 100'),"No explicit 100 maximum rejection");
assert(!source.includes("finalUserIds = [...new Set(input.user_ids.filter(Boolean))].slice(0, 100)"),"Silent slice survived");
assert(source.includes('const noTokenIds = allowedUsers.filter((id) => !outcomes.has(id))'),"No token reconciliation absent");
assert(source.includes('status = suppressedIds.includes(userId) ? "suppressed"'),"Suppressed logs absent");
assert(source.includes('"no_token" : outcome.sent > 0 ? "sent" : "failed"'),"No-token/failure mapping absent");
assert(generator.includes("normalizeRecipientDomainIds"),"Domain normalizer absent");
assert(!generator.includes("normalizeRecipientAuthIds"),"Legacy AUTH conversion survived");
checked+=7;
console.log("[OK] INV-035/036/039/043 "+checked+" pure assertions using versioned source; no real push");
