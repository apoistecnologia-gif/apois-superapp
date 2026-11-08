// INV-001: direct authorized ticket detail, independent of the 50-row list.
// Applies only to isolated Entregas .work; does not deploy Edge Functions.
import {readFileSync,writeFileSync} from "node:fs";
import {resolve} from "node:path";

const root=resolve(process.env.APOIS_ENTREGAS_WORKSPACE||".work/entregas");
const marker="APOIS_SUPPORT_TICKET_DETAIL_V1";
function patch(file, transform) {
  const path=resolve(root,file);
  let src=readFileSync(path,"utf8");
  if(src.includes(marker)) {console.log("[OK] support detail already patched "+file);return;}
  function one(before,after,label) {
    const matches=src.split(before).length-1;
    if(matches!==1) throw Error("[FAIL] "+file+" "+label+" anchors="+matches);
    src=src.replace(before,after);
  }
  transform(one);
  if(!src.includes(marker))throw Error("[FAIL] missing support detail marker: "+file);
  writeFileSync(path,src,"utf8");
}
patch("supabase/functions/customer-support/index.ts",(one)=>{
  one('  if (payload.action === "create") {',
'  // '+marker+'\n'+
'  // Never locate a ticket by scanning the 50 most recent tickets.\n'+
'  // The requester filter AND the existing RLS are authorization boundaries.\n'+
'  if (payload.action === "detail") {\n'+
'    const ticketId = payload.ticketId;\n'+
'    if (typeof ticketId !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(ticketId)) {\n'+
'      return reply(400, { error: "Chamado inválido.", code: "INVALID_TICKET" });\n'+
'    }\n'+
'    const { data, error } = await client\n'+
'      .from("support_tickets")\n'+
'      .select("id,requester_user_id,category,subject,description,priority,status,order_id,delivery_job_id,created_at,updated_at,resolved_at,closed_at,support_messages(id,sender_user_id,message,attachment_paths,is_internal,created_at)")\n'+
'      .eq("id", ticketId)\n'+
'      .eq("requester_user_id", authData.user.id)\n'+
'      .maybeSingle();\n'+
'    if (error) {\n'+
'      console.error("customer-support detail failed", { code: error.code });\n'+
'      return reply(500, { error: "Não foi possível carregar este chamado.", code: "DETAIL_FAILED" });\n'+
'    }\n'+
'    if (!data) return reply(404, { error: "Chamado não encontrado.", code: "NOT_FOUND" });\n'+
'    return reply(200, { ticket: {\n'+
'      ...data,\n'+
'      support_messages: (data.support_messages ?? []).filter((item) => !item.is_internal),\n'+
'    } });\n'+
'  }\n\n'+
'  if (payload.action === "create") {',
'detail RPC');
});
patch("src/routes/perfil/ajuda/chamado/$ticketId.tsx",(one)=>{
  one('body: { action: "list" },','body: { action: "detail", ticketId },\n        // '+marker,'detail request');
  one('      const tickets = Array.isArray(data?.tickets) ? (data.tickets as SupportTicket[]) : [];\n      const found = tickets.find((item) => item.id === ticketId) ?? null;',
      '      const found = data?.ticket?.id === ticketId ? (data.ticket as SupportTicket) : null;',
      'detail response');
});
console.log("[OK] INV-001: fetch support ticket by requester and id without list pagination.");
