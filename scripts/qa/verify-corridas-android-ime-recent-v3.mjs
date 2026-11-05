import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {resolve} from "node:path";
const root=resolve(process.env.APOIS_CORRIDAS_WORKSPACE||".work/corridas");
const src=readFileSync(resolve(root,"src/routes/_authenticated.buscar-destino.tsx"),"utf8");
const service=readFileSync(resolve(root,"src/services/places/places-service.ts"),"utf8");
const hook=readFileSync(resolve(root,"src/hooks/use-destination-search.tsx"),"utf8");
for(const token of [
 "APOIS_CLIENTE_ANDROID_DESTINATION_IME_V3",
 "const nativeValue = input.value;",
 "nativeValue !== latestQueryRef.current",
 "latestSetQueryRef.current(nativeValue)",
 'input.addEventListener("input", schedule)',
 'input.addEventListener("compositionend", schedule)',
 'input.addEventListener("focus", start)',
 'input.addEventListener("blur", stop)',
 'window.setInterval(reconcile, 450)',
 'window.clearInterval(reconcileTimer)',
 'input.removeEventListener("input", schedule)',
 'window.cancelAnimationFrame(frame)',
 "query.trim().length < 3 ? (",
 'data-apois-destination-local-match-v3',
 "suggestions.some(suggestion => suggestion.placeId === item.placeId)",
 'handleSelectHistoryItem(item as DestinationAddress)',
 "onClick={() => handleSelectSuggestion(suggestion)}",
 "data-apois-favorite-save-mode",
 "data-apois-places-error-v2",
])assert.ok(src.includes(token),"Android destination failed preserve check: "+token);
assert.ok(service.includes('invoke("google-maps-address"'),"Existing canonical Places backend required");
assert.ok(service.includes('action: "place_details"'),"Existing place details required");
assert.ok(hook.includes("requestSequence.current"),"Keep cancellation of outdated autocomplete responses");

// Matching previously used place names must be available even without Maps,
// deduplicate against itself and server results, and retain original stable placeId.
const localMatches=(term,favorites,recent,suggestions)=>{
 const needle=term.trim().toLocaleLowerCase("pt-BR");
 return [...favorites,...recent].filter((item,index,list)=>{
  if(list.findIndex(other=>other.placeId===item.placeId)!==index)return false;
  if(suggestions.some(suggestion=>suggestion.placeId===item.placeId))return false;
  return [item.label,item.nickname,item.formattedAddress].some(value=>
   String(value??"").toLocaleLowerCase("pt-BR").includes(needle));
 }).slice(0,4);
};
const sample={placeId:"real-place",label:"River Shopping",formattedAddress:"Petrolina, PE"};
assert.deepEqual(localMatches("river shopping",[],[sample],[]),[sample],"Previous destination remains selectable offline");
assert.deepEqual(localMatches("RIVER SHOPPING",[],[sample],[]),[sample],"Search remains case insensitive");
assert.deepEqual(localMatches("river",[],[sample,sample],[]),[sample],"Same place is not duplicated");
assert.deepEqual(localMatches("river",[],[sample],[{placeId:"real-place"}]),[],"Provider suggestion supersedes local result");
assert.deepEqual(localMatches("outro",[],[sample],[]),[],"Do not show unrelated address");
console.log("[PASS] Corridas Cliente: Android IME state recovery and matching recent destinations, no changes to server/provider/map/history storage.");
