import {mkdtempSync,mkdirSync,readFileSync,writeFileSync,rmSync} from "node:fs";
import {tmpdir} from "node:os";
import {join,dirname,resolve} from "node:path";
import {spawnSync} from "node:child_process";
import assert from "node:assert/strict";
const script=resolve("scripts/fix-partner-input-contrast-v1.mjs");
const temp=mkdtempSync(join(tmpdir(),"apois-form-"));
const fixtures={
  motorista:{
    "src/styles.css":"body{background:white}",
    "src/routes/motorista.login.tsx":'<form onSubmit={onSubmit} method="post"><input name="email"/></form>',
    "src/routes/motorista.cadastro.tsx":'<form ref={formRef} onSubmit={onSubmit}><input name="password"/></form>'
  },
  entregador:{
    "src/system-theme.css":"body{background:white}",
    "src/routes/register.tsx":'<form onSubmit={handleSubmit} method="post"><input name="email"/></form>',
    "src/routes/redefinir-senha.tsx":'<form onSubmit={savePassword} method="post"><input name="password"/></form>'
  }
};
try{
 for(const [mode,entries] of Object.entries(fixtures)){
  const base=join(temp,".work/partner-"+mode);
  for(const [rel,content] of Object.entries(entries)){const p=join(base,rel);mkdirSync(dirname(p),{recursive:true});writeFileSync(p,content);}
  const run=()=>spawnSync(process.execPath,[script,mode],{cwd:temp,encoding:"utf8"});
  let r=run();assert.equal(r.status,0,r.stderr);
  const snapshot=Object.fromEntries(Object.keys(entries).map(p=>[p,readFileSync(join(base,p),"utf8")]));
  for(const [rel,content] of Object.entries(snapshot)) {
    if(rel.endsWith(".tsx"))assert.equal(content.split("data-apois-input-contrast-v1").length-1,1);
    else {
      for(const token of ["APOIS_INPUT_CONTRAST_V1","#111827","-webkit-text-fill-color",":-webkit-autofill",":focus-visible","::placeholder"])assert(content.includes(token),token);
      if(mode==="motorista") for(const token of ["APOIS_MOTORISTA_PASSWORD_REVEAL_320_V1","flex:1 1 0% !important","flex:0 0 44px !important"])assert(content.includes(token),token);
    }
  }
  r=run();assert.equal(r.status,0,r.stderr);
  for(const [rel,content] of Object.entries(snapshot))assert.equal(readFileSync(join(base,rel),"utf8"),content,"Idempotence "+rel);
  console.log("[PASS] "+mode+": scope, readability tokens and idempotence");
 }
 const p=join(temp,".work/partner-motorista/src/routes/motorista.login.tsx");
 writeFileSync(p,'<form onSubmit={changed} />');
 const rejected=spawnSync(process.execPath,[script,"motorista"],{cwd:temp,encoding:"utf8"});
 assert.notEqual(rejected.status,0,"Must fail closed on changed source anchor");
 console.log("[PASS] Source drift must abort instead of silently skipping the correction");
}finally{rmSync(temp,{recursive:true,force:true})}
