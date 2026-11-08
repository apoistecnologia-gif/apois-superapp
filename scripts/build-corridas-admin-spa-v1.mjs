import {readFileSync,writeFileSync,existsSync,renameSync,rmSync,readdirSync} from "node:fs";
import {resolve} from "node:path";
import {spawnSync} from "node:child_process";
const root=process.cwd(),workspace=resolve(root,".work/partner-motorista");
const read=p=>readFileSync(resolve(workspace,p),"utf8");
const write=(p,text)=>writeFileSync(resolve(workspace,p),text,"utf8");
if(!existsSync(resolve(workspace,"src/routes/admin.login.tsx")))
  throw Error("[BLOCKED] Admin preview: workspace .work/partner-motorista ausente. Execute scripts/build-admin-vercel-preview.sh, que prepara o módulo.");
if(!existsSync(resolve(workspace,"node_modules/vite/bin/vite.js")))
  throw Error("[BLOCKED] Admin preview: Vite não instalado no workspace. Execute scripts/build-admin-vercel-preview.sh (npm run build:partner prepara dependências).");
// Restore the original released desktop login and its real password-recovery routes.
const authSnapshot=JSON.parse(readFileSync(resolve(root,"admin-preview/original-admin-auth-snapshot.json"),"utf8"));
const authFiles=["src/routes/admin.login.tsx","src/routes/admin.recuperar-senha.tsx","src/routes/admin.redefinir-senha.tsx"];
if(authSnapshot.source_repository!=="apoistecnologia-gif/movvi-go-connect"||authSnapshot.source_commit!=="2280c0979a7d047334916768faf519993bcb1e92")throw Error("[FAIL] Admin original auth snapshot mismatch");
if(Object.keys(authSnapshot.files??{}).length!==authFiles.length)throw Error("[FAIL] Unexpected Admin auth snapshot file count");
for(const path of authFiles){
 const content=authSnapshot.files[path];
 if(typeof content!=="string"||!content.trim())throw Error("[FAIL] Missing original Admin auth file: "+path);
 write(path,content);
}
if(!read("src/routes/admin.login.tsx").includes("data-apois-admin-desktop-login"))throw Error("[FAIL] Original split desktop login not restored");
if(!read("src/routes/admin.recuperar-senha.tsx").includes("resetPasswordForEmail"))throw Error("[FAIL] Secure password recovery not restored");
const recoveryPath="src/routes/admin.recuperar-senha.tsx";
// Visual-only mobile fix in disposable QA workspace: preserve all handlers.
const recoverySource=read(recoveryPath);
const recoveryButtonAnchor='className="min-h-12 w-full rounded-xl bg-[#E51B23] font-bold text-white hover:bg-[#C9141B]"';
if(recoverySource.split(recoveryButtonAnchor).length!==2)throw Error("[FAIL] Admin recovery button style anchor changed");
write(recoveryPath,recoverySource.replace(recoveryButtonAnchor,
 'className="min-h-[56px] h-auto w-full whitespace-normal px-2 py-3 text-center text-[13px] leading-snug font-bold text-white bg-[#E51B23] hover:bg-[#C9141B] sm:text-base"'));

const adminPaths=[
 "administradores","analytics","assinaturas","backups","categorias","configuracoes",
 "corridas","cupons","dashboard","financeiro-motoristas","financeiro","login","recuperar-senha","redefinir-senha",
 "logs","mapa","motoristas","notificacoes","operacoes","pagamentos",
 "passageiros","precos","relatorios","seguranca","suporte"
];
const ident=p=>"Admin"+p.split("-").map(n=>n.charAt(0).toUpperCase()+n.slice(1)).join("")+"Route";
const imports=[
 "/* APOIS_ADMIN_PREVIEW_ROUTE_TREE_V1: ADMIN WEB only. */",
 "import { Route as rootRouteImport } from './routes/__root'",
 ...adminPaths.map(p=>"import { Route as "+ident(p)+"Import } from './routes/admin."+p+"'")
];
const routes=adminPaths.map(p=>{
 const id=ident(p),url="/admin/"+p;
 if(!existsSync(resolve(workspace,"src/routes/admin."+p+".tsx")))throw Error("[FAIL] Admin route absent: "+p);
 return "const "+id+" = "+id+"Import.update({ id: '"+url+"', path: '"+url+"', getParentRoute: () => rootRouteImport } as any)";
});
write("src/admin-preview-route-tree.ts",imports.join("\n")+"\n\n"+routes.join("\n")+
 "\n\nexport const routeTree = rootRouteImport._addFileChildren({\n"+
 adminPaths.map(p=>"  "+ident(p)+",").join("\n")+"\n} as any)\n");
write("src/admin-preview.tsx","import {StrictMode} from \"react\";\nimport {createRoot} from \"react-dom/client\";\nimport {QueryClient} from \"@tanstack/react-query\";\nimport {createRouter,RouterProvider} from \"@tanstack/react-router\";\nimport {routeTree} from \"./admin-preview-route-tree\";\nimport {startInstance} from \"./start\";\nimport \"./styles.css\";\nimport \"./apois-admin-theme.css\";\nasync function bootstrap(){\n try{(window as unknown as {__TSS_START_OPTIONS__?: unknown}).__TSS_START_OPTIONS__=await startInstance.getOptions();}catch{}\n const router=createRouter({routeTree:routeTree as any,context:{queryClient:new QueryClient()},scrollRestoration:true,defaultPreloadStaleTime:0});\n const root=document.getElementById(\"root\");\n if(!root)throw Error(\"Admin Preview: mount element missing\");\n createRoot(root).render(<StrictMode><RouterProvider router={router}/></StrictMode>);\n}\nvoid bootstrap().catch(e=>{\n console.error(\"[APOIS Admin Preview] Falha ao inicializar\",e instanceof Error?e.message:\"erro\");\n const root=document.getElementById(\"root\");\n if(root)root.textContent=\"Não foi possível abrir o painel administrativo. Atualize a página ou contate a equipe APOIS.\";\n});");
// Recover exactly the earlier deployed professional Admin appearance from read-only source.
// Only these audited visual files are overlaid in the disposable QA workspace.
const snapshot=JSON.parse(readFileSync(resolve(root,"admin-preview/original-admin-visual-snapshot.json"),"utf8"));
if(snapshot.source_repository!=="apoistecnologia-gif/movvi-go-connect"||snapshot.source_commit!=="2280c0979a7d047334916768faf519993bcb1e92")throw Error("[FAIL] Admin visual snapshot provenance mismatch");
const visualPaths=[
 "src/apois-admin-theme.css","src/components/admin/AdminSidebar.tsx",
 "src/assets/apoisOfficial2026.ts","src/lib/adminVisual.ts","src/routes/admin.dashboard.tsx"
];
if(Object.keys(snapshot.files??{}).length!==visualPaths.length)throw Error("[FAIL] Admin visual snapshot contains unexpected paths");
for(const path of visualPaths){
 let content=snapshot.files[path];
 if(typeof content!=="string"||!content.trim())throw Error("[FAIL] Admin visual file missing: "+path);
 if(path==="src/routes/admin.dashboard.tsx"){
  // The pinned map component predates the later missingApiKeyMessage prop.
  const oldTag=/<MovviMap center=\{mapCenter\} missingApiKeyMessage="[^"]+">/;
  if(!oldTag.test(content))throw Error("[FAIL] Admin Dashboard compatibility anchor changed");
  content=content.replace(oldTag,"<MovviMap center={mapCenter}>");
 }
 write(path,content);
}
// APOIS_ADMIN_NAV_FINANCE_RESTORE_V1: expose the already-existing read-only
// Assinaturas/Pagamentos pages under existing permissions; never add a dead link
// or restore unverified legacy payment actions.
let sidebar=read("src/components/admin/AdminSidebar.tsx");
const financeNavAnchor='  { to: "/admin/financeiro", label: "Financeiro", icon: Wallet, permission: "finance.read" },';
if(sidebar.split(financeNavAnchor).length!==2)throw Error("[FAIL] Original Admin finance menu anchor changed");
if(!read("src/routes/admin.assinaturas.tsx").includes('createFileRoute("/admin/assinaturas")')||
   !read("src/routes/admin.pagamentos.tsx").includes('createFileRoute("/admin/pagamentos")'))
 throw Error("[FAIL] Admin finance subpages are not present");
sidebar=sidebar.replace('  Wallet,\n  ScrollText,','  Wallet,\n  CreditCard,\n  Receipt,\n  ScrollText,');
sidebar=sidebar.replace(financeNavAnchor,financeNavAnchor+
 '\n  { to: "/admin/assinaturas", label: "Assinaturas", icon: CreditCard, permission: "drivers.read" },'+
 '\n  { to: "/admin/pagamentos", label: "Pagamentos", icon: Receipt, permission: "finance.read" },');
write("src/components/admin/AdminSidebar.tsx",sidebar);

// APOIS_ADMIN_PREVIEW_DOCUMENT_API_V1: the Vercel QA preview is static.
// TanStack createServerFn has no backend at /_serverFn/. Use our authenticated
// Vercel QA API only for document signing. No source repository is modified.
const adminDriversFile="src/routes/admin.motoristas.tsx";
let adminDrivers=read(adminDriversFile);
const replaceDrivers=(needle,replacement,label)=>{
 const occurrences=adminDrivers.split(needle).length-1;
 if(occurrences!==1)throw Error("[FAIL] Admin preview "+label+": expected one anchor; got "+occurrences);
 adminDrivers=adminDrivers.replace(needle,replacement);
};
replaceDrivers('import { useServerFn } from "@tanstack/react-start";',
 '/* APOIS_ADMIN_PREVIEW_DOCUMENT_API_V1: serverFn replaced by isolated authenticated QA API */',
 "remove unserved TanStack backend");
replaceDrivers('import { getDriverDocumentUrls } from "@/lib/driverDocs.functions";',
 '/* Secure signed docs are served by /api/admin/driver-documents on Vercel QA. */',
 "drop unserved server import");
replaceDrivers('  const getDocs = useServerFn(getDriverDocumentUrls);',
 '  async function getDocs({data}:{data:{driverId:string}}){\n' +
 '    const {data:auth,error:authError}=await supabase.auth.getSession();\n' +
 '    if(authError||!auth.session?.access_token)throw new Error("admin_session_missing");\n' +
 '    const response=await fetch("/api/admin/driver-documents",{\n' +
 '      method:"POST",cache:"no-store",headers:{\n' +
 '        "Content-Type":"application/json",Authorization:"Bearer "+auth.session.access_token\n' +
 '      },body:JSON.stringify({driverId:data.driverId})\n' +
 '    });\n' +
 '    if(!response.ok)throw new Error("admin_document_service_"+response.status);\n' +
 '    const result=await response.json();\n' +
 '    if(!result||typeof result!=="object")throw new Error("admin_document_invalid_response");\n' +
 '    return result;\n' +
 '  }',
 "replace serverFn with authenticated QA route");
write(adminDriversFile,adminDrivers);

const guardFix=spawnSync(process.execPath,["scripts/fix-admin-guard-navigation-v1.mjs"],{cwd:root,stdio:"inherit"});
if(guardFix.status!==0)throw Error("[FAIL] QA Admin Guard navigation patch failed");
if(!read("src/apois-admin-theme.css").includes("APOIS_ADMIN_RED_2026"))throw Error("[FAIL] Original red Admin theme missing");
if(!read("src/components/admin/AdminSidebar.tsx").includes("APOIS_OFFICIAL_RED_LOGO_URL"))throw Error("[FAIL] Official Admin logo missing");
if(!read("src/lib/adminVisual.ts").includes("#E51B23"))throw Error("[FAIL] Admin map color not restored");
let html=read("index.mobile.html");
html=html.replaceAll("APOIS Motorista","APOIS Admin — Homologação");
// Route /admin/login must resolve assets from /assets, never /admin/assets.
if(!html.includes('<base href="./">'))throw Error("[FAIL] Admin preview: expected mobile relative base not found");
html=html.replace('<base href="./">','<base href="/">');
html=html.replace("Homologação para Android.","Homologação administrativa WEB.");
html=html.replace('class="dark" style="color-scheme: dark"','class="light" style="color-scheme: light"');
html=html.replace('document.documentElement.classList.add("dark");','document.documentElement.classList.remove("dark");');
html=html.replace('document.documentElement.style.colorScheme = "dark";','document.documentElement.style.colorScheme = "light";');
html=html.replace("/src/mobile.tsx","/src/admin-preview.tsx");
if(!html.includes("/src/admin-preview.tsx"))throw Error("[FAIL] Admin entry not generated");
write("index.admin-preview.html",html);
let config=read("vite.mobile.config.ts");
const pattern=/const activeRouteTree = resolve\([\s\S]*?\n\);/;
if(!pattern.test(config))throw Error("[FAIL] Admin config route alias moved");
config=config.replace(pattern,'const activeRouteTree = resolve(__dirname, "src/admin-preview-route-tree.ts");');
// Never send administrator server-function requests or credentials to legacy Lovable.
const legacyServerFn='const REMOTE_SERVER_FN_BASE = "https://movvi-go-connect.lovable.app/_serverFn/";';
if(!config.includes(legacyServerFn))throw Error("[FAIL] Admin preview: server function endpoint changed; review required");
config=config.replace(legacyServerFn,'const REMOTE_SERVER_FN_BASE = "/_serverFn/";');
config=config.replace('outDir: "dist/client"','outDir: "dist/admin-preview"');
config=config.replace('input: "index.mobile.html"','input: "index.admin-preview.html"');
if(!config.includes('dist/admin-preview')||!config.includes('src/admin-preview-route-tree.ts'))throw Error("[FAIL] Admin config mismatch");
write("vite.admin-preview.config.ts",config);
rmSync(resolve(workspace,"dist/admin-preview"),{recursive:true,force:true});
const build=spawnSync(process.execPath,["node_modules/vite/bin/vite.js","build","--config","vite.admin-preview.config.ts","--mode","mobile"],{
 cwd:workspace,stdio:"inherit",env:{...process.env,VITE_APP_ROLE:"admin",VITE_ENABLE_NATIVE_PUSH:"false"}
});
if(build.status!==0)throw Error("[FAIL] Admin SPA build exited "+build.status);
const original=resolve(workspace,"dist/admin-preview/index.admin-preview.html"),dest=resolve(workspace,"dist/admin-preview/index.html");
if(!existsSync(original))throw Error("[FAIL] Admin preview HTML absent");
renameSync(original,dest);
let outputHtml=readFileSync(dest,"utf8");
if(!outputHtml.includes('<base href="/">'))throw Error("[FAIL] Admin preview: relative asset base");
// Root-relative asset URLs also remain correct when a page is deep-linked or refreshed.
outputHtml=outputHtml.replace(/(src|href)="\.\/assets\//g,'$1="/assets/');
writeFileSync(dest,outputHtml,"utf8");
const assetUrls=[...outputHtml.matchAll(/(?:src|href)="(\/assets\/[^"]+)"/g)].map(m=>m[1]);
if(assetUrls.length<2)throw Error("[FAIL] Admin preview: JavaScript/CSS asset references missing");
for(const asset of assetUrls){
 const resolved=new URL(asset,"https://qa.example/admin/login");
 if(!resolved.pathname.startsWith("/assets/"))throw Error("[FAIL] Admin preview: deep-link asset resolution invalid");
}
const assetFiles=readdirSync(resolve(workspace,"dist/admin-preview/assets")).filter(p=>p.endsWith(".js"));
const js=assetFiles.map(p=>readFileSync(resolve(workspace,"dist/admin-preview/assets",p),"utf8")).join("\n");
for(const marker of ["Pendenciar cadastro","Visualizar foto internamente","/admin/assinaturas","/admin/pagamentos","/admin/login","/admin/motoristas","/admin/recuperar-senha","/admin/redefinir-senha","data-apois-admin-guard-cache-v1"]){
 if(!js.includes(marker))throw Error("[FAIL] Admin preview expected marker missing: "+marker);
}
if(js.includes("Nova corrida. Embarque em"))throw Error("[FAIL] Admin preview includes operational Motorista app");
if(js.includes("https://movvi-go-connect.lovable.app/_serverFn/"))throw Error("[FAIL] Admin preview would send admin operations to legacy backend");
console.log("[OK] Admin-only SPA has login, documents, pendencies, no Motorista operational route.");
