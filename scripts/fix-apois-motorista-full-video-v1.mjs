// APOIS Motorista: correcoes observadas no video 1001992571.mp4.
// Executar APENAS apos hardeners dos modulos em .work/partner-motorista.
// Nao toca no Entregador, API, precos, seguranca ou dados de producao.
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
const root=resolve(process.env.APOIS_MOTORISTA_WORKSPACE || ".work/partner-motorista");
function change(path, transform, signature) {
 const dest=resolve(root,path), prior=readFileSync(dest,"utf8");
 if(prior.includes(signature)) {console.log("[OK] Full video already applied: "+path);return;}
 const next=transform(prior);
 if(next===prior || !next.includes(signature))throw Error("[FAIL] Full video: "+path);
 writeFileSync(dest,next,"utf8");
 console.log("[OK] Full video: "+path);
}
function single(s,old,next,label){
 if(s.split(old).length!==2)throw Error("[FAIL] "+label+" changed");
 return s.replace(old,next);
}
change("src/components/ApoisStatusCheck.tsx",s=>{
  // navigator.onLine pode reportar offline no Android com Supabase operante.
  s=single(s,
    "    setResults(output);setTested(true);setBusy(false);",
    [
     "    // APOIS_DRIVER_TRUE_CONNECTIVITY_VIDEO_V1",
     "    // O WebView pode informar offline mesmo com RPC e sessao validas.",
     "    // Evite falso negativo usando evidencias reais desta rodada.",
     "    if (authenticated || serverReady) {",
     '      output[0]={label:"1. Internet",status:"ok",detail:"Rede confirmada por consulta autenticada ao servidor APOIS."};',
     "    } else if (navigator.onLine) {",
     '      output[0]={label:"1. Internet",status:"unknown",detail:"O aparelho detectou rede, mas a conexao com o servidor nao foi confirmada."};',
     "    }",
     "    setResults(output);setTested(true);setBusy(false);"
    ].join("\n"),"internet diagnostic");
 return s;
},"APOIS_DRIVER_TRUE_CONNECTIVITY_VIDEO_V1");
change("src/components/ApoisAvailableCalls.tsx",s=>{
 const old='const poll=window.setInterval(()=>{if(navigator.onLine)void refresh();},15000);';
 const next='// APOIS_DRIVER_CALLS_POLL_VIDEO_V1: a consulta autenticada e a fonte de verdade; nao confiar em navigator.onLine no WebView.\n    const poll=window.setInterval(()=>{void refresh();},15000);';
 return single(s,old,next,"offer poll");
},"APOIS_DRIVER_CALLS_POLL_VIDEO_V1");
change("src/components/profile/DriverProfessionalProfile.tsx",s=>{
 const old='export function DriverProfessionalProfile({';
 if(!s.includes(old))throw Error("[FAIL] public profile component missing");
 let next=s.replace(old,'// APOIS_DRIVER_PUBLIC_PROFILE_CONTRAST_VIDEO_V1\n'+old);
 // Correcoes de contraste somente no cartao publico do motorista.
 next=next.replaceAll("text-muted-foreground","text-[#596474]")
          .replaceAll("text-foreground","text-[#111827]")
          .replaceAll("bg-background/50","bg-[#F7F7F8]")
          .replaceAll("bg-muted/30","bg-[#F0F2F5]")
          .replaceAll("bg-muted/40","bg-[#E5E7EB]")
          .replaceAll("text-emerald-400","text-emerald-700");
 return next;
},"APOIS_DRIVER_PUBLIC_PROFILE_CONTRAST_VIDEO_V1");
console.log("[OK] APOIS Motorista: diagnostico/consulta de ofertas e contraste do perfil publico ajustados sem gerar app.");
