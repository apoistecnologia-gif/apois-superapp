// APOIS_DRIVER_QA219_ASYNC_RIDE_ACTION_SCOPE_V1
// Prevent a late accept/cancel HTTP response from clearing a newer ride/offer.
// Applied ONLY after QA209 to disposable generated Motorista TSX.
import {readFileSync,writeFileSync} from "node:fs";
import {resolve} from "node:path";
import {fileURLToPath} from "node:url";

export const marker="APOIS_DRIVER_QA219_ASYNC_RIDE_ACTION_SCOPE_V1";
export function patchAsyncRideActions(src) {
  if(src.includes(marker))throw Error("[FAIL] QA219 async ride actions applied twice");
  function section(from,to,edit,label) {
    const a=src.indexOf(from), b=a<0?-1:src.indexOf(to,a+from.length);
    if(a<0||b<=a)throw Error("[FAIL] QA219 "+label+" bounds changed");
    const old=src.slice(a,b),next=edit(old);
    if(old===next)throw Error("[FAIL] QA219 "+label+" unchanged");
    src=src.slice(0,a)+next+src.slice(b);
  }
  function once(s,oldText,newText,label) {
    if(s.split(oldText).length!==2)throw Error("[FAIL] QA219 "+label+" anchor changed");
    return s.replace(oldText,newText);
  }
  section("  async function handleAccept() {","  async function handleReject() {",s=>{
    s=once(s,'      setIncoming(null);',
      '      // '+marker+': accept response only dismisses the offer it accepted.\n'+
      '      setIncoming((current) => current?.id === offer.id ? null : current);',
      "accepted offer cleanup");
    s=once(s,'      setIncoming(offer);',
      '      // A rejected promise must never resurrect an expired or replaced offer.\n'+
      '      setIncoming((current) => current?.id === offer.id ? offer : current);',
      "failed accept restore");
    return s;
  },"async accept");
  section("  async function handleDriverCancelRide(","  // ===== CONTROLADOR ÚNICO DE CÂMERA =====",s=>{
    const old=[
      '      handledRidesRef.current.add(ride.id);',
      '      setActive(null);',
      '      activeRef.current = null;',
      '      clearDriverRouteVisuals();'
    ].join("\n");
    const next=[
      '      handledRidesRef.current.add(ride.id);',
      '      // '+marker+': only the cancelled ride can release its UI and route.',
      '      const isCurrentRide = activeRef.current?.id === ride.id;',
      '      setActive((current) => current?.id === ride.id ? null : current);',
      '      if (isCurrentRide) {',
      '        activeRef.current = null;',
      '        clearDriverRouteVisuals();',
      '      }'
    ].join("\n");
    return once(s,old,next,"driver cancellation cleanup");
  },"async cancellation");
  for(const must of ["onClick={onAccept}","onClick={onReject}","onStart(pinCode)","onClick={handleComplete}","clearDriverRouteVisuals()"])if(!src.includes(must))throw Error("[FAIL] QA219 protected callback disappeared "+must);
  return src;
}
if(process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)){
 const path=resolve(process.env.APOIS_MOTORISTA_WORKSPACE||".work/partner-motorista","src/routes/motorista.app.tsx");
 writeFileSync(path,patchAsyncRideActions(readFileSync(path,"utf8")),"utf8");
 console.log("[OK] QA219 Motorista: late accept/cancel only updates matching ride");
}
