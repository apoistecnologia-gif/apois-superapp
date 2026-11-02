import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
// APOIS_DRIVER_RECOVERY_PASTE_FALLBACK_V4
// Only disposable partner Motorista workspace; no Auth template or production changes.
// Manual fallback for Gmail WebView that does not open apoismotorista:// links.
const file=resolve(".work/partner-motorista/src/routes/motorista.recuperar-senha.tsx");
let s=readFileSync(file,"utf8");
function one(before,after,label){
 const count=s.split(before).length-1;
 if(count!==1)throw Error("[FAIL] Motorista recovery paste "+label+" occurrences="+count);
 s=s.replace(before,after);
}
if(s.includes("APOIS_DRIVER_RECOVERY_PASTE_FALLBACK_V4"))throw Error("[FAIL] Driver recovery fallback applied twice");
one('import { createFileRoute, Link } from "@tanstack/react-router";',
    'import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";',
    "router hook");
one('  const [sent, setSent] = useState(false);',
    '  const [sent, setSent] = useState(false);\n' +
    '  // APOIS_DRIVER_RECOVERY_PASTE_FALLBACK_V4: ephemeral input, never persisted.\n' +
    '  const navigate=useNavigate();\n' +
    '  const [recoveryLink,setRecoveryLink]=useState("");\n' +
    '  const [recoveryLinkError,setRecoveryLinkError]=useState<string|null>(null);\n' +
    '  const [recoveryLinkBusy,setRecoveryLinkBusy]=useState(false);',
    "temporary link state");
const fn = [
  '  async function usePastedRecoveryLink(event:React.FormEvent<HTMLFormElement>){',
  '    event.preventDefault();',
  '    if(recoveryLinkBusy)return;',
  '    setRecoveryLinkError(null);',
  '    // Accept ONLY a Supabase Auth recovery verification URL from this project.',
  '    // Never follow the pasted URL, log it or send it to an external site.',
  '    let tokenHash="";',
  '    try{',
  '      const raw=recoveryLink.trim();',
  '      if(raw.length>4096 || raw.length<40 || /[\\u0000-\\u001f\\u007f]/.test(raw)) throw Error("invalid_link");',
  '      const url=new URL(raw);',
  '      const apiOrigin="https://tbbzkrfupmqdywnzgnms.supabase.co";',
  '      if(url.origin!==apiOrigin || url.hostname!=="tbbzkrfupmqdywnzgnms.supabase.co"',
  '        || url.pathname!=="/auth/v1/verify" || url.searchParams.get("type")!=="recovery"',
  '        || url.username || url.password)throw Error("invalid_link");',
  '      const candidate=url.searchParams.get("token")||url.searchParams.get("token_hash")||"";',
  '      if(!/^[A-Za-z0-9_-]{12,1024}$/.test(candidate))throw Error("invalid_link");',
  '      tokenHash=candidate;',
  '    }catch{',
  '      setRecoveryLinkError("Este não é um link de recuperação válido do APOIS. Copie diretamente o link de um novo e-mail.");',
  '      return;',
  '    }',
  '    setRecoveryLinkBusy(true);',
  '    try{',
  '      const {data,error}=await supabase.auth.verifyOtp({token_hash:tokenHash,type:"recovery"});',
  '      if(error || !data.session){',
  '        setRecoveryLinkError("Este link já foi usado ou expirou. Solicite outro e copie antes de abri-lo.");',
  '        return;',
  '      }',
  '      setRecoveryLink("");',
  '      await navigate({to:"/motorista/redefinir-senha",replace:true});',
  '    }catch{',
  '      setRecoveryLinkError("Não foi possível confirmar o link. Verifique a conexão e solicite outro se necessário.");',
  '    }finally{',
  '      tokenHash="";',
  '      setRecoveryLinkBusy(false);',
  '    }',
  '  }',
  ''
].join("\n");
one('  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {',
    fn+'  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {',
    "link verifier action");
const ui = [
'              <section data-apois-driver-recovery-paste-v4 className="mt-6 min-w-0 rounded-2xl border border-[#e5e7eb] bg-white p-3 text-[#111827]">',
'                <details><summary className="cursor-pointer list-none text-sm font-extrabold text-[#991b1b]">O link não abriu? Usar link copiado</summary><div className="mt-3">',
'                <p className="mt-2 text-xs leading-5 text-[#374151]">Solicite um novo e-mail. Sem abrir o link, toque e segure o botão recebido e escolha Copiar link. Depois cole abaixo para definir sua nova senha no APOIS.</p>',
'                <form onSubmit={usePastedRecoveryLink} className="mt-3 space-y-3">',
'                  <label className="block text-xs font-semibold" htmlFor="apois-recovery-pasted-link">Link de recuperação recebido por e-mail</label>',
'                  <textarea id="apois-recovery-pasted-link" value={recoveryLink} onChange={event=>setRecoveryLink(event.target.value)} required',
'                    rows={2} maxLength={4096} spellCheck={false} autoCapitalize="off" autoComplete="off"',
'                    placeholder="Cole o link aqui (não compartilhe com ninguém)"',
'                    style={{color:"#111827",WebkitTextFillColor:"#111827",backgroundColor:"#ffffff",colorScheme:"light"}}',
'                    className="w-full min-w-0 rounded-xl border border-[#d1d5db] p-3 text-sm outline-none focus:border-[#E51B23]" />',
'                  {recoveryLinkError && <p role="alert" className="text-xs font-semibold text-red-700">{recoveryLinkError}</p>}',
'                  <button type="submit" disabled={recoveryLinkBusy} className="min-h-12 w-full rounded-xl bg-[#E51B23] px-3 text-sm font-extrabold text-white disabled:opacity-60">',
'                    {recoveryLinkBusy?"Verificando link...":"Usar link no aplicativo"}',
'                  </button>',
'                </form>',
'                </div></details>',
'              </section>'
].join("\n");
// Display the fallback even AFTER resetPasswordForEmail sets sent=true.
one('          )}\n        </section>', '          )}\n' + ui + '\n        </section>', "manual fallback visible in both sent/unsent states");
writeFileSync(file,s,"utf8");
console.log("[OK] Motorista recovery manual link fallback uses strict project URL + single-use verifyOtp; no token persistence.");
