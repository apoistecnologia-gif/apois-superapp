// INV-014 — cache-safe versioned customer avatars, writes only isolated .work/entregas.
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
const path=resolve(process.env.APOIS_ENTREGAS_WORKSPACE||".work/entregas","src/routes/perfil/dados-pessoais.tsx");
let s=readFileSync(path,"utf8");
const marker="APOIS_CUSTOMER_AVATAR_VERSIONED_V1";
if(s.includes(marker)){console.log("[OK] INV-014 already installed");process.exit(0);}
const start="  const uploadAvatar = async (file: File) => {";
const end="  const deactivateAccount = async () => {";
const at=s.indexOf(start),until=s.indexOf(end,at+start.length);
if(at<0||until<0||s.indexOf(start,at+1)!==-1||s.indexOf(end,until+1)!==-1)
  throw Error("[FAIL] INV-014 avatar handler anchors ambiguous");
const replacement="  const uploadAvatar = async (file: File) => {\n    // APOIS_CUSTOMER_AVATAR_VERSIONED_V1 — unique object URL, no CDN staleness.\n    if (uploadingAvatar) return;\n    const allowed: Record<string, string> = { \"image/jpeg\": \"jpg\", \"image/png\": \"png\", \"image/webp\": \"webp\" };\n    const extension = allowed[file.type];\n    if (!extension) return void toast.error(\"Use uma imagem JPG, PNG ou WEBP.\");\n    if (file.size > maxAvatarBytes) return void toast.error(\"A foto precisa ter no máximo 5 MB.\");\n    setUploadingAvatar(true);\n    try {\n      const { data: { user }, error: userError } = await supabase.auth.getUser();\n      if (userError || !user) throw userError ?? new Error(\"Usuário não encontrado\");\n      const nonce = Math.random().toString(16).slice(2, 10).padEnd(8, \"0\");\n      const path = `${user.id}/customer-avatar/${Date.now()}-${nonce}.${extension}`;\n      const upload = await supabase.storage.from(\"avatars\").upload(path, file, {\n        upsert: false,\n        contentType: file.type,\n        cacheControl: \"3600\",\n      });\n      if (upload.error) throw upload.error;\n      const { data: publicData } = supabase.storage.from(\"avatars\").getPublicUrl(path);\n      const avatarUrl = publicData.publicUrl;\n      const update = await supabase\n        .from(\"profiles\")\n        .update({ avatar_url: avatarUrl })\n        .eq(\"id\", user.id)\n        .select(\"avatar_url\")\n        .maybeSingle();\n      if (update.error || update.data?.avatar_url !== avatarUrl) {\n        const checked = await supabase\n          .from(\"profiles\").select(\"avatar_url\").eq(\"id\", user.id).maybeSingle();\n        if (checked.error || checked.data?.avatar_url !== avatarUrl) {\n          // Do not remove an object while a delayed profile write may still reference it.\n          throw new Error(\"Foto enviada, mas não foi possível confirmar a atualização do perfil.\");\n        }\n      }\n      setProfile((current) => ({ ...current, avatar_url: avatarUrl }));\n      setAvatarVersion(Date.now());\n      toast.success(\"Foto de perfil atualizada.\");\n    } catch (error: any) {\n      toast.error(error?.message || \"Não foi possível atualizar sua foto de perfil.\");\n    } finally {\n      setUploadingAvatar(false);\n      if (fileInputRef.current) fileInputRef.current.value = \"\";\n    }\n  };\n";
s=s.slice(0,at)+replacement+s.slice(until);
if(!s.includes(marker)||!s.includes("const deactivateAccount = async () => {"))
  throw Error("[FAIL] INV-014 invalid source transform");
writeFileSync(path,s,"utf8");
console.log("[OK] INV-014 versioned customer avatar paths and profile readback.");
