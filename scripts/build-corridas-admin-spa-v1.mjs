import {readFileSync,writeFileSync,existsSync,renameSync,rmSync,readdirSync} from "node:fs";
import {resolve} from "node:path";
import {spawnSync} from "node:child_process";
const root=process.cwd(),workspace=resolve(root,".work/partner-motorista");
const read=p=>readFileSync(resolve(workspace,p),"utf8");
const write=(p,text)=>writeFileSync(resolve(workspace,p),text,"utf8");
if(!existsSync(resolve(workspace,"node_modules/vite/bin/vite.js")))throw Error("[FAIL] Admin preview: Vite not installed");
const adminPaths=[
 "administradores","analytics","assinaturas","backups","categorias","configuracoes",
 "corridas","cupons","dashboard","financeiro-motoristas","financeiro","login",
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
for(const marker of ["Pendenciar cadastro","Visualizar foto internamente","/admin/login","/admin/motoristas"]){
 if(!js.includes(marker))throw Error("[FAIL] Admin preview expected marker missing: "+marker);
}
if(js.includes("Nova corrida. Embarque em"))throw Error("[FAIL] Admin preview includes operational Motorista app");
if(js.includes("https://movvi-go-connect.lovable.app/_serverFn/"))throw Error("[FAIL] Admin preview would send admin operations to legacy backend");
console.log("[OK] Admin-only SPA has login, documents, pendencies, no Motorista operational route.");
