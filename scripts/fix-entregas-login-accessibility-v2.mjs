// INV-029/030 — login Entregas: acessibilidade do código fonte PINADO.
// Não atribui a tela branca do Vercel ao snapshot escuro do checkout.
// Não altera autenticação, OAuth, senha, navegação ou cores da marca.
import {readFileSync,writeFileSync} from "node:fs";
import {resolve} from "node:path";
const path=resolve(".work/entregas/src/routes/login.tsx");
let src=readFileSync(path,"utf8");
const MARK="APOIS_LOGIN_ACCESSIBILITY_V2";
if(src.includes(MARK)){console.log("[OK] Login accessibility already applied");process.exit(0);}
function replaceCount(a,b,count,label){let n=src.split(a).length-1;if(n!==count)throw Error("[FAIL] login "+label+": "+n+"/"+count);src=src.replaceAll(a,b);}
replaceCount('  const [showPassword, setShowPassword] = useState(false);',
'  const [showPassword, setShowPassword] = useState(false);\n  // '+MARK+': HTML labels, autofill and real 44px touch targets.',1,"marker");
replaceCount('<label className="ml-1 text-xs font-bold text-zinc-400">E-mail</label>',
'<label htmlFor="apois-login-email" className="ml-1 text-xs font-bold text-zinc-400">E-mail</label>',1,"courier email label");
replaceCount('<label className="ml-1 text-xs font-bold text-zinc-400">Senha</label>',
'<label htmlFor="apois-login-password" className="ml-1 text-xs font-bold text-zinc-400">Senha</label>',1,"courier password label");
replaceCount('<label className="ml-1 text-sm font-medium text-zinc-400">E-mail</label>',
'<label htmlFor="apois-login-email" className="ml-1 text-sm font-medium text-zinc-400">E-mail</label>',1,"generic email label");
replaceCount('<label className="ml-1 text-sm font-medium text-zinc-400">Senha</label>',
'<label htmlFor="apois-login-password" className="ml-1 text-sm font-medium text-zinc-400">Senha</label>',1,"generic password label");
replaceCount('type="email"\n', 'id="apois-login-email"\n                    name="email"\n                    type="email"\n',2,"email field");
replaceCount('type={showPassword ? "text" : "password"}\n',
 'id="apois-login-password"\n                    name="password"\n                    type={showPassword ? "text" : "password"}\n',2,"password field");
replaceCount('className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-500 active:text-zinc-300"',
'className="absolute right-1 top-1/2 grid h-11 w-11 -translate-y-1/2 place-items-center rounded-lg text-zinc-500 active:text-zinc-300"',1,"courier show password");
replaceCount('className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300"',
'className="absolute right-1 top-1/2 grid h-11 w-11 -translate-y-1/2 place-items-center rounded-lg text-zinc-500 hover:text-zinc-300"',1,"generic show password");
replaceCount('className="-ml-2 grid h-10 w-10 place-items-center rounded-full',
 'className="-ml-2 grid h-11 w-11 place-items-center rounded-full',1,"courier back");
replaceCount('className="-ml-2 rounded-full p-2 transition-colors',
 'className="-ml-2 grid h-11 w-11 place-items-center rounded-full transition-colors',1,"generic back");
replaceCount('className="text-xs font-bold text-primary disabled:opacity-50"',
 'className="flex min-h-11 items-center px-2 text-xs font-bold text-primary disabled:opacity-50"',1,"courier recovery");
replaceCount('className="text-sm font-bold text-primary hover:underline disabled:opacity-50"',
 'className="flex min-h-11 items-center px-2 text-sm font-bold text-primary hover:underline disabled:opacity-50"',1,"generic recovery");
for(const token of [MARK,'htmlFor="apois-login-email"','name="password"','grid h-11 w-11'])if(!src.includes(token))throw Error("Missing login marker "+token);
writeFileSync(path,src,"utf8");
console.log("[OK] INV-029/030: input labels/accessibility and 44px touch areas guarded in current source.");
