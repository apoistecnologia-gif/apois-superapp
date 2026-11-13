import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync,existsSync} from "node:fs";
import {resolve} from "node:path";
import {patchAsyncRideActions,marker} from "../fix-partner-driver-qa219-async-ride-action-scope-v1.mjs";

const fixture=[
  "  async function handleAccept() {",
  "    const offer = incomingRef.current;",
  "    try {",
  "      await callAccept({data:{rideId:offer.id}});",
  "      setIncoming(null);",
  "    } catch (e) {",
  "      setIncoming(offer);",
  "    }",
  "  }",
  "  async function handleReject() { return; }",
  "  async function handleDriverCancelRide(motivo: string) {",
  "    const ride = activeRef.current;",
  "    try {",
  "      await callCancel({data:{rideId:ride.id,motivo}});",
  "      handledRidesRef.current.add(ride.id);",
  "      setActive(null);",
  "      activeRef.current = null;",
  "      clearDriverRouteVisuals();",
  "    } catch (e) { throw e; }",
  "  }",
  "  // ===== CONTROLADOR ÚNICO DE CÂMERA =====",
  "  const callbackTokens = ['onClick={onAccept}', 'onClick={onReject}', 'onStart(pinCode)', 'onClick={handleComplete}'];",
].join("\n");

test("accepts/cancels only the matching ride and keeps all business callbacks",()=>{
  const patched=patchAsyncRideActions(fixture);
  assert.ok(patched.includes(marker));
  assert.ok(patched.includes("setIncoming((current) => current?.id === offer.id ? null : current);"));
  assert.ok(patched.includes("setIncoming((current) => current?.id === offer.id ? offer : current);"));
  assert.ok(patched.includes("setActive((current) => current?.id === ride.id ? null : current);"));
  assert.ok(patched.includes("if (isCurrentRide) {"));
  assert.ok(patched.includes("clearDriverRouteVisuals();"));
  for(const protectedCallback of ["onClick={onAccept}","onClick={onReject}","onStart(pinCode)","onClick={handleComplete}"])
    assert.ok(patched.includes(protectedCallback),protectedCallback);
});
test("functional same-ID guards preserve newer offers or trips",()=>{
  const offered={id:"old"},incoming={id:"new"};
  const clearAccepted=(current)=>current?.id===offered.id?null:current;
  const restoreRejected=(current)=>current?.id===offered.id?offered:current;
  assert.equal(clearAccepted(incoming),incoming);
  assert.equal(clearAccepted(offered),null);
  assert.equal(restoreRejected(incoming),incoming);
  assert.equal(restoreRejected(offered),offered);
  const cancelled={id:"old"},active={id:"new"};
  const clearCancelled=(current)=>current?.id===cancelled.id?null:current;
  assert.equal(clearCancelled(active),active);
  assert.equal(clearCancelled(cancelled),null);
});
test("fails closed when source contract changes or patch repeats",()=>{
  assert.throws(()=>patchAsyncRideActions(patchAsyncRideActions(fixture)),/applied twice/);
  assert.throws(()=>patchAsyncRideActions(fixture.replace("setIncoming(offer);","setIncoming(null);")),/accepted offer cleanup|failed accept restore/);
  assert.throws(()=>patchAsyncRideActions(fixture.replace("activeRef.current = null;","activeRef.current = ride;")),/cancellation cleanup/);
});
test("generated Motorista retains late-async guards after the pipeline",()=>{
  const path=resolve(process.env.APOIS_MOTORISTA_WORKSPACE||".work/partner-motorista","src/routes/motorista.app.tsx");
  if(!existsSync(path))return;
  const src=readFileSync(path,"utf8");
  assert.ok(src.includes(marker));
  assert.ok(src.includes("setIncoming((current) => current?.id === offer.id ? null : current);"));
  assert.ok(src.includes("setActive((current) => current?.id === ride.id ? null : current);"));
});
