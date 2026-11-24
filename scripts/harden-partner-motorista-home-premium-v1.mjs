// APOIS_DRIVER_HOME_PREMIUM_V1 — UI only, workspace isolado do Parceiro.
import {readFileSync,writeFileSync} from "node:fs";
import {resolve} from "node:path";
const root=resolve(process.env.APOIS_MOTORISTA_WORKSPACE||".work/partner-motorista");
const appPath=resolve(root,"src/routes/motorista.app.tsx");
const mapPath=resolve(root,"src/components/MovviMap.tsx");
const navPath=resolve(root,"src/components/ApoisDriverBottomNav.tsx");
const performancePath=resolve(root,"src/routes/motorista.desempenho.tsx");
function swap(src,oldValue,newValue,label){
 const count=src.split(oldValue).length-1;
 if(count!==1)throw Error("[FAIL] Home APOIS: "+label+" esperado 1, encontrado "+count);
 return src.replace(oldValue,newValue);
}
let app=readFileSync(appPath,"utf8");
if(app.includes("APOIS_DRIVER_HOME_PREMIUM_V1")){console.log("[OK] Home premium ja aplicada");process.exit(0);}
for(const key of ["toggleOnline","setSideMenuOpen(true)","const hasRideUI","<MovviMap","function IdleBottomPanel({","<ApoisDriverBottomNav"]){
 if(!app.includes(key))throw Error("[FAIL] fluxo operacional inesperado: "+key);
}
const top=readFileSync(resolve("scripts/templates/ApoisDriverHomePremiumTop.tsx.txt"),"utf8");
const panel=readFileSync(resolve("scripts/templates/ApoisDriverHomePremiumPanel.tsx.txt"),"utf8");
const perf=readFileSync(resolve("scripts/templates/ApoisDriverPerformancePage.tsx.txt"),"utf8");
app=swap(app,'import { createFileRoute, useNavigate } from "@tanstack/react-router";',
 'import { createFileRoute, useNavigate } from "@tanstack/react-router";\nimport { MovviLogo } from "@/components/MovviLogo";\nimport { Bell as ApoisBell, CarFront as ApoisHomeCar, WalletCards as ApoisHomeWallet, Clock3 as ApoisHomeClock, BarChart3 as ApoisHomeChart, Radio as ApoisHomeSignal } from "lucide-react";',
 "importações");
const topBegin=app.indexOf("      {/* Top bar — glass flutuante premium");
const topEnd=app.indexOf("      <DriverSideMenu",topBegin);
if(topBegin<0||topEnd<=topBegin)throw Error("[FAIL] cabeçalho inesperado");
app=app.slice(0,topBegin)+top+app.slice(topEnd);
const panelBegin=app.indexOf("function IdleBottomPanel({");
const panelEnd=app.indexOf("/* ============================================================\n   OFERTA ENTRANTE",panelBegin);
if(panelBegin<0||panelEnd<=panelBegin)throw Error("[FAIL] painel inicial inesperado");
app=app.slice(0,panelBegin)+panel+"\n\n"+app.slice(panelEnd);
app=swap(app,'themeOverride="dark"','themeOverride={!active ? "client" : "dark"}',"tema do mapa");
app=swap(app,'color={online ? "#F6BE1C" : "#94a3b8"}',
 'color={online && !active ? "#E51B23" : online ? "#F6BE1C" : "#94a3b8"}',"cor do marcador");
if(!app.includes('role="switch" aria-checked={online}')||!app.includes("toggleOnline={toggleOnline}"))
 throw Error("[FAIL] controle online original não preservado");
writeFileSync(appPath,app,"utf8");
let map=readFileSync(mapPath,"utf8");
map=swap(map,'themeOverride?: "light" | "dark";','themeOverride?: "light" | "dark" | "client";',"tipo do mapa");
map=swap(map,'const theme: "light" | "dark" = themeOverride ?? (isDriverRole ? "dark" : resolved);',
 'const theme: "light" | "dark" = (themeOverride === "client" ? "light" : themeOverride) ?? (isDriverRole ? "dark" : resolved);',"tema");
map=swap(map,'const styles = useMemo(() => getMapStyleForTheme(theme), [theme]);',
 'const styles = useMemo(() => themeOverride === "client" ? [] : getMapStyleForTheme(theme), [theme, themeOverride]);',"estilo Google padrao");
map=swap(map,'const bgColor = useMemo(() => getMapBackgroundForTheme(theme), [theme]);',
 'const bgColor = useMemo(() => themeOverride === "client" ? "#E7E4DE" : getMapBackgroundForTheme(theme), [theme, themeOverride]);',"fundo mapa");
writeFileSync(mapPath,map,"utf8");
let nav=readFileSync(navPath,"utf8");
nav=swap(nav,'import { Bell, CarFront, House, UserRound, WalletCards } from "lucide-react";',
 'import { BarChart3, CarFront, House, UserRound, WalletCards } from "lucide-react";',"ícones nav");
nav=swap(nav,'  { to: "/motorista/carteira", label: "Carteira", icon: WalletCards },',
 '  { to: "/motorista/ganhos", label: "Ganhos", icon: WalletCards },',"Ganhos");
nav=swap(nav,'  { to: "/motorista/notificacoes", label: "Notificações", icon: Bell },',
 '  { to: "/motorista/desempenho", label: "Desempenho", icon: BarChart3 },',"Desempenho");
nav=swap(nav,'  const showNav = !hidden && !rideActive;',
 '  const showNav = !hidden && !rideActive;\n  const isHome = pathname === "/motorista/app";',"nav home");
nav=swap(nav,
 'className="fixed inset-x-0 bottom-0 z-[35] min-w-0 overflow-x-hidden pt-1.5 shadow-[0_-18px_46px_rgba(0,0,0,.52)] backdrop-blur-2xl"',
 'className={isHome ? "fixed inset-x-0 bottom-0 z-[35] min-w-0 overflow-x-hidden border-t border-zinc-100 bg-white pt-1.5 shadow-[0_-8px_24px_rgba(0,0,0,.06)]" : "fixed inset-x-0 bottom-0 z-[35] min-w-0 overflow-x-hidden pt-1.5 shadow-[0_-18px_46px_rgba(0,0,0,.52)] backdrop-blur-2xl"}',"barra branca");
nav=swap(nav,'background: "linear-gradient(180deg, rgba(8,10,12,.90), rgba(4,5,6,.985))",',
 'background: isHome ? "#FFFFFF" : "linear-gradient(180deg, rgba(8,10,12,.90), rgba(4,5,6,.985))",',"fundo nav");
nav=swap(nav,'borderTop: "1px solid rgba(246,190,28,.12)",',
 'borderTop: isHome ? "1px solid #E9EBEF" : "1px solid rgba(246,190,28,.12)",',"linha nav");
nav=swap(nav,'text-zinc-400 transition-all duration-200',
 '$'+'{isHome ? "text-[#555B65]" : "text-zinc-400"} transition-all duration-200',"cores nav");
nav=swap(nav,'active ? "driver-nav-active bg-[#F6BE1C]/[.08] text-[#F6BE1C] ring-1 ring-inset ring-[#F6BE1C]/15" : ""',
 'active ? (isHome ? "driver-nav-active text-[#E51B23]" : "driver-nav-active bg-[#F6BE1C]/[.08] text-[#F6BE1C] ring-1 ring-inset ring-[#F6BE1C]/15") : ""',"ativo");
nav=swap(nav,'active ? "w-5 bg-[#F6BE1C]" : "w-4 bg-transparent"',
 'active ? (isHome ? "w-5 bg-[#E51B23]" : "w-5 bg-[#F6BE1C]") : "w-4 bg-transparent"',"indicador");
writeFileSync(navPath,nav,"utf8");
writeFileSync(performancePath,perf,"utf8");
console.log("[OK] APOIS Motorista: Home premium, mapa Cliente, status real e nav funcional.");
