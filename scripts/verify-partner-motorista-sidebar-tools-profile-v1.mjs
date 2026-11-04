// Regression gate for APOIS Motorista visual relocation, no HTTP or DB mutations.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(process.env.APOIS_MOTORISTA_WORKSPACE || ".work/partner-motorista");
const read = (path) => readFileSync(resolve(root,path),"utf8");
const app = read("src/routes/motorista.app.tsx");
const menu = read("src/components/DriverSideMenu.tsx");
const profile = read("src/lib/driverProfile.ts");
const idleStart = app.indexOf("function IdleBottomPanel(");
const idleEnd = app.indexOf("function StatMini(", idleStart);
assert.ok(idleStart > 0 && idleEnd > idleStart, "IdleBottomPanel boundary must exist");
const idle = app.slice(idleStart,idleEnd);

// Pure relocation: map must remain operational and keep the real online/offline action.
for (const value of [
  "toggleOnline", "Corridas hoje", "Ganhos hoje", "Ficar online", "Ficar offline",
]) assert.ok(idle.includes(value), "Driving control missing: " + value);
assert.ok(!idle.includes("Teste de Status"), "Diagnostics must not clutter the map");
assert.ok(!idle.includes("Solicitações disponíveis"), "Available calls must not clutter the map");
assert.ok(!idle.includes("onOpenStatusCheck") && !idle.includes("onOpenCalls"),
  "Removed callbacks must not remain as unused idle props");

// The SAME authenticated operational modals and acceptance callback remain mounted in app.
for (const value of [
  'const [showStatusCheck,setShowStatusCheck]=useState(false);',
  'const [availableCallsOpen,setAvailableCallsOpen]=useState(false);',
  '<ApoisStatusCheck role="motorista"',
  '<ApoisAvailableCalls role="motorista"',
  'onAccepted={()=>{setAvailableCallsOpen(false);window.dispatchEvent(new Event("apois:driver-push"));}}',
  'onOpenStatusCheck={()=>setShowStatusCheck(true)} onOpenCalls={()=>setAvailableCallsOpen(true)}',
  'onLogout={handleLogout}',
  'const [sideMenuOpen,setSideMenuOpen]=useState(false);',
  'const [incoming, setIncoming] = useState<RideRow | null>(null);',
  'apois:driver:menu-tool',
  'window.sessionStorage.removeItem("apois:driver:menu-tool")',
]) assert.ok(app.includes(value), "Original Motorista behavior lost: " + value);

// Accessible from EVERY route using the already-shared SideMenu.
// Internal pages fall back to navigating to the home route with a one-time action.
for (const value of [
  'data-apois-driver-sidebar-profile-v3',
  'data-apois-driver-sidebar-tools-v1',
  'onClick={() => openOperationalTool("status")}',
  'onClick={() => openOperationalTool("calls")}',
  'if (tool === "status" && onOpenStatusCheck)',
  'if (tool === "calls" && onOpenCalls)',
  'window.sessionStorage.setItem("apois:driver:menu-tool", tool)',
  'void navigate({ to: "/motorista/app" })',
  'onOpenChange(false)',
  'to="/motorista/perfil"',
  'onLogout?',
  "Foto do motorista",
  "profile?.rating",
  "profile?.total_ratings",
  "ratingCount > 0",
  "Sem avaliações",
  'profileResult.profile.photo_url',
  'profileResult.profile.selfie_url',
  'refreshProfilePhotoUrl(storedPhoto)',
  'status.text',
  'setPhotoUrl(null)',
  'SheetContent',
]) assert.ok(menu.includes(value), "Sidebar operation/profile missing: " + value);
assert.ok(!menu.includes('<Avatar src={photoUrl}'), "Letter-only avatar fallback must be replaced");
assert.ok(!menu.includes('bg-[linear-gradient(145deg,#121518,#0d0f11)]'),
  "Dark profile card must be removed");
assert.ok(!menu.includes('className="mt-0.5 break-all text-xs font-medium text-zinc-500">{email}'),
  "Email must not take over profile card");
assert.ok(profile.includes("rating?: number | string | null;"), "Rating mapped from existing driver row");
assert.ok(profile.includes("total_ratings?: number | null;"), "Rating count mapped from existing driver row");

// Absolute safety: no added unscoped backend, no phantom five-star rating and no destructive operations.
assert.ok(!/service_role|auth\.admin|deleteUser/.test(menu), "Menu must not use service role or admin mutation");
assert.ok(!menu.includes('rating ?? 5'), "Rating must not default to five stars");
console.log("[OK] Motorista: real profile photo/approval/rating in light sidebar card; status and available calls relocated with original handlers, online/ride controls preserved.");
