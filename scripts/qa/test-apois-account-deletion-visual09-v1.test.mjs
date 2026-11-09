import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
import vm from "node:vm";
import { patchDriverDialog, patchPassengerDialog, patchDeliveryDeletionFeedback, DRIVER_MARK, PASSENGER_MARK, CUSTOMER_MARK } from "../fix-apois-account-deletion-visual09-v1.mjs";

const base = resolve(fileURLToPath(new URL("../..", import.meta.url)));
const read = p => readFileSync(resolve(base, p), "utf8");
const tick = String.fromCharCode(96);
function driverFixture() {
  const src = read("scripts/fix-partner-motorista-account-deletion-dialog-v4.mjs");
  const modal = src.match(/const modal=\[([\s\S]+?)\]\.join\("\\n"\);/);
  const handler = src.match(/const handler=\[([\s\S]+?)\]\.join\("\\n"\);/);
  assert.ok(modal && handler, "V4 generator changed");
  const generated = m => vm.runInNewContext("[" + m[1] + "].join('\\n')", {}, {timeout:500});
  return [
    'import { useTheme } from "@/lib/theme";',
    'function DriverSettingsPage() {',
    '  const [deleteError, setDeleteError] = useState<string | null>(null);',
    generated(handler),
    '  const hint="Solicitar exclusão com confirmação e retenções legais aplicáveis";',
    '  return (<div>',
    generated(modal),
    '  </div>);',
    '}',
  ].join("\n");
}
function deliveryHandler() {
  const src = read("scripts/harden-entregas-superapp-account-deletion.mjs");
  const start = src.indexOf(tick + '  const requestAccountDeletion = async () => {');
  const end = src.indexOf(tick + ",\n  'Entregas: conta usa solicitação de exclusão", start);
  assert.ok(start > 0 && end > start, "Entregas hardener literal changed");
  return vm.runInNewContext(src.slice(start,end+1), {}, {timeout:500});
}
async function simulate(original, {phrase="EXCLUIR",rpcError=null,signOutError=null,pushError=null, signOutThrows=false}={}) {
  const calls=[], messages=[];
  const src=original.replace(/\(supabase\.rpc as any\)/g,"supabase.rpc");
  const factory=new Function("prompt","supabase","toast","removeCustomerPushRegistration","setDeactivating","navigate","console",
    "let deactivating=false;\n"+src+"\nreturn requestAccountDeletion;");
  const fn=factory(
    async()=>{calls.push("prompt");return phrase===null?null:{confirmation:phrase};},
    {rpc:async name=>{calls.push("rpc:"+name);return {error:rpcError};},
     auth:{signOut:async()=>{calls.push("signOut");if(signOutThrows)throw Error("failed");return {error:signOutError};}}},
    {error:v=>messages.push(v)},
    async isRequired=>{calls.push("removePush:"+isRequired);if(pushError)throw pushError;},
    next=>calls.push("busy:"+next),
    ({to})=>calls.push("navigate:"+to),
    {error:()=>{}});
  await fn();
  return {calls,messages};
}

test("CV-027 Motorista V4: safe focus refs and all guarded RPCs preserved",()=>{
  const before=driverFixture(), after=patchDriverDialog(before);
  assert.ok(after.includes(DRIVER_MARK));
  assert.equal(patchDriverDialog(after),after);
  assert.match(after,/useApoisDeletionDialogFocus\(deleteConfirmOpen\)/);
  assert.match(after,/aria-labelledby="driver-delete-dialog-title" ref=\{deleteDialogRef\} tabIndex=\{-1\}/);
  assert.match(after,/ref=\{deleteCancelRef\} disabled=\{deleting\}/);
  for(const x of ['setDeleteConfirmOpen(true)','deletePhrase.trim() !== "EXCLUIR"',
    'rpc("request_own_account_deletion")','Solicitar exclusão com confirmação e retenções legais aplicáveis'])
    assert.ok(after.includes(x), "V4 required "+x);
  assert.equal((before.match(/rpc\("request_own_account_deletion"\)/g)||[]).length,
    (after.match(/rpc\("request_own_account_deletion"\)/g)||[]).length);
});

test("CV-027 Passageiro: preserve serverConfirmed, EXCLUIR and Cancel action",()=>{
  const before=read("scripts/templates/PassengerAccountDeletion.tsx"),after=patchPassengerDialog(before);
  assert.ok(after.includes(PASSENGER_MARK));
  assert.equal(patchPassengerDialog(after),after);
  for(const x of ['useApoisDeletionDialogFocus(open)','ref={deleteDialogRef}',
    'ref={deleteCancelRef}','tabIndex={-1}','confirmation.trim() !== "EXCLUIR"',
    'deletionClient.rpc("request_own_account_deletion")',
    'serverConfirmed = true;','setCompleted(true);','await onConfirmed();',
    'onClick={close}','disabled={busy || completed}'])
    assert.ok(after.includes(x),"Passenger required "+x);
});

test("CV-027 shared focus helper is isolated from account, auth and deletion operations",()=>{
  const helper=read("scripts/templates/useApoisDeletionDialogFocus.ts");
  for(const x of ["APOIS_CV09_DELETION_FOCUS_V1",
    "cancel.focus({ preventScroll: true })", 'setAttribute("inert", "")',
    'setAttribute("aria-hidden", "true")', 'event.key === "Tab"',
    'event.key === "Escape"', 'event.shiftKey',
    'addEventListener("focusin", handleFocusIn, true)',
    'removeEventListener("keydown", handleKeyDown, true)',
    'opener.focus({ preventScroll: true })',
    'if (!item.wasInert) item.element.removeAttribute("inert")'])
    assert.ok(helper.includes(x),"Focus guard missing "+x);
  assert.doesNotMatch(helper,/\.rpc\(|signOut\(|navigate\(/);
});

test("CV-028 accepted RPC followed by signout failure reports accepted request once",async()=>{
  const before=deliveryHandler(),after=patchDeliveryDeletionFeedback(before);
  assert.ok(after.includes(CUSTOMER_MARK));
  assert.equal(patchDeliveryDeletionFeedback(after),after);
  for (const v of [{signOutError:Error("fail")},{signOutThrows:true}]) {
    const {calls,messages}=await simulate(after,v);
    assert.equal(calls.filter(x=>x.startsWith("rpc:")).length,1);
    assert.equal(calls.filter(x=>x==="signOut").length,1);
    assert.equal(calls.filter(x=>x.startsWith("navigate:")).length,0);
    assert.equal(messages.length,1);
    assert.match(messages[0],/A solicitação de exclusão foi registrada, mas não foi possível concluir a saída da conta/);
    assert.doesNotMatch(messages[0],/Não foi possível solicitar a exclusão da conta/);
  }
});

test("CV-028 cancellation or wrong confirmation do not request deletion; RPC/pre-RPC failures remain honest",async()=>{
  const h=patchDeliveryDeletionFeedback(deliveryHandler());
  for(const phrase of [null,"ERRADO"]) {
    const {calls,messages}=await simulate(h,{phrase});
    assert.equal(calls.filter(x=>x.startsWith("rpc:")).length,0);
    assert.equal(calls.filter(x=>x==="signOut").length,0);
    assert.deepEqual(messages,[]);
  }
  for (const o of [{rpcError:Error("denied")},{pushError:Error("fail")}]) {
    const {calls,messages}=await simulate(h,o);
    assert.equal(calls.filter(x=>x==="signOut").length,0);
    assert.equal(messages[0],"Não foi possível solicitar a exclusão da conta. Tente novamente.");
  }
  const done=await simulate(h);
  assert.deepEqual(done.calls.filter(x=>x.startsWith("rpc:")||x==="signOut"||x.startsWith("navigate:")),
    ["rpc:request_own_account_deletion","signOut","navigate:/login"]);
  assert.deepEqual(done.messages,[]);
});

test("CV-027/028: fail-closed versioning, preserved source-lock and integration order",()=>{
  assert.throws(()=>patchDriverDialog("other"),/baseline/);
  assert.throws(()=>patchPassengerDialog("other"),/baseline/);
  assert.throws(()=>patchDeliveryDeletionFeedback("const deactivateAccount=()=>{};"),/handler missing/);
  assert.throws(()=>patchDriverDialog(DRIVER_MARK),/partial/);
  assert.throws(()=>patchPassengerDialog(PASSENGER_MARK),/partial/);
  assert.throws(()=>patchDeliveryDeletionFeedback(CUSTOMER_MARK),/partial/);
  const p=read("scripts/build-partner-release.sh");
  const c=read("scripts/build-isolated-module.mjs");
  const m=read("scripts/build-merchant-panel.mjs");
  const overlay="fix-apois-account-deletion-visual09-v1.mjs";
  assert.ok(p.indexOf("fix-partner-motorista-account-deletion-dialog-v4.mjs")<p.indexOf(overlay));
  assert.ok(p.indexOf(overlay)<p.indexOf("bun run typecheck"));
  assert.ok(c.indexOf("harden-corridas-profile-account-deletion.mjs")<c.indexOf(overlay));
  assert.ok(m.indexOf("'harden-entregas-superapp-account-deletion.mjs'")<m.indexOf(overlay));
  assert.ok(m.indexOf(overlay)<m.indexOf("['run', 'typecheck']"));
  const lock=JSON.parse(read(".apois/source-lock.json"));
  assert.equal(lock.sources.entregas.commit,"2f4606e0fb52dffb49f2e6aebbe921ce687ab625");
  assert.equal(lock.sources.corridas_passageiro.commit,"7b047f75a1a919a5336c0df6e0d60b14b02f2618");
  assert.equal(lock.sources.corridas_motorista_admin.commit,"9fc171050d8b5703540c49d19a8f1e9f5162775f");
});
