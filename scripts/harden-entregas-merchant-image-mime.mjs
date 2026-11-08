import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
const work = process.env.APOIS_ENTREGAS_WORKSPACE || ".work/entregas";
const cases = [
  {
    path: "src/components/MerchantProductEditor.tsx",
    old: 'if (!file.type.startsWith("image/")) return toast.error("Selecione uma imagem válida.");',
    next: '// APOIS_MERCHANT_IMAGE_MIME_V1\n    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) return toast.error("Envie uma imagem JPG, PNG ou WEBP.");',
  },
  {
    path: "src/routes/merchant.tsx",
    old: 'if (!file.type.startsWith("image/")) {\n      toast.error("Selecione um arquivo de imagem válido.");\n      return;\n    }',
    next: '// APOIS_MERCHANT_IMAGE_MIME_V1\n    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {\n      toast.error("Envie uma imagem JPG, PNG ou WEBP.");\n      return;\n    }',
  },
];
for (const item of cases) {
  const file = resolve(work, item.path);
  if (!existsSync(file)) throw new Error("[FAIL] Entregas: componente de imagem ausente: " + item.path);
  const before = readFileSync(file, "utf8");
  if (before.includes(item.next)) {
    console.log("[OK] Entregas: MIME de imagem já validado em " + item.path);
  } else if (before.includes("APOIS_MERCHANT_IMAGE_MIME_V1")) {
    throw new Error("[FAIL] Entregas: regra MIME sofreu alterações em " + item.path);
  } else if (before.split(item.old).length === 2) {
    writeFileSync(file, before.replace(item.old, item.next), "utf8");
    console.log("[OK] Entregas: imagem validada conforme Storage em " + item.path);
  } else {
    throw new Error("[FAIL] Entregas: estrutura de upload divergente em " + item.path);
  }
}

// Também restringe o seletor de arquivos de logo e capa ao formato suportado.
const merchantPath=resolve(work,"src/routes/merchant.tsx");
const previous=readFileSync(merchantPath,"utf8");
const broad=(previous.match(/accept="image\/\*"/g)||[]).length;
const narrow=(previous.match(/accept="image\/jpeg,image\/png,image\/webp"/g)||[]).length;
if(broad===2){
  writeFileSync(merchantPath,previous.replaceAll('accept="image/*"','accept="image/jpeg,image/png,image/webp"'),"utf8");
  console.log("[OK] Entregas: seletor logo/capa limitado aos formatos Storage");
}else if(broad===0 && narrow>=2){
  console.log("[OK] Entregas: seletores de logo/capa já alinhados");
}else{
  throw new Error("[FAIL] Entregas: seletores de logo/capa não reconhecidos");
}
