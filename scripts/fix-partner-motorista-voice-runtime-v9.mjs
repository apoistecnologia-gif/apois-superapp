// APOIS_DRIVER_VOICE_RUNTIME_V9 — only generated Motorista worktree.
// A route instruction must not be permanently deduplicated before audio is queued.
import {readFileSync,writeFileSync} from "node:fs";
import {resolve} from "node:path";
const root=resolve(process.env.APOIS_MOTORISTA_WORKSPACE||".work/partner-motorista");
const p=resolve(root,"src/lib/voiceNav.ts");
let src=readFileSync(p,"utf8");
const start=src.indexOf("export async function speak(");
const end=src.indexOf("export function resetSpokenCache()",start);
if(start<0||end<start||end-start>2700)throw Error("[FAIL] Driver voice V9 original speech code not found");
const old=src.slice(start,end);
for(const m of ['NativeDriverVoice.speak','spoken.add(opts.dedupKey)','SpeechSynthesisUtterance','s.speak(u)'])if(!old.includes(m))throw Error("[FAIL] Original driver voice behavior changed: "+m);
const replacement=String.raw`
// APOIS_DRIVER_VOICE_RUNTIME_V9
const pendingVoiceKeys = new Set<string>();
let lastVoiceFailure = 0;
function warnVoiceFailure() {
  if (typeof window === "undefined") return;
  const now = Date.now();
  if (now-lastVoiceFailure < 10000) return;
  lastVoiceFailure = now;
  window.dispatchEvent(new CustomEvent("apois:driver-voice-unavailable"));
}
export async function speak(text: string, opts?: {dedupKey?:string;interrupt?:boolean}): Promise<boolean> {
  const phrase=String(text??"").trim();
  if (!enabled||!phrase)return false;
  const key=opts?.dedupKey?.trim();
  if(key&&(spoken.has(key)||pendingVoiceKeys.has(key)))return false;
  if(key)pendingVoiceKeys.add(key);
  let accepted=false;
  try{
    if(nativeVoiceAvailable()){
      try{
        const state=await NativeDriverVoice.prime();
        if(state?.ready===true){
          const answer=await NativeDriverVoice.speak({text:phrase,interrupt:opts?.interrupt??false});
          accepted=answer?.spoken===true;
        }else console.warn("[APOIS VOICE] Android TTS not ready for pt-BR");
      }catch(error){console.warn("[APOIS VOICE] native TTS failed, checking browser fallback",error);}
    }
    if(!accepted){
      const s=synth();
      if(s){
        try{
          await loadVoices();
          const utterance=new SpeechSynthesisUtterance(phrase);
          if(cachedVoice)utterance.voice=cachedVoice;
          utterance.lang=cachedVoice?.lang??"pt-BR";
          utterance.rate=1.0;utterance.pitch=1.0;utterance.volume=1.0;
          if(opts?.interrupt)s.cancel();
          utterance.onerror=()=>{
            if(key)spoken.delete(key);
            warnVoiceFailure();
          };
          s.speak(utterance);
          accepted=true;
        }catch(error){console.warn("[APOIS VOICE] speech fallback failed",error);}
      }
    }
    if(accepted){
      if(key)spoken.add(key);
    }else warnVoiceFailure();
    return accepted;
  }finally{
    if(key)pendingVoiceKeys.delete(key);
  }
}

`;
src=src.slice(0,start)+replacement+src.slice(end);
for(const m of ["cleanVoiceInstruction","tickNavigation(","NativeDriverVoice.stop()"])if(!src.includes(m))throw Error("[FAIL] Driver navigation speech preserved: "+m);
writeFileSync(p,src,"utf8");
console.log("[OK] Driver V9: native prime checks ready, speech dedup after successful queue, Android voice failure surfaced.");