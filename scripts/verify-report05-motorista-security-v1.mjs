// Relatorio 05: executable contract tests against the generated Motorista code.
// All GPS, Share, Clipboard and SOS interactions below are synthetic in memory.
// Do not call Supabase, phone numbers, browser APIs or platform services.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root=resolve(process.cwd(),process.env.APOIS_MOTORISTA_WORKSPACE||".work/partner-motorista");
const safety=readFileSync(resolve(root,"src/routes/motorista.seguranca.tsx"),"utf8");
const settings=readFileSync(resolve(root,"src/routes/motorista.configuracoes.tsx"),"utf8");
const classifier=readFileSync(resolve(root,"src/lib/partnerLocationPermission.ts"),"utf8");
let checks=0;
function ok(cond,label){assert.ok(cond,label);checks++;}
ok(safety.includes("APOIS_REPORT05_SECURITY_V1"),"INV05 patch missing");
ok(settings.includes("APOIS_REPORT05_LOCATION_DIAGNOSTIC_V1"),"Settings patch missing");
ok(safety.includes("getPartnerCurrentPosition(5000).catch(() => null)"),"SOS without coordinates must remain");
ok(safety.includes('description: hasValidPosition ? (coords?.permission==="approximate"'),"SOS approximate disclosure");
ok(!safety.includes(".slice(0, 15)"),"Phone silent truncation survived");
ok(safety.includes("Link de localização para copiar manualmente"),"Manual copy input missing");
ok(settings.includes('locState === "approximate"'),"Settings must display approximate state");

const phoneStart=safety.indexOf("function normalizePhone(");
const phoneEnd=safety.indexOf("\nfunction safeContactName(",phoneStart);
ok(phoneStart>=0&&phoneEnd>phoneStart,"Phone function limits");
const phoneJS=safety.slice(phoneStart,phoneEnd)
  .replace("value: unknown","value").replace("value: string","value")
  .replace("): string",")").replace("): boolean",")");
const {normalizePhone,isUsablePhone}=new Function(phoneJS+"\nreturn { normalizePhone, isUsablePhone };")();
for(const [raw,normalized,valid] of [
  ["(87) 99999-9999","87999999999",true],
  ["+55 (87) 99999-9999","+5587999999999",true],
  ["+1234567890123456","",false],
  ["+12+3456789012","",false],
  ["123 abc 456 7890","",false],
  ["","",false],
  ["12345678","12345678",true],
]){
 const n=normalizePhone(raw);
 assert.equal(n,normalized,"phone input "+raw);assert.equal(isUsablePhone(n),valid,"phone validity "+raw);checks+=2;
}
const fnSrc=classifier.slice(classifier.indexOf("export function classifyPartnerLocationPermission"));
const fnJS=fnSrc.replace(/export function classifyPartnerLocationPermission\([^)]*\): PartnerLocationPermission/,
  "function classifyPartnerLocationPermission(status)");
const classify=new Function(fnJS+"\nreturn classifyPartnerLocationPermission;")();
ok(classify({location:"granted",coarseLocation:"granted"})==="precise","fine permission");
ok(classify({location:"denied",coarseLocation:"granted"})==="approximate","coarse permission");
ok(classify({location:"denied",coarseLocation:"denied"})==="denied","no permission");

const gpsStart=safety.indexOf("async function getPartnerCurrentPosition(");
const gpsEnd=safety.indexOf("\nfunction DriverSecurityPage()",gpsStart);
ok(gpsStart>=0&&gpsEnd>gpsStart,"Native location helper present");
const gpsJS=safety.slice(gpsStart,gpsEnd)
  .replace("async function getPartnerCurrentPosition(timeout = 8000): Promise<SafetyPosition>",
    "async function getPartnerCurrentPosition(timeout = 8000)")
  .replace("new Promise<GeolocationPosition>", "new Promise");
function createGps(initial,requested,impl,opts={}){
 let prompted=0,queried=0,high=null;
 const geo={
  async checkPermissions(){return initial;},
  async requestPermissions(){prompted++;return requested;},
  async getCurrentPosition(options){queried++;high=options.enableHighAccuracy;if(impl)throw impl;return {coords:{latitude:-9.38,longitude:-40.50}}}
 };
 const cap={isNativePlatform:()=>true};
 const get=new Function("Capacitor","Geolocation","classifyPartnerLocationPermission","navigator",
  gpsJS+"\nreturn getPartnerCurrentPosition;")(cap,geo,classify,undefined);
 return {get,stats:()=>({prompted,queried,high})};
}
let c=createGps({location:"granted",coarseLocation:"granted"},null);
assert.equal((await c.get()).permission,"precise");assert.deepEqual(c.stats(),{prompted:0,queried:1,high:true});checks++;
c=createGps({location:"denied",coarseLocation:"granted"},null);
assert.equal((await c.get()).permission,"approximate");assert.deepEqual(c.stats(),{prompted:0,queried:1,high:false});checks++;
c=createGps({location:"denied",coarseLocation:"denied"},{location:"denied",coarseLocation:"denied"});
await assert.rejects(()=>c.get(),/location_permission_denied/);assert.deepEqual(c.stats(),{prompted:1,queried:0,high:null});checks++;
c=createGps({location:"denied",coarseLocation:"denied"},{location:"denied",coarseLocation:"granted"});
assert.equal((await c.get()).permission,"approximate");assert.deepEqual(c.stats(),{prompted:1,queried:1,high:false});checks++;
for(const failure of ["OS-PLUG-GLOC-0007","OS-PLUG-GLOC-0010"]){
 c=createGps({location:"granted",coarseLocation:"granted"},null,new Error(failure));
 await assert.rejects(()=>c.get(),new RegExp(failure));checks++;
}

// Evaluate the real event handlers isolated from React; no actual browser/clipboard.
const shareStart=safety.indexOf("  async function shareLocation(): Promise<void> {");
const shareEnd=safety.indexOf("\n  return (\n    <div",shareStart);
ok(shareStart>0&&shareEnd>shareStart,"share handler extraction");
const shareJS=safety.slice(shareStart,shareEnd)
  .replace("async function shareLocation(): Promise<void>","async function shareLocation()")
  .replace("async function copyPreparedLocationLink():Promise<void>","async function copyPreparedLocationLink()")
  .replaceAll("import.meta.env.DEV","false");
function shareHarness({share,error,clipboard=true}){
 let fallback=null,busy=false,copies=0,shares=0;
 const messages=[];
 const navigator={};
 if(share)navigator.share=async()=>{shares++;if(error)throw Object.assign(new Error(error),{name:error});};
 navigator.clipboard=clipboard?{writeText:async()=>{copies++}}:undefined;
 const toast={error:m=>messages.push(m),message:m=>messages.push(m),success:m=>messages.push(m)};
 const make=()=>new Function("setSharingLocation","setShareFallback","sharingLocation","shareFallback","getPartnerCurrentPosition","validCoordinate","navigator","toast","console",
  shareJS+"\nreturn {shareLocation,copyPreparedLocationLink};")(
   v=>{busy=v},v=>{fallback=v},busy,fallback,
   async()=>({latitude:-9.38,longitude:-40.5,permission:"approximate"}),
   (a,b)=>Number.isFinite(a)&&Number.isFinite(b),navigator,toast,{warn(){}}
  );
 return {make,stats:()=>({fallback,copies,shares,busy,messages})};
}
let h=shareHarness({share:true});
await h.make().shareLocation();
ok(h.stats().shares===1&&h.stats().copies===0&&h.stats().fallback===null,"Successful share");
h=shareHarness({share:true,error:"AbortError"});
await h.make().shareLocation();
ok(h.stats().copies===0&&h.stats().fallback===null,"Abort never copies or offers stale link");
h=shareHarness({share:true,error:"NotAllowedError"});
await h.make().shareLocation();
ok(h.stats().copies===0&&h.stats().fallback?.permission==="approximate","NotAllowedError offers link only");
await h.make().copyPreparedLocationLink();
ok(h.stats().copies===1&&h.stats().fallback===null,"Explicit gesture copies and closes link");
h=shareHarness({share:false});
await h.make().shareLocation();
ok(h.stats().copies===0&&!!h.stats().fallback,"Missing Web Share requires explicit copy");
h=shareHarness({share:true,error:"NotAllowedError",clipboard:false});
await h.make().shareLocation();
await h.make().copyPreparedLocationLink();
ok(h.stats().copies===0&&!!h.stats().fallback&&h.stats().messages.some(x=>x.includes("Selecione")),
  "Clipboard denied retains link for manual selection");

console.log("[OK] INV-049/050/051: "+checks+" simulated assertions from the generated source. Zero external operations.");
