// RV11 / CV-035 / VIS-036 Passenger notification read state: SR-only status.
import {readFileSync,writeFileSync} from "node:fs";
import {resolve} from "node:path";
import {fileURLToPath} from "node:url";
export const MARK="APOIS_CV11_PASSENGER_NOTIFICATION_READ_V1";
export function patchPassengerNotification(s){
 if(s.includes(MARK)){
  for(const x of ['{unread ? "Não lida. " : "Lida. "}','markAsRead(notification.id)'])
   if(!s.includes(x))throw Error("[CV11] partial passenger notification patch "+x);
  return s;
 }
 const anchor='              >\n                <div className="flex items-start gap-3">';
 const n=s.split(anchor).length-1;
 if(n!==1||!s.includes('if (unread) void markAsRead(notification.id);'))throw Error("[CV11] passenger source drift "+n);
 return s.replace(anchor,
   '              >\n                <span className="sr-only" data-apois-cv11="APOIS_CV11_PASSENGER_NOTIFICATION_READ_V1">{unread ? "Não lida. " : "Lida. "}</span>\n                <div className="flex items-start gap-3">');
}
export function applyVisual11Passenger(root=process.cwd()){
 const path=resolve(root,process.env.APOIS_CORRIDAS_WORKSPACE||".work/corridas","src/routes/_authenticated.notificacoes.tsx");
 const before=readFileSync(path,"utf8"),after=patchPassengerNotification(before);
 if(after!==before)writeFileSync(path,after,"utf8");
 return before!==after;
}
if(process.argv[1]&&fileURLToPath(import.meta.url)===resolve(process.argv[1]))
 console.log("[OK] RV11 Passenger notifications",applyVisual11Passenger()?"updated":"already applied");
