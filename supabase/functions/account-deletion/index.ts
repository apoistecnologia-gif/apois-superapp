import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const baseHeaders = {
  "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'",
  "Referrer-Policy": "no-referrer",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "Cache-Control": "no-store",
};
function html(body: string, status = 200) {
  return new Response(body, { status, headers: { ...baseHeaders, "content-type": "text/html; charset=utf-8" } });
}
function escapeHtml(value: string) {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
}
function page(message = "", isError = false) {
  const notice = message ? `<div class="notice ${isError ? "error" : "success"}">${escapeHtml(message)}</div>` : "";
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Excluir conta | APOIS</title><style>:root{color-scheme:dark;font-family:Inter,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}*{box-sizing:border-box}body{margin:0;background:#050505;color:#fff;min-height:100vh;display:grid;place-items:center;padding:24px}.card{width:min(100%,560px);background:#0d0d0d;border:1px solid #292929;border-radius:24px;padding:28px}.brand{font-weight:900;letter-spacing:.18em;color:#f6bf18}.eyebrow{font-size:12px;color:#f6bf18;font-weight:800;text-transform:uppercase}.muted{color:#aaa;line-height:1.55}.notice{padding:14px;border-radius:14px;margin:18px 0}.success{background:#0b2a17;border:1px solid #23723e}.error{background:#321010;border:1px solid #873333}label{display:block;font-weight:700;margin:20px 0 8px}input[type=email]{width:100%;padding:14px;border-radius:12px;border:1px solid #393939;background:#171717;color:white;font-size:16px}button{width:100%;border:0;border-radius:14px;padding:15px;background:#f6bf18;color:#080808;font-weight:900;font-size:16px;margin-top:18px}.small{font-size:12px;color:#888;margin-top:16px;line-height:1.5}.hp{position:absolute;left:-9999px;width:1px;height:1px;overflow:hidden}h1{margin:10px 0 8px;font-size:30px}</style></head><body><main class="card"><div class="brand">APOIS</div><div class="eyebrow">Privacidade e dados</div><h1>Solicitar exclusão da conta</h1><p class="muted">Use este formulário mesmo que você já tenha desinstalado o aplicativo. A solicitação abrange sua conta APOIS e os dados pessoais associados, ressalvados somente registros que precisem ser mantidos por obrigação legal ou regulatória, segurança, prevenção de fraude, auditoria ou exercício regular de direitos.</p>${notice}<form method="post"><label for="email">E-mail da conta</label><input id="email" name="email" type="email" autocomplete="email" maxlength="254" required><div class="hp" aria-hidden="true"><label for="website">Não preencha</label><input id="website" name="website" tabindex="-1" autocomplete="off"></div><button type="submit">Enviar solicitação</button></form><p class="small">Por segurança, a APOIS poderá solicitar confirmação de identidade antes de concluir a exclusão. Você também pode iniciar a solicitação no aplicativo em Perfil → Dados pessoais → Excluir minha conta.</p></main></body></html>`;
}
Deno.serve(async (req) => {
  if (req.method === "GET") return html(page());
  if (req.method !== "POST") return html(page("Método não permitido.", true), 405);
  if (!SUPABASE_URL || !SERVICE_ROLE) return html(page("Serviço temporariamente indisponível. Tente novamente mais tarde.", true), 503);
  try {
    const form = await req.formData();
    if (String(form.get("website") ?? "").trim()) return html(page("Solicitação recebida."));
    const email = String(form.get("email") ?? "").trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) return html(page("Informe um e-mail válido.", true), 400);
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false, autoRefreshToken: false } });
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { data: existing, error: lookupError } = await admin.from("external_account_deletion_requests").select("id").eq("email", email).in("status", ["pending", "processing"]).gte("requested_at", since).limit(1);
    if (lookupError) throw lookupError;
    if (!existing?.length) {
      const { error } = await admin.from("external_account_deletion_requests").insert({ email, source: "public_web" });
      if (error) throw error;
    }
    return html(page("Solicitação recebida. Se houver uma conta associada ao e-mail informado, a APOIS fará a verificação necessária antes da conclusão."));
  } catch (error) {
    console.error("account-deletion public request failed", error instanceof Error ? error.message : String(error));
    return html(page("Não foi possível registrar a solicitação agora. Tente novamente mais tarde.", true), 500);
  }
});
