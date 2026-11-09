import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {resolve} from "node:path";
import {test} from "node:test";
import {
  patchPassengerRideRoute,patchRideStatusHeader,ROUTE_MARK,HEADER_MARK
} from "../fix-corridas-active-ride-visual14-v1.mjs";

const root=resolve(import.meta.dirname,"../..");
const workspace=resolve(root,".work/corridas");
const read=path=>readFileSync(resolve(workspace,path),"utf8");
const routePath="src/routes/_authenticated.corrida.$rideId.tsx";
const headerPath="src/components/rides/active/RideStatusHeader.tsx";

test("CV-052 / VIS-053: initial loading is announced once, decorative skeletons are hidden",()=>{
  const source=read(routePath);
  assert.ok(source.includes(ROUTE_MARK));
  assert.equal(patchPassengerRideRoute(source),source,"idempotent passenger route");
  const from=source.indexOf('if (screenState === "loading" || screenState === "idle")');
  const until=source.indexOf('if (screenState === "not_found"');
  assert.ok(from>=0&&until>from);
  const loading=source.slice(from,until);
  assert.ok(loading.includes('role="status" aria-live="polite"'));
  assert.ok(loading.includes("Carregando informações da corrida…"));
  assert.equal((loading.match(/<Skeleton aria-hidden="true"/g)||[]).length,6);
  assert.equal((loading.match(/<Skeleton /g)||[]).length,6);
  assert.ok(source.includes('screenState === "unauthorized"'));
  assert.ok(source.includes('screenState === "failed"'));
});

test("VIS-004/VIS-039: reconnect action remains functional, readable and touchable",()=>{
  const source=read(routePath);
  assert.ok(source.includes('aria-label="Atualizar corrida"'));
  assert.ok(source.includes('onClick={() => void refreshRide()}'));
  assert.ok(source.includes("disabled={isRefreshing}"));
  assert.ok(source.includes('min-h-11 min-w-11'));
  assert.ok(source.includes("break-words text-xs leading-snug text-zinc-400"));
  assert.ok(!source.includes('truncate text-[10px] text-zinc-400'));
});

test("VIS-039: RideStatusHeader subtitle wraps; status switch and ETA remain",()=>{
  const source=read(headerPath);
  assert.ok(source.includes(HEADER_MARK));
  assert.equal(patchRideStatusHeader(source),source);
  assert.ok(source.includes('break-words text-xs leading-snug font-medium text-zinc-400'));
  for(const token of ['case "motorista_chegou"','case "em_viagem"','case "finalizada"',
    "config.title","config.subtitle","isRefreshing","effectiveArrivalMinutes"]){
    assert.ok(source.includes(token),token);
  }
});

test("RV14: build gate is after previous visuals, lock and Maps runtime left intact",()=>{
  const builder=readFileSync(resolve(root,"scripts/build-isolated-module.mjs"),"utf8");
  assert.ok(builder.includes("fix-corridas-active-ride-visual14-v1.mjs"));
  assert.ok(builder.includes("test-corridas-active-ride-visual14-v1.test.mjs"));
  assert.ok(builder.indexOf("fix-corridas-notification-visual11-v1.mjs") <
    builder.indexOf("fix-corridas-active-ride-visual14-v1.mjs"));
  const lock=JSON.parse(readFileSync(resolve(root,".apois/source-lock.json"),"utf8"));
  assert.equal(lock.sources.corridas_passageiro.commit,"7b047f75a1a919a5336c0df6e0d60b14b02f2618");
});
