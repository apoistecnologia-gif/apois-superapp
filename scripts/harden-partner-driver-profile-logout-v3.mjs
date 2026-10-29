import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

// Applied ONLY to the disposable Motorista workspace of APOIS Parceiro.
// No changes to business rules, data tables, production domains or Cliente.
const root = resolve(process.env.APOIS_MOTORISTA_WORKSPACE || ".work/partner-motorista");

function update(path, transformations) {
  const file = resolve(root, path);
  let contents = readFileSync(file, "utf8");
  for (const [oldText, newText, label, count = 1] of transformations) {
    const n = contents.split(oldText).length - 1;
    if (n !== count) throw new Error("[FAIL] Motorista profile V3 " + label + ": expected " + count + ", got " + n);
    contents = count === 1 ? contents.replace(oldText, newText) : contents.replaceAll(oldText, newText);
  }
  writeFileSync(file, contents, "utf8");
  console.log("[OK] Motorista V3: " + path);
}

const signOutFile = resolve(root, "src/lib/driverLocalSignOut.ts");
writeFileSync(signOutFile, String.raw`import { supabase } from "@/integrations/supabase/client";

// Local-only logout: an unreachable Auth server must not trap the driver inside
// their account on this device. Never clear the Courier's storage or all storage.
export async function signOutDriverOnThisDevice(): Promise<void> {
  const configuredUrl = String(import.meta.env.VITE_SUPABASE_URL ?? "");
  const projectRef = new URL(configuredUrl).hostname.split(".")[0];
  if (projectRef !== "tbbzkrfupmqdywnzgnms") {
    throw new Error("Projeto de autenticação do Motorista não corresponde ao esperado.");
  }

  let signOutError: unknown = null;
  try {
    const { error } = await supabase.auth.signOut({ scope: "local" });
    signOutError = error;
  } catch (error) {
    signOutError = error;
  }

  const sessionKey = "sb-" + projectRef + "-auth-token";
  if (signOutError) {
    // Supabase can reject remote logout when offline. Discard ONLY the current
    // driver's locally persisted session; a full WebView reload clears memory.
    window.localStorage.removeItem(sessionKey);
    if (window.localStorage.getItem(sessionKey) !== null) throw signOutError;
  }
  window.localStorage.removeItem("apois:driver:online");
  window.dispatchEvent(new CustomEvent("apois:driver-presence-change", { detail: { online: false } }));

  // A full navigation is required after a network-failed signOut because
  // Supabase may still hold the old access token in memory on this page.
  const embedded = window.location.pathname.endsWith("/index.html") || window.location.hash.startsWith("#/");
  const destination = embedded
    ? window.location.pathname + window.location.search + "#/motorista/login"
    : "/motorista/login";
  window.location.replace(destination);
}
`, "utf8");

update("src/routes/motorista.perfil.tsx", [
  ['import { supabase } from "@/integrations/supabase/client";',
   'import { supabase } from "@/integrations/supabase/client";\nimport { signOutDriverOnThisDevice } from "@/lib/driverLocalSignOut";', "logout import"],
  ['      const { error: signOutError } = await supabase.auth.signOut();\n      if (signOutError) throw signOutError;\n      toast.success("Sessão encerrada.");\n      await navigate({ to: "/", replace: true });',
   '      await signOutDriverOnThisDevice();', "logout local"],
  ['<div data-apois-driver-profile-v2 className="flex min-h-dvh flex-col bg-[#F7F7F8] text-[#111827]">',
   '<div data-apois-driver-profile-v3 className="flex min-h-dvh flex-col bg-[#F7F7F8] text-[#111827]">', "profile scope"],
  ['<DSCard className="min-w-0 border-destructive/25 bg-destructive/5 p-4" role="alert" aria-live="assertive">',
   '<DSCard className="min-w-0 rounded-2xl border border-[#F5B9C0] bg-[#FFF1F2] p-4 text-[#991B1B] shadow-none" role="alert" aria-live="assertive">', "visible error"],
  ['<Body className="break-words font-semibold text-foreground">{error}</Body>',
   '<Body className="break-words font-semibold !text-[#991B1B]">{error}</Body>', "error text"],
  ['className="mt-3 min-h-11 max-w-full focus-visible:ring-2 focus-visible:ring-primary" aria-busy={loading}',
   'className="mt-3 min-h-11 max-w-full border-[#E51B23]/30 bg-white !text-[#B91C1C] hover:bg-[#FFF7F7] focus-visible:ring-2 focus-visible:ring-[#E51B23]" aria-busy={loading}', "retry button"],
  ['<div className="rounded-full p-1 ring-2 ring-primary/40 shadow-[0_10px_28px_-10px_color-mix(in_oklab,var(--color-primary)_55%,transparent)]">',
   '<div className="flex w-full justify-center">', "remove giant uploader ring"],
  ['onUploaded={handlePhotoUploaded} size={96} label=""',
   'onUploaded={handlePhotoUploaded} size={88} label=""', "photo size"],
  ['<DSCard className="min-w-0 overflow-hidden p-0">',
   '<DSCard className="min-w-0 overflow-hidden rounded-2xl border border-[#E5E7EB] bg-white p-0 text-[#111827] shadow-sm">', "account cards", 2],
  ['<Body className="break-words font-semibold [overflow-wrap:anywhere]">{label}</Body>',
   '<Body className="break-words font-semibold !text-[#111827] [overflow-wrap:anywhere]">{label}</Body>', "menu headings"],
  ['<Caption className="block break-words leading-4 [overflow-wrap:anywhere]">{sub}</Caption>',
   '<Caption className="block break-words leading-4 !text-[#667085] [overflow-wrap:anywhere]">{sub}</Caption>', "menu description"],
  ['<Label className="px-2">Preferências</Label>',
   '<Label className="px-2 !text-[#606B7A]">Preferências</Label>', "preferences label"],
  ['<Label className="px-2">Conta</Label>',
   '<Label className="px-2 !text-[#606B7A]">Conta</Label>', "account label"],
  ['<DSButton variant="outline" size="lg" onClick={() => void handleLogout()} disabled={loggingOut} aria-busy={loggingOut} className="min-h-12 w-full text-destructive hover:bg-destructive/5 hover:text-destructive focus-visible:ring-2 focus-visible:ring-destructive">',
   '<DSButton variant="outline" size="lg" onClick={() => void handleLogout()} disabled={loggingOut} aria-busy={loggingOut} className="min-h-12 w-full rounded-2xl border border-[#D9DDE3] bg-white !text-[#C9141B] shadow-sm hover:bg-[#FFF1F2] focus-visible:ring-2 focus-visible:ring-[#E51B23]">', "logout styling"],
  ['{error ? (\n            <DSCard',
   '{error ? (\n            <DSCard', "error section stability"],
]);

update("src/components/MovviHeader.tsx", [
  ['import { supabase } from "@/integrations/supabase/client";',
   'import { supabase } from "@/integrations/supabase/client";\nimport { signOutDriverOnThisDevice } from "@/lib/driverLocalSignOut";', "header logout import"],
  ['      const { error } = await supabase.auth.signOut();\n      if (error) throw error;\n      await navigate({ to: logoutRedirect as "/", replace: true });',
   '      await signOutDriverOnThisDevice();', "header logout local"],
]);

update("src/routes/motorista.app.tsx", [
  ['import { supabase } from "@/integrations/supabase/client";',
   'import { supabase } from "@/integrations/supabase/client";\nimport { signOutDriverOnThisDevice } from "@/lib/driverLocalSignOut";', "app logout import"],
  ['  async function handleLogout() {\n    await supabase.auth.signOut();\n    navigate({ to: "/" });\n  }',
   '  async function handleLogout() {\n    await signOutDriverOnThisDevice();\n  }', "app logout local"],
]);

update("src/components/ApoisDriverBottomNav.tsx", [
  ['label: "Notificações", icon: Bell', 'label: "Avisos", icon: Bell', "compact nav label"],
  ['className="max-w-full break-words text-center text-[11px] font-extrabold leading-3 tracking-tight"',
   'className="max-w-full truncate whitespace-nowrap text-center text-[10px] font-bold leading-4 tracking-tight"', "unbroken nav labels"],
]);

const cssPath = resolve(root, "src/styles.css");
const css = readFileSync(cssPath, "utf8");
if (css.includes("APOIS_DRIVER_PROFILE_V3")) throw new Error("[FAIL] Profile V3 already injected");
writeFileSync(cssPath, css + String.raw`
/* APOIS_DRIVER_PROFILE_V3 — visual-only, scoped to Motorista Perfil. */
[data-apois-driver-profile-v3] [class~="text-foreground"] { color:#111827 !important; }
[data-apois-driver-profile-v3] [class~="text-muted-foreground"] { color:#667085 !important; }
[data-apois-driver-profile-v3] [class~="bg-card"] { background-color:#fff !important; }
[data-apois-driver-profile-v3] [class~="bg-background"] { background-color:#F7F7F8 !important; }
[data-apois-driver-profile-v3] [role="alert"] { color:#991B1B; }
[data-apois-driver-profile-v3] input,
[data-apois-driver-profile-v3] textarea { color:#111827; }
`, "utf8");

const profile = readFileSync(resolve(root, "src/routes/motorista.perfil.tsx"), "utf8");
const nav = readFileSync(resolve(root, "src/components/ApoisDriverBottomNav.tsx"), "utf8");
const logout = readFileSync(signOutFile, "utf8");
for (const marker of [
  "data-apois-driver-profile-v3", "await signOutDriverOnThisDevice()",
  'bg-[#FFF1F2]', 'flex w-full justify-center',
]) if (!profile.includes(marker)) throw new Error("[FAIL] Profile V3 missing " + marker);
if (!nav.includes('label: "Avisos"') || !nav.includes("whitespace-nowrap")) throw new Error("[FAIL] Profile V3 nav");
if (!logout.includes('scope: "local"') || !logout.includes('sb-') || !logout.includes('window.location.replace')) throw new Error("[FAIL] Profile V3 logout");
console.log("[OK] APOIS Motorista V3: logout local protegido, perfil legível, foto compacta, menu e navegação sem quebra.");
