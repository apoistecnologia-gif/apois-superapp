import {existsSync,readFileSync,writeFileSync} from "node:fs";
import {resolve} from "node:path";
const root=resolve(process.env.APOIS_MOTORISTA_WORKSPACE || ".work/partner-motorista");
const tasks=[
 ["src/routes/admin.dashboard.tsx", [
  ["Dashboard — Admin MOVVI","Dashboard — Admin APOIS"],
  ["Visão geral da operação MOVVI DRIVE em tempo real","Visão geral da operação APOIS Corridas em tempo real"]
 ]],
 ["src/routes/admin.mapa.tsx", [
  ["Mapa ao Vivo — Admin MOVVI","Mapa ao Vivo — Admin APOIS"]
 ]]
];
for(const [relative,edits] of tasks){
 const file=resolve(root,relative);
 if(!existsSync(file))throw Error("[FAIL] Admin Corridas file missing: "+relative);
 const original=readFileSync(file,"utf8");let content=original;
 for(const [a,b] of edits){
  if(content.includes(b))continue;
  if(!content.includes(a))throw Error("[FAIL] Admin brand source changed: "+a);
  content=content.replace(a,b);
 }
 if(content!==original)writeFileSync(file,content,"utf8");
 console.log("[OK] Admin Corridas title APOIS: "+relative);
}