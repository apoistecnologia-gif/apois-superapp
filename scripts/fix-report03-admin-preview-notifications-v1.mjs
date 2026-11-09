// INV-042: no static preview, replace unserved TanStack ServerFn with authorized Vercel API.
// No fallback to legacy URLs, no fake history and no privileged key in the browser.
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
const workspace=resolve(process.cwd(),process.env.APOIS_MOTORISTA_WORKSPACE||".work/partner-motorista");
const file=resolve(workspace,"src/routes/admin.notificacoes.tsx");
if(!existsSync(file))throw Error("[INV042] Admin notifications route missing");
let s=readFileSync(file,"utf8");
function once(a,b,label){const n=s.split(a).length-1;if(n!==1)throw Error("[INV042] "+label+" "+n);s=s.replace(a,b);}
if(!s.includes("APOIS_ADMIN_NOTIFICATION_API_V1")){
  once('import { useServerFn } from "@tanstack/react-start";',
    '// APOIS_ADMIN_NOTIFICATION_API_V1: no unserved /_serverFn calls in static preview.',
    "server function import");
  once('import {\n  getAdminNotificationHistory,\n  sendAdminBroadcast,\n} from "@/lib/adminNotifications.functions";',
    'import { supabase } from "@/integrations/supabase/client";',
    "server function module import");
  once('type HistoryRow = Awaited<ReturnType<typeof getAdminNotificationHistory>>[number];',
    'type HistoryRow = { id: string; event: string; channel: string; title: string; body: string | null; status: "sent" | "failed" | "suppressed" | "no_token"; created_at: string; user_id: string };',
    "history row contract");
  once('  const sendFn = useServerFn(sendAdminBroadcast);\n  const historyFn = useServerFn(getAdminNotificationHistory);',
    [
      '  async function apiRequest(method: "GET" | "POST", input?: unknown): Promise<unknown> {',
      '    const { data: sessionData, error: sessionError } = await supabase.auth.getSession();',
      '    const token = sessionData.session?.access_token;',
      '    if (sessionError || !token) throw new Error("unauthorized");',
      '    const response = await fetch("/api/admin/notifications", {',
      '      method, cache: "no-store",',
      '      headers: { Authorization: "Bearer " + token, "Content-Type": "application/json" },',
      '      ...(method === "POST" ? { body: JSON.stringify(input) } : {}),',
      '    });',
      '    const payload: unknown = await response.json().catch(() => { throw new Error("invalid_response"); });',
      '    if (!response.ok) {',
      '      const error = payload && typeof payload === "object" && "error" in payload ? String(payload.error) : "notification_service_unavailable";',
      '      throw new Error(error);',
      '    }',
      '    return payload;',
      '  }',
      '  const historyFn = async (_options: Record<string, never>): Promise<HistoryRow[]> => {',
      '    const data = await apiRequest("GET");',
      '    if (!Array.isArray(data)) throw new Error("invalid_history_response");',
      '    return data as HistoryRow[];',
      '  };',
      '  const sendFn = async ({ data }: { data: { title: string; body: string; audience: Audience; filter: string | null } }): Promise<{ sent: number; failed: number; noTokens: number; suppressed: number }> => {',
      '    const result = await apiRequest("POST", data);',
      '    if (!result || typeof result !== "object" || !("sent" in result)) throw new Error("invalid_send_response");',
      '    return result as { sent: number; failed: number; noTokens: number; suppressed: number };',
      '  };'
    ].join("\n"), "preview functions");
  if(s.includes('useServerFn(')||s.includes('from "@/lib/adminNotifications.functions"'))
    throw Error("[INV042] unserved serverFns still imported");
  writeFileSync(file,s);
}
console.log("[OK] INV-042 Admin notifications routed to authenticated Vercel API");
