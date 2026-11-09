// INV-015 — only patch isolated merchant workspace. No mass storage cleanup.
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
const path=resolve(process.env.APOIS_ENTREGAS_WORKSPACE||".work/entregas","src/components/MerchantProductEditor.tsx");
let s=readFileSync(path,"utf8");
const marker="APOIS_MERCHANT_PRODUCT_IMAGE_RECONCILIATION_V1";
if(s.includes(marker)){console.log("[OK] INV-015 already installed");process.exit(0);}
const start="  const uploadImage = async (file: File) => {";
const end="  const createGroup = async () => {";
const begin=s.indexOf(start);
const finish=s.indexOf(end,begin+start.length);
if(begin<0||finish<0||s.indexOf(start,begin+1)>=0||s.indexOf(end,finish+1)>=0)
  throw Error("[FAIL] INV-015 source upload handler anchors not unique");
const replacement="  const uploadImage = async (file: File) => {\n    // APOIS_MERCHANT_IMAGE_MIME_V1\n    // APOIS_MERCHANT_PRODUCT_IMAGE_RECONCILIATION_V1\n    const allowed: Record<string, string> = { \"image/jpeg\": \"jpg\", \"image/png\": \"png\", \"image/webp\": \"webp\" };\n    const extension = allowed[file.type];\n    if (!extension) return toast.error(\"Envie uma imagem JPG, PNG ou WEBP.\");\n    if (file.size > 10 * 1024 * 1024) return toast.error(\"A imagem pode ter no máximo 10 MB.\");\n\n    setBusy(\"image\");\n    try {\n      const nonce = Math.random().toString(16).slice(2, 10).padEnd(8, \"0\");\n      const path = `${merchantId}/${product.id}-${Date.now()}-${nonce}.${extension}`;\n      const upload = await supabase.storage.from(\"product-images\").upload(path, file, {\n        cacheControl: \"3600\",\n        contentType: file.type,\n        upsert: false,\n      });\n      if (upload.error) throw upload.error;\n\n      const { data } = supabase.storage.from(\"product-images\").getPublicUrl(path);\n      const update = await from(\"products\")\n        .update({ image_url: data.publicUrl })\n        .eq(\"id\", product.id)\n        .eq(\"merchant_id\", merchantId)\n        .select(\"id, image_url\")\n        .maybeSingle();\n\n      // A lost HTTP response is not proof that the database update failed.\n      // Read back the exact product before considering the newly uploaded object orphaned.\n      if (update.error || update.data?.image_url !== data.publicUrl) {\n        const checked = await from(\"products\")\n          .select(\"image_url\")\n          .eq(\"id\", product.id)\n          .eq(\"merchant_id\", merchantId)\n          .maybeSingle();\n        if (checked.error || checked.data?.image_url !== data.publicUrl) {\n          // Never blindly delete this new file: a delayed commit could still reference it.\n          // Any orphan cleanup requires separately authorized server-side reconciliation.\n          throw new Error(update.error?.message || \"Imagem enviada, mas não foi possível confirmar a atualização do produto.\");\n        }\n      }\n      toast.success(\"Imagem atualizada.\");\n      try { await onChanged(); }\n      catch { toast.warning(\"Imagem salva. Atualize a tela para visualizar a alteração.\"); }\n    } catch (error: any) {\n      toast.error(error?.message || \"Não foi possível enviar a imagem.\");\n    } finally {\n      setBusy(null);\n    }\n  };\n";
s=s.slice(0,begin)+replacement+s.slice(finish);
if(!s.includes(marker)||!s.includes("const createGroup = async () => {"))
  throw Error("[FAIL] INV-015 invalid transform output");
writeFileSync(path,s,"utf8");
console.log("[OK] INV-015: merchant upload checks MIME, read-back and ambiguous-commit protection.");
