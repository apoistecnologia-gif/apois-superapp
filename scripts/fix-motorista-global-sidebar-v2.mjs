import {readFileSync,writeFileSync} from "node:fs";
import {resolve} from "node:path";
const root=resolve(".work/partner-motorista");
function change(path,edits) {
 const f=resolve(root,path);let s=readFileSync(f,"utf8");
 for(const [a,b,label] of edits){const n=s.split(a).length-1;if(n!==1)throw Error("[FAIL] Motorista navegação "+label+" occurrences "+n);s=s.replace(a,b);}
 writeFileSync(f,s,"utf8");
}
change("src/components/MovviHeader.tsx",[
 ['import { ArrowLeft, Home, Loader2, LogOut } from "lucide-react";',
  'import { ArrowLeft, Home, Loader2, LogOut, Menu } from "lucide-react";\nimport { DriverSideMenu } from "@/components/DriverSideMenu";',
  "menu import"],
 ['  const [logoutError, setLogoutError] = useState<string | null>(null);',
  '  const [logoutError, setLogoutError] = useState<string | null>(null);\n  const [sideMenuOpen, setSideMenuOpen] = useState(false);',
  "drawer state"],
 ['  return (\n    <header',
  '  // APOIS_MOTORISTA_MENU_LATERAL_V2 - preserve existing DriverSideMenu and auth/logout handlers.\n  return (\n    <>\n    <header',
  "header wrapper"],
 ['        <Link\n          to={homePath as "/motorista/app"}\n          aria-label="Voltar ao mapa"',
  '        <button type="button" aria-label="Abrir menu lateral" onClick={() => setSideMenuOpen(true)}\n          className={buttonClass+" border border-[#E2E4E8] bg-white text-[#111827]"}>\n          <Menu className="h-[19px] w-[19px]" aria-hidden="true" />\n        </button>\n\n        <Link\n          to={homePath as "/motorista/app"}\n          aria-label="Voltar ao mapa"',
  "menu action"],
 ['    </header>\n  );',
  '    </header>\n    <DriverSideMenu open={sideMenuOpen} onOpenChange={setSideMenuOpen} onLogout={() => void handleLogout()} />\n    </>\n  );',
  "drawer render"]
]);
change("src/components/ApoisDriverBottomNav.tsx",[
 ['  const showNav = !hidden && !rideActive;',
  '  // APOIS_MOTORISTA_MENU_LATERAL_V2: retain ActiveRideRecovery, replace duplicate bottom tabs with original side menu.\n  const showNav = false;',
  "bottom nav hidden - ride recovery preserved"]
]);
change("src/routes/motorista.ganhos.tsx",[
 ['  RefreshCw,\n  Route as RouteIcon,','  RefreshCw,\n  Menu,\n  Route as RouteIcon,',"finance menu icon"],
 ['import { ApoisDriverBottomNav } from "@/components/ApoisDriverBottomNav";',
  'import { ApoisDriverBottomNav } from "@/components/ApoisDriverBottomNav";\nimport { DriverSideMenu } from "@/components/DriverSideMenu";',"finance menu import"],
 ['function DriverEarningsPage() {\n  const navigate = useNavigate();',
  'function DriverEarningsPage() {\n  const navigate = useNavigate();\n  const [sideMenuOpen, setSideMenuOpen] = useState(false);',"finance menu state"],
 ['          <button type="button" aria-label={loading ? "Atualizando financeiro"',
  '          <button type="button" aria-label="Abrir menu lateral" onClick={() => setSideMenuOpen(true)} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-[#E2E4E8] bg-white text-[#111827]"><Menu className="h-5 w-5" aria-hidden="true"/></button>\n          <button type="button" aria-label={loading ? "Atualizando financeiro"',"finance menu trigger"],
 ['      <ApoisDriverBottomNav />',
  '      <ApoisDriverBottomNav />\n      <DriverSideMenu open={sideMenuOpen} onOpenChange={setSideMenuOpen} />',"finance menu render"]
]);
change("src/routes/motorista.carteira.tsx",[
 ['  RefreshCw,\n  Send,','  RefreshCw,\n  Menu,\n  Send,',"wallet menu icon"],
 ['import { ApoisDriverBottomNav } from "@/components/ApoisDriverBottomNav";',
  'import { ApoisDriverBottomNav } from "@/components/ApoisDriverBottomNav";\nimport { DriverSideMenu } from "@/components/DriverSideMenu";',"wallet drawer import"],
 ['function DriverWalletPage() {\n  const navigate = useNavigate();',
  'function DriverWalletPage() {\n  const navigate = useNavigate();\n  const [sideMenuOpen, setSideMenuOpen] = useState(false);',"wallet state"],
 ['          <button type="button" aria-label="Atualizar carteira"',
  '          <button type="button" aria-label="Abrir menu lateral" onClick={() => setSideMenuOpen(true)} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-[#D9DDE3] bg-white text-[#111827]"><Menu className="h-5 w-5" aria-hidden="true"/></button>\n          <button type="button" aria-label="Atualizar carteira"',"wallet drawer trigger"],
 ['      <ApoisDriverBottomNav />',
  '      <ApoisDriverBottomNav />\n      <DriverSideMenu open={sideMenuOpen} onOpenChange={setSideMenuOpen} />',"wallet sidebar render"]
]);
console.log("[OK] APOIS Motorista: menu lateral em todas as páginas internas, preservando recuperação de corrida ativa.");
