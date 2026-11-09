import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, copyFileSync, mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const root=resolve(dirname(fileURLToPath(import.meta.url)),"../..");
const original=resolve(root,"sources/apois-corridas-motorista-admin/src/lib/rideFeatureFlags.ts");
const patch=resolve(root,"scripts/harden-motorista-flags-offline-v1.mjs");
const def={feature_guincho_enabled:false,feature_fretes_enabled:false};

function getPatchedCode(){
  const wd=mkdtempSync(join(tmpdir(),"apois-driver-flags-"));
  try {
    const file=resolve(wd,"src/lib/rideFeatureFlags.ts");
    mkdirSync(dirname(file),{recursive:true});
    copyFileSync(original,file);
    const call=()=>spawnSync(process.execPath,[patch],{
      cwd:root,encoding:"utf8",env:{...process.env,APOIS_MOTORISTA_WORKSPACE:wd}});
    const first=call();
    assert.equal(first.status,0,first.stderr||first.stdout);
    const result=readFileSync(file,"utf8");
    const second=call();
    assert.equal(second.status,0,second.stderr||second.stdout);
    assert.equal(readFileSync(file,"utf8"),result,"patch must be idempotent");
    return result;
  }finally{rmSync(wd,{recursive:true,force:true})}
}

function makeApi(code,rpc){
  const start=code.indexOf("export async function fetchRideFeatureFlags()");
  const body=code.slice(start).replace("export async function fetchRideFeatureFlags(): Promise<RideFeatureFlags>","async function fetchRideFeatureFlags()")
    .replace("(supabase as unknown as FeatureFlagRpcClient).rpc","supabase.rpc")
    .replaceAll("import.meta.env.DEV","false");
  const api=new Function("supabase","DISABLED_RIDE_FEATURE_FLAGS","parseRideFeatureFlags",
    body+"\nreturn fetchRideFeatureFlags;")(
    {rpc},
    def,
    data=>data,
  );
  return api;
}

test("driver signup keeps safe categories on offline rejection",async()=>{
  const code=getPatchedCode();
  assert.match(code,/APOIS_DRIVER_FLAGS_OFFLINE_RECOVERY_V1/);
  const fetch=makeApi(code,async()=>{throw Error("network timeout")});
  assert.deepEqual(await fetch(),def);
});

test("driver feature flags keep successful RPC contract",async()=>{
  const code=getPatchedCode();
  const fetch=makeApi(code,async()=>({data:{
    feature_guincho_enabled:true,feature_fretes_enabled:true
  },error:null}));
  assert.deepEqual(await fetch(),{
    feature_guincho_enabled:true,feature_fretes_enabled:true
  });
});

test("RPC error object disables only gated categories, no uncaught promise",async()=>{
  const fetch=makeApi(getPatchedCode(),async()=>({
    data:null,error:{message:"unauthorized"}
  }));
  assert.deepEqual(await fetch(),def);
});
