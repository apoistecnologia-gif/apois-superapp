import test from "node:test";import assert from "node:assert/strict";
import {readFileSync} from "node:fs";import {resolve} from "node:path";
const root=resolve(process.env.APOIS_MOTORISTA_WORKSPACE||".work/partner-motorista");
const read=p=>readFileSync(resolve(root,p),"utf8");
const s=read("src/routes/motorista.app.tsx"),css=read("src/styles.css");
const i=s.indexOf("function ActiveRidePanel("),j=s.indexOf("\nfunction ActionButton(",i);
assert.ok(i>0&&j>i);const p=s.slice(i,j);
test("QA185 78dvh sheet replaced by map-first 39dvh and accessible actions",()=>{
 for(const x of ['snaps={[39, 62, 88]} initial={39}','data-apois-waiting-comfort-v1',
 'data-apois-waiting-actions-v1','pb-[136px]','createPortal(cancelRideDialog, document.body)',
 'setPinOpen(true)','setCancelOpen(true)'])assert.ok((s+p).includes(x),x);
});
test("PIN keyboard starts only on touch and server validation survives",()=>{
 const pin=p.slice(p.indexOf("data-apois-pin-v4"));
 for(const x of ['label htmlFor="apois-motorista-pin-v4"','id="apois-motorista-pin-v4"',
 'inputMode="numeric"','maxLength={4}','onStart(pinCode)','overflow-y-auto overscroll-contain'])
 assert.ok(p.includes(x),x);
 assert.ok(!/autoFocus\s+maxLength=\{4\}/.test(pin));
 assert.ok(pin.includes('sm:items-center"'),"PIN portal className closes before onClick");
 assert.ok(pin.includes('scroll-mt-24"'),"PIN input className closes before next attribute");
 assert.ok(css.includes('[data-apois-pin-v4] label:focus-within'));
});
test("passenger RLS, raster map, accept, finish, ratings preserved",()=>{
 for(const x of ["APOIS_ASSIGNED_PASSENGER_V6","apois_driver_assigned_passenger",
 "Nome indisponível","callStart({ data:","callComplete({ data:","callRate({ data:",
 "onClick={onAccept}","onClick={onReject}","applyNavigationCamera(","DriverMapErrorBoundary"])
 assert.ok(s.includes(x),x);
 assert.ok(read("src/components/MovviMap.tsx").includes("renderingType: undefined"));
 assert.ok(read("src/components/ApoisRideComfortCard.tsx").includes('no_preference:"indiferente"'));
});
