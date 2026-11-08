import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, resolve } from "node:path";
const hardener=resolve("scripts/harden-entregas-merchant-image-mime.mjs");
test("Produtos e logos rejeitam GIF/SVG, não repetem o hardener",()=>{
 const temp=mkdtempSync(resolve(tmpdir(),"apois-mime-"));
 const one=resolve(temp,"src/components/MerchantProductEditor.tsx");
 const two=resolve(temp,"src/routes/merchant.tsx");
 mkdirSync(dirname(one),{recursive:true});mkdirSync(dirname(two),{recursive:true});
 try{
  writeFileSync(one,'  const uploadImage = async (file: File) => {\n    if (!file.type.startsWith("image/")) return toast.error("Selecione uma imagem válida.");\n  };');
  writeFileSync(two,'  const uploadMerchantAsset = async (kind: "logo" | "cover", file: File) => {\n    if (!file.type.startsWith("image/")) {\n      toast.error("Selecione um arquivo de imagem válido.");\n      return;\n    }\n  };');
  const run=()=>execFileSync(process.execPath,[hardener],{cwd:resolve("."),env:{...process.env,APOIS_ENTREGAS_WORKSPACE:temp}});
  run();const x=readFileSync(one,"utf8"),y=readFileSync(two,"utf8");
  for(const s of [x,y]){
    assert.match(s,/\["image\/jpeg", "image\/png", "image\/webp"\]\.includes\(file\.type\)/);
    assert.match(s,/APOIS_MERCHANT_IMAGE_MIME_V1/);
    assert.doesNotMatch(s,/file\.type\.startsWith\("image\/"\)/);
  }
  run();assert.equal(readFileSync(one,"utf8"),x);assert.equal(readFileSync(two,"utf8"),y);
 }finally{rmSync(temp,{recursive:true,force:true});}
});
test("MIME hardener participa dos builds Cliente e Parceiro",()=>{
  for(const p of ["scripts/build-isolated-module.mjs","scripts/build-partner-modules.sh"])
    assert.match(readFileSync(p,"utf8"),/harden-entregas-merchant-image-mime\.mjs/);
});
