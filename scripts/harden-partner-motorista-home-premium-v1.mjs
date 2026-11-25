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
for(const key of ["toggleOnline","const hasRideUI","<MovviMap","function IdleBottomPanel({","<ApoisDriverBottomNav"]){
 if(!app.includes(key))throw Error("[FAIL] fluxo operacional inesperado: "+key);
}
const top=readFileSync(resolve("scripts/templates/ApoisDriverHomePremiumTop.tsx.txt"),"utf8");
const panel=readFileSync(resolve("scripts/templates/ApoisDriverHomePremiumPanel.tsx.txt"),"utf8");
const perf=readFileSync(resolve("scripts/templates/ApoisDriverPerformancePage.tsx.txt"),"utf8");
app=swap(app,'import { createFileRoute, useNavigate } from "@tanstack/react-router";',
 'import { createFileRoute, useNavigate } from "@tanstack/react-router";\nimport { APOIS_PARTNER_LOGO_DATA_URL } from "@/assets/apoisPartnerLogoData";\nimport { Menu as ApoisHomeMenu, Bell as ApoisBell, CarFront as ApoisHomeCar, WalletCards as ApoisHomeWallet, Clock3 as ApoisHomeClock, BarChart3 as ApoisHomeChart, Radio as ApoisHomeSignal } from "lucide-react";',
 "importações");
const topBegin=app.indexOf("      {/* Top bar — glass flutuante premium");
const topEnd=app.indexOf("      {/* (status de GPS",topBegin);
if(topBegin<0||topEnd<=topBegin)throw Error("[FAIL] cabeçalho inesperado");
app=app.slice(0,topBegin)+top+app.slice(topEnd);
const panelBegin=app.indexOf("function IdleBottomPanel({");
const panelEnd=app.indexOf("/* ============================================================\n   OFERTA ENTRANTE",panelBegin);
if(panelBegin<0||panelEnd<=panelBegin)throw Error("[FAIL] painel inicial inesperado");
app=app.slice(0,panelBegin)+panel+"\n\n"+app.slice(panelEnd);
// Keep the idle Google map in its own viewport; ride/offer navigation remains full screen.
app=swap(app,'<div className="absolute inset-0">\n        <MovviMap','<div className="absolute inset-x-0" style={hasRideUI ? {top:0,bottom:0} : {top:"calc(env(safe-area-inset-top) + 102px)",bottom:"calc(max(env(safe-area-inset-bottom), 7px) + 174px)"}}>\n        <MovviMap',"viewport mapa livre");
app=swap(app,'            : "calc(env(safe-area-inset-bottom) + 260px)";','            : "calc(max(env(safe-area-inset-bottom), 7px) + 198px)";',"centralizar acima do painel");
app=swap(app,'background: "color-mix(in oklab, #111418 72%, transparent)",','background: !active ? "#FFFFFF" : "color-mix(in oklab, #111418 72%, transparent)",\n              color: !active ? "#24272C" : undefined,',"contraste GPS");
app=swap(app,'              applyNavigationCamera(m, position, polyline, activeNavigationDestination, true);\n            }','              applyNavigationCamera(m, position, polyline, activeNavigationDestination, true);\n            } else if (!active) {\n              m.setHeading(0);\n              m.setTilt(0);\n            }',"mapa idle norte e plano");
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
 'const styles = useMemo<google.maps.MapTypeStyle[]>(() => themeOverride === "client" ? [{ featureType: "poi", elementType: "labels.icon", stylers: [{ visibility: "off" }] }, { featureType: "transit", elementType: "labels.icon", stylers: [{ visibility: "off" }] }] : getMapStyleForTheme(theme), [theme, themeOverride]);',"estilo Google padrao");
map=swap(map,'const bgColor = useMemo(() => getMapBackgroundForTheme(theme), [theme]);',
 'const bgColor = useMemo(() => themeOverride === "client" ? "#E7E4DE" : getMapBackgroundForTheme(theme), [theme, themeOverride]);',"fundo mapa");
writeFileSync(mapPath,map,"utf8");
let nav=readFileSync(navPath,"utf8");
nav=swap(nav,'import { Bell, CarFront, House, UserRound, WalletCards } from "lucide-react";',
 'import { BarChart3, CarFront, House, UserRound, WalletCards } from "lucide-react";',"ícones nav");
if(nav.includes('  { to: "/motorista/carteira", label: "Carteira", icon: WalletCards },')){
  nav=swap(nav,'  { to: "/motorista/carteira", label: "Carteira", icon: WalletCards },',
   '  { to: "/motorista/ganhos", label: "Ganhos", icon: WalletCards },',"Ganhos");
}
if(!nav.includes('to: "/motorista/ganhos", label: "Ganhos"')) throw Error("[FAIL] navegação Ganhos ausente");
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
// Fixed compact home navigation matches reserved map/panel space.
nav=swap(nav,'className="mx-auto grid min-h-[70px] w-full max-w-md grid-cols-5 gap-1"','className={isHome ? "mx-auto grid h-[52px] w-full max-w-md grid-cols-5 gap-0" : "mx-auto grid min-h-[70px] w-full max-w-md grid-cols-5 gap-1"}',"altura nav home");
nav=swap(nav,'driver-nav-active text-[#E51B23]','text-[#E51B23]',"remove tema dourado CSS home");
nav=swap(nav,'className="driver-nav-icon relative mt-1 flex h-8 w-10 items-center justify-center rounded-xl transition-all duration-200 motion-reduce:transition-none"','className={isHome ? "relative mt-1 flex h-6 w-8 items-center justify-center" : "driver-nav-icon relative mt-1 flex h-8 w-10 items-center justify-center rounded-xl transition-all duration-200 motion-reduce:transition-none"}',"icone home compacto");
nav=swap(nav,'className="max-w-full break-words text-center text-[11px] font-extrabold leading-3 tracking-tight"','className={isHome ? "max-w-full whitespace-nowrap text-center text-[clamp(9px,2.55vw,11px)] font-bold leading-3 tracking-tight" : "max-w-full break-words text-center text-[11px] font-extrabold leading-3 tracking-tight"}',"rotulos sem quebra");
nav=swap(nav, "to={item.to}", "to={item.to as any}", "router legado tipado sem caminho novo");
writeFileSync(navPath,nav,"utf8");
writeFileSync(performancePath,perf,"utf8");
// A build mobile tem arvore manual separada da routeTree.gen.ts do site.
const mobileTreePath=resolve(root,"src/mobile-route-tree.motorista.ts");
let mobile=readFileSync(mobileTreePath,"utf8");
mobile=swap(mobile,
 "import { Route as MotoristaGanhosRouteImport } from './routes/motorista.ganhos'",
 "import { Route as MotoristaGanhosRouteImport } from './routes/motorista.ganhos'\nimport { Route as MotoristaDesempenhoRouteImport } from './routes/motorista.desempenho'",
 "import da rota nova");
mobile=swap(mobile,
 "const MotoristaLoginRoute = MotoristaLoginRouteImport.update({ id: '/motorista/login'",
 "const MotoristaDesempenhoRoute = MotoristaDesempenhoRouteImport.update({ id: '/motorista/desempenho', path: '/motorista/desempenho', getParentRoute: () => rootRouteImport } as any)\nconst MotoristaLoginRoute = MotoristaLoginRouteImport.update({ id: '/motorista/login'",
 "registro mobile");
mobile=swap(mobile,
 "  MotoristaGanhosRoute,\n  MotoristaLoginRoute,",
 "  MotoristaGanhosRoute,\n  MotoristaDesempenhoRoute,\n  MotoristaLoginRoute,",
 "filho do router mobile");
writeFileSync(mobileTreePath,mobile,"utf8");

console.log("[OK] APOIS Motorista: Home premium, mapa Cliente, status real e nav funcional.");
