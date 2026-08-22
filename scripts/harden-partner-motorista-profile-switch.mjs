import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
const workspace = process.env.APOIS_MOTORISTA_WORKSPACE || '.work/partner-motorista';
const path = resolve(root, workspace, 'src/components/DriverSideMenu.tsx');
let source = readFileSync(path, 'utf8');

if (!source.includes('stopNativeDriverLocation')) {
  source = source.replace(
    'import { supabase } from "@/integrations/supabase/client";',
    'import { supabase } from "@/integrations/supabase/client";\nimport { stopNativeDriverLocation } from "@/lib/driverNativeLocation";',
  );
}

if (!source.includes('const [switchingProfile, setSwitchingProfile]')) {
  source = source.replace(
    '  const [reloadKey, setReloadKey] = useState(0);',
    '  const [reloadKey, setReloadKey] = useState(0);\n  const [switchingProfile, setSwitchingProfile] = useState(false);',
  );
}

if (!source.includes('async function handleSwitchPartnerProfile()')) {
  const anchor = `  const requestReload = useCallback(() => {\n    setReloadKey((value) => value + 1);\n  }, []);\n`;
  if (!source.includes(anchor)) throw new Error('[FAIL] DriverSideMenu.tsx: âncora de troca de perfil não encontrada');
  const handler = `${anchor}\n  async function handleSwitchPartnerProfile() {\n    if (switchingProfile) return;\n    setSwitchingProfile(true);\n    setLoadError(null);\n    try {\n      const driverId = String(profile?.id ?? \"\").trim();\n      if (driverId) {\n        const { data: activeRide, error: activeRideError } = await supabase\n          .from(\"rides\")\n          .select(\"id\")\n          .eq(\"driver_id\", driverId)\n          .in(\"status\", [\"motorista_a_caminho\", \"motorista_chegou\", \"em_viagem\"])\n          .limit(1)\n          .maybeSingle();\n        if (activeRideError) throw activeRideError;\n        if (activeRide?.id) {\n          setLoadError(\"Conclua a corrida ativa antes de trocar de perfil.\");\n          return;\n        }\n      }\n\n      const { error: presenceError } = await supabase.rpc(\"driver_set_presence\", {\n        _online: false,\n        _lat: null,\n        _lng: null,\n        _heading: null,\n        _speed: null,\n      });\n      if (presenceError) throw presenceError;\n      await stopNativeDriverLocation().catch(() => undefined);\n      try {\n        localStorage.setItem(\"apois:driver:online\", \"0\");\n        window.dispatchEvent(new CustomEvent(\"apois:driver-presence-change\", { detail: { online: false } }));\n      } catch {\n        // presença no backend já foi encerrada; storage é apenas auxiliar.\n      }\n      window.location.replace(\"../../index.html\");\n    } catch (error) {\n      if (import.meta.env.DEV) console.warn(\"[APOIS Motorista] falha ao trocar perfil\", error);\n      setLoadError(\"Não foi possível ficar offline para trocar de perfil. Tente novamente.\");\n    } finally {\n      setSwitchingProfile(false);\n    }\n  }\n`;
  source = source.replace(anchor, handler);
}

const oldButton = `              <button\n                type="button"\n                onClick={() => window.location.replace('../../index.html')}\n                className="flex min-h-12 w-full items-center justify-center gap-2 rounded-[18px] border border-[#F6BE1C]/20 bg-[#F6BE1C]/8 px-4 text-[12px] font-black uppercase tracking-[0.12em] text-[#F6BE1C] transition active:scale-[0.99]"\n              >\n                Trocar perfil de parceiro\n              </button>`;
const safeButton = `              <button\n                type="button"\n                onClick={() => void handleSwitchPartnerProfile()}\n                disabled={switchingProfile}\n                aria-busy={switchingProfile}\n                className="flex min-h-12 w-full items-center justify-center gap-2 rounded-[18px] border border-[#F6BE1C]/20 bg-[#F6BE1C]/8 px-4 text-[12px] font-black uppercase tracking-[0.12em] text-[#F6BE1C] transition active:scale-[0.99] disabled:cursor-wait disabled:opacity-60"\n              >\n                {switchingProfile ? <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden="true" /> : null}\n                {switchingProfile ? "Ficando offline..." : "Trocar perfil de parceiro"}\n              </button>`;
if (source.includes(oldButton)) source = source.replace(oldButton, safeButton);

for (const marker of [
  'async function handleSwitchPartnerProfile()',
  '.in("status", ["motorista_a_caminho", "motorista_chegou", "em_viagem"])',
  'Conclua a corrida ativa antes de trocar de perfil.',
  'rpc("driver_set_presence"',
  '_online: false,',
  'await stopNativeDriverLocation()',
  'localStorage.setItem("apois:driver:online", "0")',
  'onClick={() => void handleSwitchPartnerProfile()}',
  'disabled={switchingProfile}',
]) {
  if (!source.includes(marker)) throw new Error(`[FAIL] Motorista Parceiro: troca segura de perfil incompleta (${marker})`);
}
if (source.includes(`onClick={() => window.location.replace('../../index.html')}`)) {
  throw new Error('[FAIL] Motorista Parceiro: troca de perfil ainda pode abandonar presença ONLINE sem reconciliação');
}

writeFileSync(path, source, 'utf8');
console.log('[OK] Motorista Parceiro: trocar para Entregador primeiro confirma ausência de corrida ativa, fica OFFLINE no backend e encerra o serviço GPS nativo sem apagar a sessão.');
