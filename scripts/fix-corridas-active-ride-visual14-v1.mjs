// APOIS RV-14: Passenger loading/reconnect presentation on disposable .work/corridas.
import {readFileSync,writeFileSync} from "node:fs";
import {resolve} from "node:path";
import {fileURLToPath} from "node:url";

export const ROUTE_MARK="APOIS_CV14_PASSENGER_LOADING_V1";
export const HEADER_MARK="APOIS_CV14_RIDE_STATUS_WRAP_V1";

function once(src,before,after,label){
  const n=src.split(before).length-1;
  if(n!==1)throw Error("[RV14 passenger] "+label+" count="+n);
  return src.replace(before,after);
}
export function patchPassengerRideRoute(source){
  if(source.includes(ROUTE_MARK)){
    for(const m of ['aria-hidden="true" className="h-10','Carregando informações da corrida',
      'aria-label="Atualizar corrida"','min-h-11 min-w-11','break-words text-xs leading-snug']){
      if(!source.includes(m))throw Error("[RV14 passenger] incomplete route "+m);
    }
    return source;
  }
  const begin='  if (screenState === "loading" || screenState === "idle") {';
  const next='  if (screenState === "not_found" || screenState === "unauthorized" || screenState === "failed") {';
  const start=source.indexOf(begin),end=source.indexOf(next);
  if(start<0||end<start||source.indexOf(begin,start+1)!==-1||source.indexOf(next,end+1)!==-1)
    throw Error("[RV14 passenger] loading boundary drift");
  let block=source.slice(start,end);
  const count=block.split('<Skeleton className=').length-1;
  if(count!==5)throw Error("[RV14 passenger] expected five decorative skeletons, found "+count);
  block=once(block,
    '<div className="flex h-[100dvh] flex-col space-y-6 bg-black p-6">',
    '<div className="flex h-[100dvh] flex-col space-y-6 bg-black p-6">\n'+
    '        {/* '+ROUTE_MARK+' */}\n'+
    '        <p role="status" aria-live="polite" className="text-sm font-medium text-white">Carregando informações da corrida…</p>',
    "loading status");
  block=block.replaceAll('<Skeleton className=','<Skeleton aria-hidden="true" className=');
  source=source.slice(0,start)+block+source.slice(end);
  source=once(source,
    '<p className="truncate text-[10px] text-zinc-400">',
    '<p className="break-words text-xs leading-snug text-zinc-400">',
    "reconnect description");
  source=once(source,
    'className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/10 disabled:opacity-50"',
    'className="flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-full bg-white/10 disabled:opacity-50"',
    "reconnect refresh touch target");
  return patchPassengerRideRoute(source);
}
export function patchRideStatusHeader(source){
  if(source.includes(HEADER_MARK)){
    if(!source.includes('break-words text-xs leading-snug'))throw Error("[RV14 passenger] incomplete header");
    return source;
  }
  source=once(source,
    '<p className="truncate text-xs font-medium text-zinc-400">{config.subtitle}</p>',
    '<p className="break-words text-xs leading-snug font-medium text-zinc-400">{config.subtitle}</p>',
    "status subtitle wrap");
  return "// "+HEADER_MARK+"\n"+source;
}
export function applyVisual14Passenger(root=process.cwd()){
  const files=[
    ["src/routes/_authenticated.corrida.$rideId.tsx",patchPassengerRideRoute],
    ["src/components/rides/active/RideStatusHeader.tsx",patchRideStatusHeader],
  ];
  const work=resolve(root,".work/corridas");
  const plans=files.map(([name,patch])=>{
    const path=resolve(work,name),before=readFileSync(path,"utf8"),after=patch(before);
    if(patch(after)!==after)throw Error("[RV14 passenger] non-idempotent "+name);
    return {path,name,before,after};
  });
  for(const p of plans)if(p.before!==p.after)writeFileSync(p.path,p.after,"utf8");
  return plans.map(p=>({file:p.name,changed:p.before!==p.after}));
}
if(process.argv[1]&&fileURLToPath(import.meta.url)===resolve(process.argv[1])){
  console.log("[OK] RV14 Passenger loading",JSON.stringify(applyVisual14Passenger()));
}
