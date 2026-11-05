// APOIS_CLIENT_COMFORT_FINISH_V2
// Repair two authenticated Passenger views only, preserving all RPC/ride state.
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
const root=resolve(process.env.APOIS_CORRIDAS_WORKSPACE || ".work/corridas");
const reviewFile=resolve(root,"src/routes/_authenticated.revisar-solicitacao.tsx");
const rideFile=resolve(root,"src/routes/_authenticated.corrida.$rideId.tsx");
function replaceOne(source,from,to,label){
 const count=source.split(from).length-1;
 if(count!==1) throw Error("[FAIL] Passenger V2 "+label+" anchor count="+count);
 return source.replace(from,to);
}
let review=readFileSync(reviewFile,"utf8"),ride=readFileSync(rideFile,"utf8");
if(review.includes("data-apois-comfort-readable-v2")||ride.includes("data-apois-completed-summary-v2"))
 throw Error("[FAIL] Passenger V2 already applied");

const start=review.indexOf('<section data-apois-ride-comfort-prefs-v1');
const end=review.indexOf('</section>',start);
if(start<0||end<start)throw Error("[FAIL] Comfort block boundaries changed");
let box=review.slice(start,end+'</section>'.length);
if(!box.includes('onChange={(event)=>setComfort')||!box.includes('options.map(([value,text])=>'))
 throw Error("[FAIL] Comfort original input handlers changed");
box=replaceOne(box,
 'data-apois-ride-comfort-prefs-v1 className="rounded-2xl border border-[#E00029]/30 bg-zinc-900/80 p-4 space-y-3"',
 'data-apois-ride-comfort-prefs-v1 data-apois-comfort-readable-v2 className="space-y-4 rounded-[24px] border border-[#E2E4E8] bg-white p-5 text-[#111827] shadow-sm"',
 "light comfort card");
box=replaceOne(box,'text-base font-extrabold text-white','text-base font-extrabold text-[#111827]',"title");
box=replaceOne(box,'text-xs text-zinc-300','text-xs font-medium leading-5 text-[#4B5563]',"helper text");
box=replaceOne(box,'text-sm font-semibold text-white','text-sm font-bold text-[#111827]',"field labels");
box=replaceOne(box,'className="min-h-12 w-full rounded-xl border border-zinc-600 bg-zinc-800 px-3 text-sm text-white"',
 'style={{colorScheme:"light"}} className="min-h-12 w-full rounded-xl border border-[#CBD5E1] bg-white px-3 text-sm font-semibold text-[#111827] focus:border-[#C9141B] focus:outline-none focus:ring-2 focus:ring-[#FBCAD0]"',
 "native Android select");
box=replaceOne(box,'<option key={value} value={value}>{text}</option>',
 '<option key={value} value={value} className="bg-white text-[#111827]">{text}</option>',
 "option contrast");
box=replaceOne(box,'className="text-xs text-zinc-400"',
 'className="text-xs font-medium leading-5 text-[#4B5563]"',"footer note");
review=review.slice(0,start)+box+review.slice(end+'</section>'.length);
// Match the footer by its existing submit callback, not a fragile CSS class order.
const confirmAt=review.indexOf('onClick={() => void handleConfirm()}');
if(confirmAt<0)throw Error("[FAIL] Request CTA missing");
const footerStart=review.lastIndexOf('<div className="',confirmAt);
const footerEnd=review.indexOf('">',footerStart)+2;
if(footerStart<0||footerEnd<=footerStart||confirmAt-footerEnd>300)throw Error("[FAIL] Request footer structure changed");
const previousFooter=review.slice(footerStart,footerEnd);
if(!previousFooter.includes('border-t')||!previousFooter.includes('px-5'))throw Error("[FAIL] Request footer did not match original panel");
review=review.slice(0,footerStart)+
  '<div className="sticky bottom-0 z-20 shrink-0 border-t border-[#E2E4E8] bg-white/95 px-5 pt-4 pb-[max(64px,env(safe-area-inset-bottom))] backdrop-blur-xl">'+
  review.slice(footerEnd);
for(const token of ['data-apois-comfort-readable-v2','selectedCategory?.code === "carros"','await confirmRide(comfort)','setComfort((previous)=>({...previous,[key]:event.target.value','air_conditioning','music','conversation'])
 if(!review.includes(token))throw Error("[FAIL] Original comfort functionality missing "+token);
for(const token of ['screenState === "completed"','resetFinishedTripUi();','clearDestination();','clearStops();','clearRoute();','resetRequest();','<PassengerMap','<DriverCard ride={ride} />','onSuccess={() => {'])
 if(!ride.includes(token))throw Error("[FAIL] Original ride lifecycle missing "+token);
ride=replaceOne(ride,
 'import React, { useEffect, useState } from "react";',
 'import React, { useEffect, useRef, useState } from "react";',
 "React useRef");
ride=replaceOne(ride,
 'import { ChevronLeft, Share2, Shield, X, Search, Home, WifiOff, RefreshCw } from "lucide-react";',
 'import { CheckCircle2, ChevronLeft, Share2, Shield, X, Search, Home, WifiOff, RefreshCw } from "lucide-react";',
 "completed icon");
const homeAnchor='  const handleReturnHome = () => {\n    resetFinishedTripUi();\n    void navigate({ to: "/inicio" });\n  };';
ride=replaceOne(ride,homeAnchor,homeAnchor+"\n  // APOIS_CLIENT_COMPLETED_AUTORETURN_V2: server-confirmed finalizada only.\n  // Keep current reset logic; do not redirect during search, trip, or cancel.\n  const finishHomeActionRef = useRef(handleReturnHome);\n  finishHomeActionRef.current = handleReturnHome;\n  useEffect(() => {\n    if (screenState !== \"completed\" || !ride?.id || ride.id !== rideId) return;\n    const timeout = window.setTimeout(() => finishHomeActionRef.current(), 3200);\n    return () => window.clearTimeout(timeout);\n  }, [screenState, ride?.id, rideId]);\n","timed transition to home");
ride=replaceOne(ride,'  if (!ride || !status) return null;\n\n  const hasDriverLocation =',
 '  if (!ride || !status) return null;\n\n'+"  // Terminal view for a server-confirmed completed ride; do not render live map/cards.\n  if (screenState === \"completed\") {\n    const paidTotal = Number(ride.final_price ?? ride.estimated_price);\n    const hasTotal = Number.isFinite(paidTotal) && paidTotal >= 0;\n    return (\n      <main data-apois-completed-summary-v2 className=\"flex min-h-[100dvh] flex-col bg-[#F7F7F8] px-6 pt-[max(4rem,env(safe-area-inset-top))] pb-[max(3.5rem,env(safe-area-inset-bottom))] text-[#111827]\">\n        <div className=\"mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center gap-4 text-center\">\n          <span className=\"grid h-20 w-20 place-items-center rounded-full border border-[#BBF7D0] bg-[#ECFDF5]\" aria-hidden=\"true\">\n            <CheckCircle2 className=\"h-11 w-11 text-[#15803D]\" />\n          </span>\n          <h1 className=\"text-[28px] font-black tracking-tight text-[#111827]\">Viagem concluída</h1>\n          <p className=\"max-w-[300px] text-sm font-medium leading-6 text-[#4B5563]\">Sua corrida foi finalizada. Obrigado por viajar com a APOIS.</p>\n          {hasTotal ? (\n            <div className=\"mt-3 w-full rounded-[22px] border border-[#E2E4E8] bg-white px-5 py-5 shadow-sm\">\n              <p className=\"text-xs font-extrabold uppercase tracking-wider text-[#5B6470]\">Valor da viagem</p>\n              <p className=\"mt-2 text-[30px] font-black text-[#111827]\">\n                {paidTotal.toLocaleString(\"pt-BR\", {style:\"currency\",currency:\"BRL\"})}\n              </p>\n            </div>\n          ) : null}\n          <p className=\"mt-3 text-xs font-semibold text-[#5B6470]\">Voltando automaticamente ao início...</p>\n        </div>\n        <button type=\"button\" onClick={handleReturnHome}\n          className=\"mt-5 flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl bg-[#E51B23] px-5 text-base font-extrabold text-white shadow-sm active:bg-[#C9141B] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C9141B] focus-visible:ring-offset-2\">\n          <Home className=\"h-5 w-5\" aria-hidden=\"true\" /> Voltar ao início\n        </button>\n      </main>\n    );\n  }\n\n"+'  const hasDriverLocation =',
 "render separate completed summary before live map");
const summaryIndex=ride.indexOf('if (screenState === "completed") {');
if(summaryIndex<0||summaryIndex>ride.indexOf('<PassengerMap')||ride.indexOf('data-apois-completed-summary-v2')<summaryIndex)
 throw Error("[FAIL] Terminal screen must precede the live map");
for(const token of ['finishHomeActionRef.current()','window.clearTimeout(timeout)','screenState !== "completed"','onClick={handleReturnHome}'])
 if(!ride.includes(token))throw Error("[FAIL] Completion guard missing "+token);
writeFileSync(reviewFile,review,"utf8");
writeFileSync(rideFile,ride,"utf8");
console.log("[OK] Passenger: high-contrast preferences/Android-safe CTA; dedicated completed summary, auto return after server finalizada.");
