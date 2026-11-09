import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {resolve} from "node:path";
import {test} from "node:test";
import {patchAvailableCalls,MARK} from "../fix-partner-available-calls-visual14-v1.mjs";

const root=resolve(import.meta.dirname,"../..");
function baseComponent(){
  const generator=readFileSync(resolve(root,"scripts/harden-partner-available-calls-v1.mjs"),"utf8");
  const position=generator.indexOf("writeFileSync(componentPath,");
  assert.ok(position>=0,"generator must write the shared component");
  const begin=generator.indexOf('"',position);
  let end=begin+1,escaped=false;
  for(;end<generator.length;end++){
    const ch=generator[end];
    if(escaped){escaped=false;continue;}
    if(ch==="\\"){escaped=true;continue;}
    if(ch==='"')break;
  }
  return JSON.parse(generator.slice(begin,end+1));
}
function deferred(){
  let resolvePromise;
  const promise=new Promise((resolve)=>{resolvePromise=resolve;});
  return {promise,resolve:resolvePromise};
}
function harness(patched,rpc){
  const begin=patched.indexOf("  // "+MARK);
  const end=patched.indexOf("  if(!open)return null;");
  assert.ok(begin>=0&&end>begin,"extract actual component state/handlers");
  let js=patched.slice(begin,end)
    .replace(/useState<[^>]+>/g,"useState")
    .replace(/useRef<[^>]+>/g,"useRef")
    .replace(/\(call:Call\)/g,"(call)")
    .replace(/\(seconds:number\)/g,"(seconds)")
    .replace(/\(event:KeyboardEvent<HTMLDivElement>\)/g,"(event)")
    .replace(/\(c:any\)/g,"(c)")
    .replaceAll("(supabase as any)","supabase")
    .replaceAll("querySelectorAll<HTMLButtonElement>","querySelectorAll");
  const hooks=[],effects=[];
  const useState=(initial)=>{
    const index=hooks.length;
    hooks.push(typeof initial==="function"?initial():initial);
    return [hooks[index],(value)=>{hooks[index]=typeof value==="function"?value(hooks[index]):value;}];
  };
  const useRef=(initial)=>({current:initial});
  const useEffect=(effect)=>effects.push(effect);
  const useCallback=(fn)=>fn;
  const server={rpc};
  const fakeWindow={setInterval:()=>1,clearInterval:()=>{},requestAnimationFrame:()=>1,cancelAnimationFrame:()=>{}};
  const fakeDocument={activeElement:null};
  const fn=new Function("useState","useRef","useEffect","useCallback","supabase","window","document","navigator",
    "role","online","open","onClose","onAccepted",
    "const [calls,setCalls]=useState([]);const [loading,setLoading]=useState(false);"+
    "const [claiming,setClaiming]=useState(null);\n"+js+
    "\nreturn {refresh,claim,remainingText,stateRef,generationRef,requestRef};");
  const api=fn(useState,useRef,useEffect,useCallback,server,fakeWindow,fakeDocument,{onLine:true},
    "motorista",true,true,()=>{},()=>{});
  return {api,hooks,effects};
}
const row=(id)=>({id,category:"Carro",area:"Centro",pickup_distance_km:1.5,remaining_seconds:15});

test("CV-049 / VIS-050: local remaining time reports seconds, never 1 minute for 1 second",()=>{
  const patched=patchAvailableCalls(baseComponent());
  assert.ok(patched.includes(MARK));
  assert.equal(patchAvailableCalls(patched),patched);
  assert.ok(patched.includes("nowMs-updatedAtMs>20000"));
  assert.ok(patched.includes("remaining(call)===0"));
  const {api}=harness(patched,async()=>({data:[row("a")],error:null}));
  assert.equal(api.remainingText(1),"1 s");
  assert.equal(api.remainingText(0),"Prazo estimado encerrado");
  assert.equal(api.remainingText(61),"1 min 1 s");
  assert.match(patched,/O aceite é conferido novamente no servidor/);
});

test("CV-050 / VIS-051: failing claim remains announced after successful list refresh",async()=>{
  const patched=patchAvailableCalls(baseComponent());
  const {api,hooks}=harness(patched,async(name)=>{
    if(name==="apois_claim_available_ride_call")return {data:null,error:new Error("unavailable")};
    if(name==="apois_list_available_ride_calls")return {data:[row("b")],error:null};
    throw Error("unexpected RPC: "+name);
  });
  await api.claim(row("a"));
  assert.match(hooks[4],/Não foi possível confirmar/,"claim failure retained");
  assert.equal(hooks[3],null,"list error independent");
  assert.equal(hooks[0].length,1,"list refreshed without fake acceptance");
});

test("CV-051 / VIS-052: late online response cannot clear offline notice or repopulate calls",async()=>{
  const pending=deferred();
  const {api,hooks}=harness(patchAvailableCalls(baseComponent()),()=>pending.promise);
  const request=api.refresh();
  api.stateRef.current={open:true,online:false,role:"motorista"};
  hooks[0]=[];
  hooks[3]="Fique ONLINE para consultar solicitações.";
  pending.resolve({data:[row("stale")],error:null});
  await request;
  assert.deepEqual(hooks[0],[]);
  assert.equal(hooks[3],"Fique ONLINE para consultar solicitações.");
});

test("CV-051 / VIS-052: latest request wins when two responses arrive in reverse order",async()=>{
  const first=deferred(),second=deferred();
  let i=0;
  const {api,hooks}=harness(patchAvailableCalls(baseComponent()),()=>++i===1?first.promise:second.promise);
  const older=api.refresh();
  const newer=api.refresh();
  second.resolve({data:[row("new")],error:null});
  await newer;
  first.resolve({data:[row("old")],error:null});
  await older;
  assert.equal(hooks[0][0].id,"new");
});

test("VIS-028 / VIS-004: modal keeps keyboard focus and 44px close target",()=>{
  const src=patchAvailableCalls(baseComponent());
  for(const token of ["previouslyFocused?.focus()","onKeyDown={trapKeys}","ref={closeRef}",
    "min-h-11 rounded-xl","event.key===\"Escape\"","aria-modal=\"true\""]){
    assert.ok(src.includes(token),token);
  }
  const damaged=baseComponent().replace('const claim=async(call:Call)=>{','const claim=async(call:unknown)=>{');
  assert.throws(()=>patchAvailableCalls(damaged),/missing original lifecycle/);
});

test("RV14 Partner: both backends and protected server claims preserved",()=>{
  const orig=baseComponent(),patched=patchAvailableCalls(orig);
  for(const token of ["apois_list_available_ride_calls","apois_list_available_delivery_calls",
    "apois_claim_available_ride_call","apois_claim_available_delivery_call",
    "if(error||!data)throw","onAccepted()","onClose()","remaining_seconds>0"]){
    assert.ok(orig.includes(token)&&patched.includes(token),token);
  }
  const lock=JSON.parse(readFileSync(resolve(root,".apois/source-lock.json"),"utf8"));
  assert.equal(lock.sources.entregas.commit,"2f4606e0fb52dffb49f2e6aebbe921ce687ab625");
});
