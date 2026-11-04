// APOIS_DRIVER_SIDEBAR_TOOLS_PROFILE_V1
// Move two existing controls into the original SideMenu without changing their
// RPC, callbacks, identity, ride lifecycle or permission checks.
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(process.env.APOIS_MOTORISTA_WORKSPACE || ".work/partner-motorista");
const appFile = resolve(root, "src/routes/motorista.app.tsx");
const menuFile = resolve(root, "src/components/DriverSideMenu.tsx");
const profileFile = resolve(root, "src/lib/driverProfile.ts");
const MENU_TOOL_KEY = "apois:driver:menu-tool";
const CARD = "              <Link\n                to=\"/motorista/perfil\"\n                onClick={() => onOpenChange(false)}\n                aria-label={\"Abrir perfil do motorista: \" + displayName}\n                data-apois-driver-sidebar-profile-v3\n                className=\"flex min-w-0 items-start gap-3 rounded-[24px] border border-[#E3E6EB] bg-white p-4 text-[#111827] shadow-[0_14px_32px_-24px_rgba(17,24,39,.35)] transition active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E51B23] motion-reduce:transform-none\"\n              >\n                <div className=\"grid h-[70px] w-[70px] shrink-0 place-items-center overflow-hidden rounded-full border-[3px] border-white bg-[#F3F4F6] shadow-md ring-2 ring-[#E51B23]/25\">\n                  {photoUrl ? (\n                    <img src={photoUrl} alt=\"Foto do motorista\" onError={() => setPhotoUrl(null)}\n                      className=\"h-full w-full object-cover\" />\n                  ) : (\n                    <UserIcon className=\"h-8 w-8 text-[#9CA3AF]\" aria-label=\"Foto não cadastrada\" />\n                  )}\n                </div>\n                <div className=\"min-w-0 flex-1\">\n                  <p className=\"break-words text-[16px] font-black leading-5 text-[#111827]\">{displayName}</p>\n                  <span className={\"mt-2 inline-flex max-w-full items-center rounded-full border px-2.5 py-1 text-[10.5px] font-extrabold leading-4 \" + approvalTone}>\n                    {status.text}\n                  </span>\n                  <div className=\"mt-3 flex flex-wrap items-center gap-1\" aria-label={ratingReady ? \"Avaliação \" + driverRating.toFixed(1) + \" de 5 estrelas\" : \"Motorista sem avaliações\"}>\n                    {Array.from({ length: 5 }, (_, index) => (\n                      <Star key={index} aria-hidden=\"true\"\n                        className={\"h-[15px] w-[15px] \" + (ratingReady && index < Math.round(driverRating) ? \"fill-[#EAB308] text-[#EAB308]\" : \"fill-none text-[#CBD5E1]\")} />\n                    ))}\n                    <span className=\"ml-1 text-[11px] font-bold text-[#4B5563]\">\n                      {ratingReady ? driverRating.toFixed(1) + \"/5 · \" + ratingCount + (ratingCount === 1 ? \" avaliação\" : \" avaliações\") : \"Sem avaliações\"}\n                    </span>\n                  </div>\n                  {!photoUrl ? <p className=\"mt-2 text-[10px] font-medium text-[#6B7280]\">Adicione sua foto em Perfil</p> : null}\n                </div>\n                <ChevronRight className=\"mt-1 h-4 w-4 shrink-0 text-[#9CA3AF]\" aria-hidden=\"true\" />\n              </Link>";
const TOOLS = "              <section data-apois-driver-sidebar-tools-v1 aria-label=\"Ferramentas de operação\" className=\"space-y-2\">\n                <p className=\"px-1 text-[10px] font-black uppercase tracking-[0.16em] text-[#6B7280]\">Ferramentas de operação</p>\n                <button type=\"button\" onClick={() => openOperationalTool(\"status\")}\n                  className=\"driver-menu-link flex min-h-[60px] w-full items-center gap-3 rounded-[18px] border border-[#E5E7EB] bg-white px-3.5 py-3 text-left shadow-sm transition hover:border-[#F3BAC0] hover:bg-[#FFF8F8] active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E51B23]\">\n                  <span className=\"grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#FFF1F2] text-[#C9141B]\">\n                    <Activity className=\"h-5 w-5\" aria-hidden=\"true\" />\n                  </span>\n                  <span className=\"min-w-0 flex-1\">\n                    <span className=\"block text-[13px] font-black leading-5 text-[#111827]\">Teste de Status</span>\n                    <span className=\"block text-[11px] font-medium leading-4 text-[#667085]\">6 verificações de GPS, conta e conexão</span>\n                  </span>\n                  <ChevronRight className=\"h-4 w-4 shrink-0 text-[#E51B23]\" aria-hidden=\"true\" />\n                </button>\n                <button type=\"button\" onClick={() => openOperationalTool(\"calls\")}\n                  className=\"driver-menu-link flex min-h-[60px] w-full items-center gap-3 rounded-[18px] border border-[#E5E7EB] bg-white px-3.5 py-3 text-left shadow-sm transition hover:border-[#F3BAC0] hover:bg-[#FFF8F8] active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E51B23]\">\n                  <span className=\"grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#FFF1F2] text-[#C9141B]\">\n                    <ListChecks className=\"h-5 w-5\" aria-hidden=\"true\" />\n                  </span>\n                  <span className=\"min-w-0 flex-1\">\n                    <span className=\"block text-[13px] font-black leading-5 text-[#111827]\">Solicitações disponíveis</span>\n                    <span className=\"block text-[11px] font-medium leading-4 text-[#667085]\">Consultar chamadas dentro da sua área</span>\n                  </span>\n                  <ChevronRight className=\"h-4 w-4 shrink-0 text-[#E51B23]\" aria-hidden=\"true\" />\n                </button>\n              </section>";

function replaceOnce(source, before, after, label) {
  const count = source.split(before).length - 1;
  if (count !== 1) throw Error("[FAIL] Sidebar QA " + label + " anchor count " + count);
  return source.replace(before, after);
}

let app = readFileSync(appFile, "utf8");
let menu = readFileSync(menuFile, "utf8");
let profile = readFileSync(profileFile, "utf8");
if (menu.includes("data-apois-driver-sidebar-tools-v1") || app.includes("APOIS_DRIVER_SIDEBAR_TOOLS_PROFILE_V1")) {
  throw Error("[FAIL] Motorista sidebar tools v1 already applied to workspace");
}

// Preserve the exact original modal and user-driven actions. Only change their launch point.
for (const marker of [
  'const [showStatusCheck,setShowStatusCheck]=useState(false);',
  'const [availableCallsOpen,setAvailableCallsOpen]=useState(false);',
  '<ApoisStatusCheck role="motorista"',
  '<ApoisAvailableCalls role="motorista"',
  'onAccepted={()=>{setAvailableCallsOpen(false);window.dispatchEvent(new Event("apois:driver-push"));}}',
]) {
  if (!app.includes(marker)) throw Error("[FAIL] Motorista existing modal/callback changed: " + marker);
}

const start = app.indexOf("function IdleBottomPanel(");
const end = app.indexOf("function StatMini(", start);
if (start < 0 || end <= start) throw Error("[FAIL] Motorista idle panel boundaries changed");
let idle = app.slice(start, end);
// Locate the original click handler rather than depending on generated CSS or line breaks.
function removeIdleToolButton(handler, expectedLabel) {
  const anchor = "onClick={" + handler + "}";
  const matches = idle.split(anchor).length - 1;
  if (matches !== 1) throw Error("[FAIL] Motorista idle " + handler + " handler occurrences " + matches);
  const at = idle.indexOf(anchor);
  const buttonStart = idle.lastIndexOf("<button", at);
  const buttonEnd = idle.indexOf("</button>", at);
  if(buttonStart < 0 || buttonEnd < at || buttonEnd - buttonStart > 1200) {
    throw Error("[FAIL] Motorista idle " + handler + " button boundaries");
  }
  const block = idle.slice(buttonStart,buttonEnd + "</button>".length);
  if(!block.includes(expectedLabel)) throw Error("[FAIL] Motorista idle " + handler + " label changed");
  idle = idle.slice(0,buttonStart) + idle.slice(buttonEnd + "</button>".length);
}
removeIdleToolButton("onOpenStatusCheck","Teste de Status");
removeIdleToolButton("onOpenCalls","Solicitações disponíveis");

idle = replaceOnce(idle, "  canUseTestLocation, onUseTestLocation, onOpenStatusCheck, onOpenCalls,",
  "  canUseTestLocation, onUseTestLocation,", "idle props");
idle = replaceOnce(idle, "  onOpenStatusCheck: () => void;\n  onOpenCalls: () => void;\n", "", "idle prop types");
app = app.slice(0,start) + idle + app.slice(end);

app = replaceOnce(app,
  '          onOpenStatusCheck={()=>setShowStatusCheck(true)}\n          onOpenCalls={()=>setAvailableCallsOpen(true)}\n', '', "home callback props");

app = replaceOnce(app,
  '      <DriverSideMenu open={sideMenuOpen} onOpenChange={setSideMenuOpen} onLogout={handleLogout} />',
  '      <DriverSideMenu open={sideMenuOpen} onOpenChange={setSideMenuOpen} onLogout={handleLogout}\n        onOpenStatusCheck={()=>setShowStatusCheck(true)} onOpenCalls={()=>setAvailableCallsOpen(true)} />',
  "home menu callbacks");

const savedAction = '  const [availableCallsOpen,setAvailableCallsOpen]=useState(false);';
app = replaceOnce(app,savedAction,
  savedAction + '\n  // APOIS_DRIVER_SIDEBAR_TOOLS_PROFILE_V1: one-time navigation intent from another Motorista screen.\n  useEffect(() => {\n    let tool: string | null = null;\n    try {\n      tool = window.sessionStorage.getItem("apois:driver:menu-tool");\n      window.sessionStorage.removeItem("apois:driver:menu-tool");\n    } catch { /* not fatal; only menu navigation is affected */ }\n    if (tool === "status") setShowStatusCheck(true);\n    if (tool === "calls") setAvailableCallsOpen(true);\n  }, []);',
  "cross-screen menu action");

if (app.slice(app.indexOf("function IdleBottomPanel("),app.indexOf("function StatMini(")).includes("onOpenCalls") ||
    app.slice(app.indexOf("function IdleBottomPanel("),app.indexOf("function StatMini(")).includes("onOpenStatusCheck")) {
  throw Error("[FAIL] Motorista idle must contain only driving/online actions");
}

menu = replaceOnce(menu,
  'import { Link } from "@tanstack/react-router";',
  'import { Link, useNavigate } from "@tanstack/react-router";',
  "menu navigation import");
menu = replaceOnce(menu,
  '  Settings,\n',
  '  Settings,\n  Activity,\n  ListChecks,\n  Star,\n',
  "menu operational icons");
menu = replaceOnce(menu,
  'import { Avatar } from "@/components/Avatar";\n',
  "",
  "remove letter-only avatar");
menu = replaceOnce(menu,
  '  onLogout?: () => void;\n',
  '  onLogout?: () => void;\n  onOpenStatusCheck?: () => void;\n  onOpenCalls?: () => void;\n',
  "side-menu props");
menu = replaceOnce(menu,
  'export function DriverSideMenu({ open, onOpenChange, onLogout }: Props) {',
  'export function DriverSideMenu({ open, onOpenChange, onLogout, onOpenStatusCheck, onOpenCalls }: Props) {\n  const navigate = useNavigate();',
  "side-menu callback injection");
const reloadAnchor = '  const requestReload = useCallback(() => {\n    setReloadKey((value) => value + 1);\n  }, []);';
menu = replaceOnce(menu,reloadAnchor,
  reloadAnchor + '\n\n  // Use the same home modals. From other pages, navigate to home with a one-time intent.\n  const openOperationalTool = (tool: "status" | "calls") => {\n    onOpenChange(false);\n    if (tool === "status" && onOpenStatusCheck) { onOpenStatusCheck(); return; }\n    if (tool === "calls" && onOpenCalls) { onOpenCalls(); return; }\n    try { window.sessionStorage.setItem("apois:driver:menu-tool", tool); } catch { /* noop */ }\n    void navigate({ to: "/motorista/app" });\n  };',
  "preserve original handlers across app routes");

const oldStored = '          const storedPhoto = String(\n            profileResult.profile.photo_url ?? profileResult.profile.selfie_url ?? "",\n          ).trim();';
const newStored = '          const storedPhoto = String(profileResult.profile.photo_url ?? "").trim() ||\n            String(profileResult.profile.selfie_url ?? "").trim();';
menu = replaceOnce(menu,oldStored,newStored,"photo fallback");

const summaryAnchor = '  const displayName = profileName || emailAlias || "Motorista";';
const summary = [
  summaryAnchor,
  '  const ratingCount = Math.max(0, Number(profile?.total_ratings ?? 0) || 0);',
  '  const driverRating = Number(profile?.rating ?? 0);',
  '  const ratingReady = ratingCount > 0 && Number.isFinite(driverRating) && driverRating > 0 && driverRating <= 5;',
  '  const approvalState = normalizeApprovalStatus(profile?.approval_status);',
  '  const approvalTone = ["aprovado", "approved"].includes(approvalState)',
  '    ? "border-[#BBF7D0] bg-[#ECFDF5] text-[#047857]"',
  '    : ["reprovado", "rejected", "bloqueado", "blocked", "suspended", "suspenso"].includes(approvalState)',
  '      ? "border-[#FECACA] bg-[#FEF2F2] text-[#B91C1C]"',
  '      : "border-[#FDE68A] bg-[#FFFBEB] text-[#92400E]";'
].join("\n");
menu = replaceOnce(menu,summaryAnchor,summary,"actual rating/status");

const cardStart = menu.indexOf('              <Link\n                to="/motorista/perfil"');
const cardEnd = menu.indexOf('              <nav className="space-y-2" aria-label="Navegação do motorista">',cardStart);
if(cardStart < 0 || cardEnd <= cardStart) throw Error("[FAIL] DriverSideMenu card/nav boundary changed");
const previousCard = menu.slice(cardStart,cardEnd);
if (!previousCard.includes('Avatar src={photoUrl}') || !previousCard.includes('status.text') || !previousCard.includes('onClick={() => onOpenChange(false)}')) {
  throw Error("[FAIL] DriverSideMenu original profile card or link changed");
}
menu = menu.slice(0,cardStart) + CARD + "\n\n" + TOOLS + "\n\n" + menu.slice(cardEnd);

profile = replaceOnce(profile,
  '  photo_url: string | null;\n',
  '  photo_url: string | null;\n  rating?: number | string | null;\n  total_ratings?: number | null;\n',
  "extend read-only profile type with existing Supabase rating fields");

for (const key of [
  'data-apois-driver-sidebar-profile-v3',
  'data-apois-driver-sidebar-tools-v1',
  'onClick={() => openOperationalTool("status")}',
  'onClick={() => openOperationalTool("calls")}',
  'profile?.total_ratings',
  'profile?.rating',
  'Foto do motorista',
  'Sem avaliações',
  'to="/motorista/perfil"',
  'onOpenChange(false)',
  'apois:driver:menu-tool',
]) {
  if(!menu.includes(key)) throw Error("[FAIL] DriverSideMenu final missing " + key);
}
if (!app.includes('onOpenStatusCheck={()=>setShowStatusCheck(true)} onOpenCalls={()=>setAvailableCallsOpen(true)}'))
  throw Error("[FAIL] Home modal callbacks not preserved");
if(!app.includes('<ApoisAvailableCalls role="motorista"') || !app.includes('<ApoisStatusCheck role="motorista"'))
  throw Error("[FAIL] Existing modals removed");
writeFileSync(appFile,app,"utf8");
writeFileSync(menuFile,menu,"utf8");
writeFileSync(profileFile,profile,"utf8");
console.log("[OK] Motorista: diagnostic and calls moved into original sidebar; existing modals/claim/push preserved; profile photo/status/real rating shown.");
