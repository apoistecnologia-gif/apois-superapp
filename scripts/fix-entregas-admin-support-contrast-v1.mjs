import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
// Pure CSS/text-size adjustment in the isolated admin WEB build.
const file=resolve(process.env.APOIS_ENTREGAS_WORKSPACE || ".work/entregas","src/components/AdminSupportPanel.tsx");
if(!existsSync(file))throw Error("[FAIL] Admin Support source missing");
const initial=readFileSync(file,"utf8");
let code=initial;
for(const [oldStyle,newStyle] of [
  ["text-zinc-600","text-[#CBD5E1]"],
  ["text-zinc-700","text-[#CBD5E1]"],
  ["text-[10px]","text-xs"],
  ["text-[9px]","text-[11px]"]
]){
 if(!code.includes(oldStyle) && !code.includes(newStyle))throw Error("[FAIL] Support style source absent: "+oldStyle);
 code=code.split(oldStyle).join(newStyle);
}
for(const required of [
 "onClick={() => void onReply(ticket, false)}",
 "onClick={() => void onReply(ticket, true)}",
 "onClick={() => void onStatus(ticket, \"in_progress\")}",
 "onClick={() => void onStatus(ticket, \"resolved\")}",
 "onClick={() => void onStatus(ticket, \"closed\")}",
 "onClick={() => void openSupportAttachment(path)}",
 '.from("support-attachments")',
 '.createSignedUrl(path, 60)',
 'anchor.rel = "noopener noreferrer"',
 'ticket.support_messages',
 'ticket.requester_user_id'
]){
 if(!initial.includes(required)||!code.includes(required))
  throw Error("[FAIL] Admin Support functional/security behavior lost: "+required);
}
for(const oldStyle of ["text-zinc-600","text-zinc-700","text-[9px]","text-[10px]"])
 if(code.includes(oldStyle))throw Error("[FAIL] Support still contains old low-contrast metadata "+oldStyle);
if(code!==initial)writeFileSync(file,code,"utf8");
console.log("[OK] Admin Support: readable ticket/message/attachment metadata, replies and signed links preserved");
