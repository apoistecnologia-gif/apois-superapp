// APOIS_MOTORISTA_DELETE_CONFIRM_V4
// Native WebView must not silently jump to login or call missing legacy Edge Function.
// Only confirmed "EXCLUIR" triggers existing authenticated Corridas deletion-request RPC.
import {readFileSync,writeFileSync} from "node:fs";
import {resolve} from "node:path";
const work=resolve(process.env.APOIS_MOTORISTA_WORKSPACE || ".work/partner-motorista");
const file=resolve(work,"src/routes/motorista.configuracoes.tsx");
let src=readFileSync(file,"utf8");
if(src.includes("APOIS_MOTORISTA_DELETE_CONFIRM_V4"))throw Error("[FAIL] Delete V4 already applied");
function once(a,b,label){
  const n=src.split(a).length-1;
  if(n!==1)throw Error("[FAIL] Delete V4 "+label+" anchor count "+n);
  src=src.replace(a,b);
}
once("  const [deleting, setDeleting] = useState(false);",
  '  const [deleting, setDeleting] = useState(false);\n  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);\n  const [deletePhrase, setDeletePhrase] = useState("");\n  const [deleteError, setDeleteError] = useState<string | null>(null);',
  "modal state");

const start=src.indexOf("  async function handleDeleteAccount() {");
const end=src.indexOf("\n  return (\n",start);
if(start<0 || end<start || end-start>3200)throw Error("[FAIL] Delete V4 handler boundaries changed");
const handler=[
  "  // APOIS_MOTORISTA_DELETE_CONFIRM_V4 — opening is pure UI, NEVER mutates a user.",
  "  function handleDeleteAccount() {",
  "    if (deleting || signingOut) return;",
  "    setDeletePhrase(\"\");",
  "    setDeleteError(null);",
  "    setDeleteConfirmOpen(true);",
  "  }",
  "",
  "  async function confirmDeleteAccount() {",
  "    if (deleting || signingOut || deletePhrase.trim() !== \"EXCLUIR\") return;",
  "    setDeleting(true);",
  "    setDeleteError(null);",
  "    try {",
  "      const { data, error } = await (supabase as any).rpc(\"request_own_account_deletion\");",
  "      if (error) {",
  "        const reason = String(error.message ?? \"\");",
  "        if (error.code === \"55000\" || reason.includes(\"active_ride_blocks_account_deletion\")) {",
  "          setDeleteError(\"Você possui uma corrida ativa. Finalize ou cancele a corrida para solicitar a exclusão.\");",
  "          return;",
  "        }",
  "        throw new Error(\"server_request_failed\");",
  "      }",
  "      if (data?.ok !== true) throw new Error(\"server_did_not_confirm\");",
  "      // Server confirmed the account deletion request. Only now terminate local auth.",
  "      try { await supabase.auth.signOut({ scope: \"local\" }); } catch { /* user is already blocked */ }",
  "      toast.success(\"Solicitação de exclusão confirmada.\");",
  "      await navigate({ to: \"/motorista/login\", replace: true });",
  "    } catch {",
  "      setDeleteError(\"Não foi possível confirmar a exclusão no servidor. Sua solicitação não foi confirmada. Tente novamente ou procure o suporte.\");",
  "    } finally {",
  "      setDeleting(false);",
  "    }",
  "  }",
  "",
].join("\n");
src=src.slice(0,start)+handler+src.slice(end);
once('hint="Exclusão permanente dos dados pessoais e documentos"',
  'hint="Solicitar exclusão com confirmação e retenções legais aplicáveis"',
  "accurate deletion copy");
const marker="        </SettingsPageShell>\n      </div>";
const modal=[
  "        </SettingsPageShell>",
  "        {deleteConfirmOpen ? (",
  "          <div className=\"fixed inset-0 z-[260] flex items-end justify-center bg-black/75 p-0 sm:items-center sm:p-4\" role=\"presentation\">",
  "            <section role=\"dialog\" aria-modal=\"true\" aria-labelledby=\"driver-delete-dialog-title\"",
  "              className=\"max-h-[94dvh] w-full max-w-md overflow-y-auto rounded-t-[26px] border border-[#E5E7EB] bg-white px-5 pb-[max(26px,env(safe-area-inset-bottom))] pt-5 text-[#111827] shadow-2xl sm:rounded-[26px]\">",
  "              <h2 id=\"driver-delete-dialog-title\" className=\"text-[20px] font-black text-[#991B1B]\">Solicitar exclusão da conta</h2>",
  "              <p className=\"mt-3 text-sm font-medium leading-6 text-[#374151]\">Esta ação impedirá o uso do perfil APOIS Motorista após a confirmação pelo servidor. Registros de corridas, pagamentos e documentos poderão ser retidos quando exigidos por lei ou necessários à segurança e ao exercício de direitos.</p>",
  "              <p className=\"mt-3 text-sm font-semibold text-[#111827]\">Para confirmar, digite EXCLUIR:</p>",
  "              <input type=\"text\" value={deletePhrase} disabled={deleting} autoCapitalize=\"characters\" autoComplete=\"off\" spellCheck={false}",
  "                onChange={(event) => setDeletePhrase(event.target.value)} placeholder=\"EXCLUIR\" aria-label=\"Digite EXCLUIR para confirmar\"",
  "                className=\"mt-2 h-14 w-full rounded-xl border border-[#CBD5E1] bg-white px-4 text-base font-bold text-[#111827] outline-none focus:border-[#B91C1C] focus:ring-2 focus:ring-[#FECACA]\" />",
  "              {deleteError ? <p role=\"alert\" className=\"mt-3 rounded-xl bg-[#FEF2F2] p-3 text-sm font-semibold leading-5 text-[#991B1B]\">{deleteError}</p> : null}",
  "              <div className=\"mt-5 grid grid-cols-2 gap-3\">",
  "                <button type=\"button\" disabled={deleting} onClick={() => { setDeleteConfirmOpen(false); setDeletePhrase(\"\"); setDeleteError(null); }}",
  "                  className=\"min-h-12 rounded-xl border border-[#CBD5E1] bg-white text-sm font-bold text-[#111827] disabled:opacity-40\">Cancelar</button>",
  "                <button type=\"button\" onClick={() => void confirmDeleteAccount()}",
  "                  disabled={deleting || deletePhrase.trim() !== \"EXCLUIR\"}",
  "                  className=\"min-h-12 rounded-xl bg-[#B91C1C] px-2 text-sm font-bold text-white disabled:opacity-40\">",
  "                  {deleting ? \"Confirmando...\" : \"Solicitar exclusão\"}",
  "                </button>",
  "              </div>",
  "            </section>",
  "          </div>",
  "        ) : null}",
  "      </div>",
].join("\n");
once(marker,modal,"confirmation modal insertion");
const posOpen=src.indexOf("function handleDeleteAccount()");
const posRpc=src.indexOf('rpc("request_own_account_deletion")');
const posSignout=src.indexOf('await supabase.auth.signOut({ scope: "local" });',posRpc);
if(posOpen<0||posRpc<posOpen||posSignout<posRpc)throw Error("[FAIL] delete RPC/signout order changed");
for(const forbidden of ["window.confirm(", "window.prompt(", 'functions.invoke("delete-my-account"']) {
  if(src.includes(forbidden))throw Error("[FAIL] Legacy destructive delete path remains: "+forbidden);
}
if(!src.includes('onClick={() => void handleDeleteAccount()}') || !src.includes('aria-modal="true"') ||
   !src.includes('deletePhrase.trim() !== "EXCLUIR"'))throw Error("[FAIL] Delete dialog contract incomplete");
writeFileSync(file,src,"utf8");
console.log("[OK] Motorista: deletion opens explicit modal; authenticated RPC only after typed confirmation; login navigation only after server ok.");
