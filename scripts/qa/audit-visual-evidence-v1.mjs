// APOIS visual evidence — fingerprint check, never infer screen coverage from filenames.
import { readdirSync, readFileSync, statSync, existsSync } from "node:fs";
import { createHash } from "node:crypto";
import { resolve } from "node:path";
const roots=["qa-visual","qa-browser"], found=[];
function collect(dir) {
  if(!existsSync(dir)) return;
  for (const x of readdirSync(dir)) {
    const file=resolve(dir,x);
    if(statSync(file).isDirectory()) { collect(file); continue; }
    if(!/\.(png|jpe?g|webp)$/i.test(x)) continue;
    const hash=createHash("sha256").update(readFileSync(file)).digest("hex");
    found.push({name:file.replace(resolve(".")+"/",""),hash});
  }
}
for (const root of roots) collect(root);
const groups=new Map();
for(const item of found){const v=groups.get(item.hash)??[];v.push(item.name);groups.set(item.hash,v);}
const duplicates=[...groups.values()].filter(x=>x.length>1).sort((a,b)=>b.length-a.length);
const output={files:found.length,distinctImages:groups.size,duplicateGroups:duplicates.map(x=>({count:x.length,files:x})),warning:"Arquivos iguais não comprovam cobertura visual de rotas diferentes; confirme URL final, conteúdo e sessão."};
console.log(JSON.stringify(output,null,2));
if(process.argv.includes("--strict")&&duplicates.length)process.exitCode=1;
