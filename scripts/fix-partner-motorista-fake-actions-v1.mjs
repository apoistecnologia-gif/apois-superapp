// UI/UX: do not present simulated active actions in production driver journeys.
// Scoped to Driver-only workspace. Do not invent a chat backend or security controls.
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
const root=resolve(process.env.APOIS_MOTORISTA_WORKSPACE || ".work/partner-motorista");
function change(path,transform){
  const current=readFileSync(resolve(root,path),"utf8");
  const next=transform(current);
  if(next===current)throw Error("[FAIL] Driver UI stale action patch unchanged: "+path);
  writeFileSync(resolve(root,path),next,"utf8");
}
change("src/routes/motorista.app.tsx",s=>{
  const old='label="Chat"\n              onClick={() => toast.info("Chat em breve")}';
  const occurrences=s.split(old).length-1;
  if(occurrences!==2)throw Error("[FAIL] Expected exactly two fake chat controls: "+occurrences);
  return s.replaceAll(old,'label="Chat indisponível"\n              disabled');
});
change("src/routes/motorista.configuracoes.tsx",s=>{
  const patterns=[
    /\n\s*<SettingsLinkRow icon=\{Shield\} title="Sessões ativas" hint="Em breve" onClick=\{\(\) => toast\.message\("Sessões ativas em breve\."\)\} \/>/,
    /\n\s*<SettingsLinkRow icon=\{Fingerprint\} title="Autenticação biométrica" hint="Em breve" onClick=\{\(\) => toast\.message\("Biometria em breve\."\)\} \/>/,
    /\n\s*<SettingsLinkRow icon=\{LockKeyhole\} title="Bloqueio por PIN" hint="Em breve" onClick=\{\(\) => toast\.message\("PIN em breve\."\)\} \/>/,
  ];
  for(const pat of patterns){
    if(!pat.test(s))throw Error("[FAIL] Driver simulated security action drift: "+pat);
    s=s.replace(pat,"");
  }
  // Remove imports that are now no longer used; strict TypeScript builds reject them.
  const importEnd=s.indexOf('} from "lucide-react";');
  if(importEnd<0)throw Error("[FAIL] Lucide icon import missing");
  for(const icon of ["Shield","Fingerprint","LockKeyhole"]){
    const afterImport=s.slice(importEnd+'} from "lucide-react";'.length);
    if(!new RegExp("\\b"+icon+"\\b").test(afterImport)){
      const header=s.slice(0,importEnd);
      const expr=new RegExp("\\b"+icon+"\\s*,\\s*");
      if(!expr.test(header))throw Error("[FAIL] Unused icon import not found: "+icon);
      s=header.replace(expr,"")+s.slice(importEnd);
    }
  }
  return s;
});
console.log("[OK] Motorista: chat controls are visibly unavailable, security placeholders absent; real support, PIN do trajeto and sign-out preserved.");
