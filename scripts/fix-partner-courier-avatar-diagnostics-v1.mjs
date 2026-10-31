import {readFileSync,writeFileSync} from "node:fs";
import {resolve} from "node:path";

const filepath=resolve(process.env.APOIS_ENTREGAS_WORKSPACE || ".work/partner-entregador","src/components/CourierPanels.tsx");
let source=readFileSync(filepath,"utf8");
const before='      toast.error("O envio da foto não foi autorizado ou falhou. Tente novamente.");';
const after=[
'      // APOIS_COURIER_AVATAR_UPLOAD_DIAGNOSTIC_V1: do not hide a server policy rejection as a random failure.',
'      const uploadProblem = String(uploaded.error.message ?? "");',
'      const uploadStatus = String((uploaded.error as { statusCode?: string | number }).statusCode ?? "");',
'      const accessDenied = /row.?level|polic|unauthoriz|permission|forbidden|403|42501/i.test(uploadProblem + " " + uploadStatus);',
'      toast.error(accessDenied',
'        ? "Envio bloqueado pela permissão do servidor. O suporte APOIS precisa liberar o envio da sua própria foto."',
'        : "Não foi possível enviar a foto. Confira a conexão e tente novamente.");'
].join("\n");
if(!source.includes(after)){
 if(!source.includes(before))throw Error("[FAIL] Courier avatar error path changed; refusing unsafe patch");
 source=source.replace(before,after);
}
for(const marker of ['user.id + "/courier-profile/"','upsert: false','profiles','APOIS_COURIER_AVATAR_UPLOAD_DIAGNOSTIC_V1']){
 if(!source.includes(marker))throw Error("[FAIL] Courier profile lost protected marker "+marker);
}
writeFileSync(filepath,source,"utf8");
console.log("[OK] Courier avatar diagnostics: rejects unauthorized storage gracefully, preserves photo flow");
