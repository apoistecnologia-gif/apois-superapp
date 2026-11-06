// APOIS_DRIVER_VOICE_TEST_UI_V9 — a visible TTS preference does not prove audible speech.
import {readFileSync,writeFileSync} from "node:fs";
import {resolve} from "node:path";
const root=resolve(process.env.APOIS_MOTORISTA_WORKSPACE||".work/partner-motorista");
const uiPath=resolve(root,"src/components/DriverVoiceToggle.tsx");
let ui=readFileSync(uiPath,"utf8");
if(!ui.includes("Voz ligada")||!ui.includes("setVoiceEnabled(next)"))throw Error("[FAIL] Driver V9 voice preference label/callback missing");
function one(before,after,label){let n=ui.split(before).length-1;if(n!==1)throw Error("[FAIL] Driver V9 "+label+" "+n);ui=ui.replace(before,after);}
one('import { isVoiceEnabled, setVoiceEnabled, speak } from "@/lib/voiceNav";',
'import { isVoiceEnabled, setVoiceEnabled, speak, primeVoice } from "@/lib/voiceNav";\nimport { toast } from "sonner";',"voice import");
one('      await speak("Voz de navegação ativada.", { interrupt: true });',
'      await primeVoice();\n      const accepted = await speak("Voz de navegação APOIS ativada.", { interrupt: true });\n      if (!accepted) toast.warning("Não foi possível iniciar a voz. Confira o mecanismo de texto para fala em português do Android.");',"activation feedback");
const before='  if (!visible) return null;';
one(before,[
'  const testVoice = async () => {',
'    if (announcing || !enabled) return;',
'    setAnnouncing(true);',
'    try {',
'      await primeVoice();',
'      const queued = await speak("Teste de navegação APOIS. Em duzentos metros, siga em frente.", { interrupt: true });',
'      if (!queued) toast.error("Voz indisponível. Confira a saída de áudio e a leitura de texto em português do Android.");',
'    } catch { toast.error("Falha no teste de voz do aparelho."); }',
'    finally { setAnnouncing(false); }',
'  };',
'',
before,
].join("\n"),"test action");
one('  return (\n    <button','  return (\n    <div data-apois-driver-voice-test-v9 className="fixed z-[46] flex items-center gap-2" style={{ top:"max(160px, calc(env(safe-area-inset-top) + 158px))", right:"max(1rem, env(safe-area-inset-right))" }}>\n    <button',"wrap voice preference");
one('className="fixed z-[46] flex min-h-11','className="flex min-h-11',"move fixed to container");
// The older label hardener places the top/right inline on the inner button.
const position=/      style=\{\{\s*top: "calc\(env\(safe-area-inset-top\) \+ 158px\)",\s*right: "max\(1rem, env\(safe-area-inset-right\)\)",\s*\}\}/;
if(!position.test(ui))throw Error("[FAIL] Driver V9 legacy position on voice button changed");
ui=ui.replace(position,"");
one('    </button>\n  );',
'    </button>\n    <button type="button" onClick={() => void testVoice()} disabled={!enabled || announcing} aria-label="Testar voz de navegação" className="min-h-11 rounded-xl border border-[#E5E7EB] bg-white px-3 text-xs font-extrabold text-[#B91C1C] shadow-md disabled:opacity-50">Testar voz</button>\n    </div>\n  );',"audible test button");
writeFileSync(uiPath,ui,"utf8");
// Report voice failures in a readable toast without altering voice preference.
const appPath=resolve(root,"src/routes/motorista.app.tsx");
let app=readFileSync(appPath,"utf8");
const hook='  useEffect(() => { void primeVoice(); }, []);';
const count=app.split(hook).length-1;
if(count!==1)throw Error("[FAIL] Driver V9 route prime hook anchor "+count);
app=app.replace(hook,hook+"\n"+[
'  useEffect(() => {',
'    const onVoiceUnavailable = () => toast.warning("Navegação por voz indisponível.", {',
'      id:"apois-driver-voice-unavailable",',
'      description:"Toque em Testar voz e confira a leitura de texto em português nas configurações do Android.",',
'      duration:6000,',
'    });',
'    window.addEventListener("apois:driver-voice-unavailable",onVoiceUnavailable);',
'    return () => window.removeEventListener("apois:driver-voice-unavailable",onVoiceUnavailable);',
'  }, []);',
].join("\n"));
writeFileSync(appPath,app,"utf8");
console.log("[OK] Driver V9: can test audible voice, reacts to unavailable native TTS and preserves toggle preference.");