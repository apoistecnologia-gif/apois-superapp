import assert from "node:assert/strict";
function replaceOnce(s,a,b){
 assert.equal(s.split(a).length,2,"web voice anchor: "+a);
 return s.replace(a,b);
}
export function instrumentWebVoice(source){
 let s=replaceOnce(source,"stop(): Promise<void>;","stop(): Promise<{ stopped?: boolean }>;");
 s=replaceOnce(s,"let enabled = readStoredVoicePreference();",`let enabled = readStoredVoicePreference();
let voiceEpoch = 0;
let guidanceAllowed = true;
let stopPending = 0;
let stopFailed = false;
let ordinaryReset: Promise<boolean> | null = null;
// The future host must coordinate operational alerts and native lease before
// calling these functions. Never change the stored preference for a handoff.
export function setLegacyGuidanceAllowed(value: boolean) {
  guidanceAllowed = value;
  if (!value) voiceEpoch++;
}
export async function stopVoiceForHandoff(): Promise<boolean> {
  voiceEpoch++;
  if (stopPending) return false;
  stopPending++;
  let stopped = false;
  try {
    synth()?.cancel();
    stopped = !nativeVoiceAvailable() || (await NativeDriverVoice.stop())?.stopped === true;
    return stopped;
  } catch { return false; }
  finally { stopFailed = !stopped; stopPending--; }
}
`);
 s=replaceOnce(s,`    synth()?.cancel();
    if (nativeVoiceAvailable()) void NativeDriverVoice.stop().catch(() => undefined);`,`    void stopVoiceForHandoff();`);
 s=replaceOnce(s,`export async function speak(text: string, opts?: { dedupKey?: string; interrupt?: boolean }) {
  if (!enabled || !text) return;`,`export async function speak(text: string, opts?: { dedupKey?: string; interrupt?: boolean; guidance?: boolean }) {
  if (!enabled || !text || (opts?.guidance && !guidanceAllowed)) return;
  const reset = ordinaryReset;
  const beforeReset = voiceEpoch;
  if (reset && await reset !== true) return;
  if (beforeReset !== voiceEpoch || !enabled || stopPending || stopFailed || (opts?.guidance && !guidanceAllowed)) return;
  if (opts?.interrupt) voiceEpoch++;
  const epoch = voiceEpoch;
  const current = () => enabled && !stopPending && !stopFailed && epoch === voiceEpoch &&
    (!opts?.guidance || guidanceAllowed);`);
 s=replaceOnce(s,`      console.warn("[APOIS VOICE] fala nativa falhou; tentando Web Speech", error);`,`      if (!current()) return;
      console.warn("[APOIS VOICE] fala nativa falhou; tentando Web Speech", error);`);
 s=replaceOnce(s,`  await loadVoices();
  const u = new SpeechSynthesisUtterance(text);`,`  await loadVoices();
  if (!current()) return;
  const u = new SpeechSynthesisUtterance(text);`);
 s=replaceOnce(s,`  if (opts?.interrupt) s.cancel();
  s.speak(u);`,`  if (!current()) return;
  if (opts?.interrupt) s.cancel();
  s.speak(u);`);
 s=replaceOnce(s,`  spoken.clear();
  synth()?.cancel();
  if (nativeVoiceAvailable()) void NativeDriverVoice.stop().catch(() => undefined);`,`  spoken.clear();
  const pending = stopVoiceForHandoff();
  ordinaryReset = pending;
  void pending.finally(() => { if (ordinaryReset === pending) ordinaryReset = null; });`);
 s=replaceOnce(s,"if (!steps.length) return;","if (!steps.length || !guidanceAllowed || stopPending || stopFailed) return;");
 s=replaceOnce(s,"{ dedupKey: nowKey }","{ dedupKey: nowKey, guidance: true }");
 s=replaceOnce(s,"{ dedupKey: preKey }","{ dedupKey: preKey, guidance: true }");
 return s;
}
