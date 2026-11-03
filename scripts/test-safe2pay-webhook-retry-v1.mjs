// Safe2Pay isolated QA: one-RPC/atomicity contract; no Supabase network or real money.
// SQL is REVIEW_ONLY and must still pass real PostgreSQL staging tests before release.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
const edge = readFileSync("supabase/functions/safe2pay-webhook/index.ts","utf8");
const sql = {
  rides: readFileSync("database/review/20261103_safe2pay_corridas_atomic_REVIEW_ONLY.sql","utf8"),
  orders: readFileSync("database/review/20261103_safe2pay_entregas_atomic_REVIEW_ONLY.sql","utf8"),
};
let passed=0;
async function check(label, fn) { await fn(); console.log("[OK] "+label); passed++; }
await check("Edge performs ONE atomic RPC with fail-closed database errors",()=>{
  assert.match(edge,/APOIS_SAFE2PAY_ATOMIC_RPC_V1/);
  assert.match(edge,/await admin\.rpc\("apois_safe2pay_apply_event_atomic"/);
  assert.doesNotMatch(edge,/\badmin\.from\(/);
  assert.match(edge,/if \(result\.error\) return json\(503/);
  assert.match(edge,/if \(outcome\.manual_review === true\)/);
});
for (const [product,source] of Object.entries(sql)) {
  await check(product+": SQL review restricts execution and locks financial/domain rows",()=>{
    const tx=product==="rides"?"safe2pay_ride_transactions":"safe2pay_order_transactions";
    const domain=product==="rides"?"rides":"orders";
    assert.match(source,/REVIEW ONLY; NOT APPLIED/);
    assert.match(source,/BEGIN;[\s\S]*CREATE FUNCTION public\.apois_safe2pay_apply_event_atomic[\s\S]*COMMIT;/);
    assert.match(source,/SECURITY DEFINER SET search_path TO ''/);
    assert.match(source,/FROM PUBLIC, anon, authenticated;/);
    assert.match(source,/TO service_role;/);
    const pos=[source.indexOf("FROM public."+tx+"\n WHERE provider_transaction_id = _provider_transaction_id FOR UPDATE"),
      source.indexOf("FROM public."+domain+" WHERE id=v_tx."),source.indexOf("UPDATE public."+tx+" SET status"),
      source.indexOf("UPDATE public."+domain+" SET payment_status"),source.lastIndexOf("INSERT INTO public.safe2pay_webhook_events")];
    assert.ok(pos.every((v,i)=>v>=0&&(i===0||v>pos[i-1])),"SQL must lock before all mutations");
    assert.match(source,/manual_chargeback_reconciliation_required/);
    assert.match(source,/authorized_after_failed_or_expired_manual_review/);
    assert.match(source,/unsupported_status_manual_review/);
    assert.match(source,/refund_without_authorization_manual_review/);
    assert.match(source,/v_mapped = 'chargeback' OR v_target = 'chargeback'/);
    assert.match(source,/ON CONFLICT \(event_key\) DO UPDATE/);
    assert.doesNotMatch(source,/UPDATE public\.(?:refunds|wallets|driver_wallets|payouts)/);
  });
}
function fake(product,{fail=false,missing=false}={}) {
  let handler, calls=0, rejectOnce=fail;
  const state={transaction:"pending",domain:"pending",event:null};
  const adapter={ async rpc(method,args){
    calls++;assert.equal(method,"apois_safe2pay_apply_event_atomic");
    if(missing)return{error:{code:"PGRST202"},data:null};
    const isCorrectRef=args._reference===("apois-"+(product==="rides"?"ride":"order")+"-fixture");
    if(!isCorrectRef||args._amount!==12.5)return{error:{code:"23514"},data:null};
    const next={"1":"pending","2":"processing","3":"authorized","6":"refunded","13":"chargeback"}[args._status_code];
    if(next==="chargeback")return{error:null,data:{ok:false,manual_review:true,reason:"chargeback"}};
    if(!next)return{error:null,data:{ok:false,manual_review:true,reason:"unsupported_status"}};
    if(next==="refunded"&&!["authorized","refunded"].includes(state.transaction))
      return{error:null,data:{ok:false,manual_review:true,reason:"refund_without_authorization"}};
    if(next==="authorized"&&["failed","expired"].includes(state.transaction))
      return{error:null,data:{ok:false,manual_review:true,reason:"authorized_after_terminal"}};
    const rank={pending:10,processing:20,authorized:30,failed:40,expired:40,refunded:50,chargeback:60};
    const actual=rank[next]>=rank[state.transaction]?next:state.transaction;
    if(rejectOnce){rejectOnce=false;return{error:{code:"TX_ROLLBACK_FIXTURE"},data:null};}
    // A simulated DB transaction: publish all columns only after every phase succeeds.
    state.transaction=actual;
    state.domain=actual==="authorized"?"paid":actual==="refunded"?"refunded":state.domain;
    state.event=args._status_code;
    return{error:null,data:{ok:true,status:actual,ignored:actual!==next}};
  }};
  const env={SAFE2PAY_SECRET_KEY:"secret",SAFE2PAY_WEBHOOK_PRODUCT:product,
    SUPABASE_URL:"https://example.invalid",SUPABASE_SERVICE_ROLE_KEY:"fixture-role"};
  const ctx={Deno:{serve(f){handler=f},env:{get(k){return env[k]??null}}},createClient:()=>adapter,
    crypto:globalThis.crypto,Request,Response,TextEncoder,console,Date,Number,String,Object,Array,Math,JSON};
  const raw=edge.replace(/^import \{ createClient \} from "npm:[^"]+";\s*/m,"");
  const js=new Bun.Transpiler({loader:"ts",target:"browser"}).transformSync(raw);
  vm.runInNewContext(js,ctx,{filename:"safe2pay-webhook/index.ts"});
  return {state,get calls(){return calls},
    async send(code,overrides={},method="POST"){
      const payload={SecretKey:"secret",IdTransaction:77,TransactionStatus:{Code:String(code)},
        Reference:"apois-"+(product==="rides"?"ride":"order")+"-fixture",Amount:12.5,...overrides};
      const req=new Request("https://fixture.invalid",{method,...(method==="POST"?{body:JSON.stringify(payload)}:{})});
      const res=await handler(req);
      return{code:res.status,body:await res.json()};
    }};
}
await check("Invalid shared secret and unsupported HTTP method do not invoke RPC",async()=>{
  const h=fake("rides");
  assert.equal((await h.send("3",{SecretKey:"wrong"})).code,401);
  assert.equal((await h.send("3",{},"GET")).code,405);
  assert.equal(h.calls,0);
});
for(const product of ["rides","orders"]){
  await check(product+": rollback simulation does not commit partial payment",async()=>{
    const h=fake(product,{fail:true});
    assert.equal((await h.send("3")).code,503);
    assert.deepEqual(h.state,{transaction:"pending",domain:"pending",event:null});
    assert.equal((await h.send("3")).code,200);
    assert.equal(h.state.domain,"paid");
    assert.equal(h.state.event,"3");
  });
  await check(product+": refund, stale event and idempotent replay",async()=>{
    const h=fake(product);
    assert.equal((await h.send("3")).code,200);
    assert.equal((await h.send("6")).code,200);
    assert.equal((await h.send("1")).code,202);
    assert.equal((await h.send("6")).code,200);
    assert.equal(h.state.domain,"refunded");
  });
  await check(product+": chargeback does not fabricate refunds and requires manual review",async()=>{
    const h=fake(product);
    assert.equal((await h.send("3")).code,200);
    const result=await h.send("13");
    assert.equal(result.code,503);
    assert.equal(result.body.manual_review,true);
    assert.equal(h.state.domain,"paid");
  });
  await check(product+": unknown official provider status fails closed for manual reconciliation",async()=>{
    const h=fake(product);
    for(const code of ["5","7","8","12","14","15","19"]){
      const result=await h.send(code);
      assert.equal(result.code,503,"Unexpected status "+code);
      assert.equal(result.body.manual_review,true);
    }
    assert.equal(h.state.transaction,"pending");
    assert.equal(h.state.domain,"pending");
  });
  await check(product+": refund before paid and authorization after failed/expired require review",async()=>{
    const h=fake(product);
    let result=await h.send("6");
    assert.equal(result.code,503);
    assert.equal(result.body.manual_review,true);
    assert.equal(h.state.domain,"pending");
    h.state.transaction="expired";
    result=await h.send("3");
    assert.equal(result.code,503);
    assert.equal(result.body.manual_review,true);
    assert.equal(h.state.domain,"pending");
    h.state.transaction="failed";
    result=await h.send("3");
    assert.equal(result.code,503);
    assert.equal(h.state.domain,"pending");
  });
  await check(product+": chargeback after a recorded refund still requires review",async()=>{
    const h=fake(product);
    assert.equal((await h.send("3")).code,200);
    assert.equal((await h.send("6")).code,200);
    assert.equal((await h.send("13")).code,503);
    assert.equal(h.state.domain,"refunded");
  });
  await check(product+": absent or malformed financial fields never call RPC",async()=>{
    const h=fake(product);
    for(const payload of [
      {Amount:null},{Amount:""},{Amount:false},{Amount:"12.345"},
      {Amount:12.345},{IdTransaction:null},{IdTransaction:""},
      {IdTransaction:false},{IdTransaction:"foo"}
    ]){
      assert.equal((await h.send("3",payload)).code,400,JSON.stringify(payload));
    }
    assert.equal(h.calls,0);
  });
  await check(product+": unavailable transaction RPC never returns success",async()=>{
    const h=fake(product,{missing:true});
    assert.equal((await h.send("3")).code,503);
    assert.equal(h.state.domain,"pending");
  });
  await check(product+": mismatched reference and amount are rejected",async()=>{
    const h=fake(product);
    assert.equal((await h.send("3",{Reference:"apois-"+(product==="rides"?"ride":"order")+"-wrong"})).code,503);
    assert.equal((await h.send("3",{Amount:15})).code,503);
    assert.equal(h.state.domain,"pending");
  });
}
console.log("[PASS] "+passed+" Safe2Pay isolated tests; no actual PostgreSQL transaction, API or money movement.");
