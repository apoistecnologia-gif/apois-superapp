// APOIS Relatorio 04 - INV-047/VIS-001 + INV-048.
// Patches disposable Motorista workspace after existing photo-capture and red-theme generators.
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
const workspace=resolve(process.cwd(),process.env.APOIS_MOTORISTA_WORKSPACE||".work/partner-motorista");
const read=(p)=>readFileSync(resolve(workspace,p),"utf8");
const write=(p,s)=>writeFileSync(resolve(workspace,p),s,"utf8");
function once(s,a,b,label){const count=s.split(a).length-1;if(count!==1)throw Error("[INV04] "+label+" expected 1 anchor, got "+count);return s.replace(a,b)}
const shared="src/lib/prepareDriverPickedFile.ts";
if (!existsSync(resolve(workspace,shared))) {
  const camera="src/components/DriverDocumentField.tsx";
  let src=read(camera);
  const start=src.indexOf("async function preparePickedFile(raw: File, photoOnly: boolean): Promise<File> {");
  const end=src.indexOf("// APOIS_ANDROID_DRIVER_PHOTO_CAPTURE_V2",start);
  if(start<0||end<0)throw Error("[INV048] Pinned photo picker changed");
  // Preserve the camera picker mechanics; central and documents consume the same safety contract.
  const module= [
    "// INV-048: independent file signature check, shared by registration, corrections and documents.",
    "export async function preparePickedFile(raw: File, photoOnly: boolean): Promise<File> {",
    "  if (!raw || raw.size <= 0) throw new Error(\"Arquivo vazio.\");",
    "  if (raw.size > 24 * 1024 * 1024) throw new Error(\"Arquivo acima de 24 MB para processamento.\");",
    "  const type = String(raw.type || \"\").toLowerCase();",
    "  if (type === \"image/heic\" || type === \"image/heif\" || /\\.hei[cf]$/i.test(raw.name)) throw new Error(\"Converta HEIC/HEIF em JPG ou PNG.\");",
    "  const head = new Uint8Array(await raw.slice(0, 16).arrayBuffer());",
    "  const has=(...bytes: number[])=>bytes.every((b,i)=>head[i]===b);",
    "  const jpeg=has(0xff,0xd8,0xff);",
    "  const png=has(0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a);",
    "  const webp=has(0x52,0x49,0x46,0x46)&&head[8]===0x57&&head[9]===0x45&&head[10]===0x42&&head[11]===0x50;",
    "  const pdf=has(0x25,0x50,0x44,0x46);",
    "  const detected=jpeg?\"image/jpeg\":png?\"image/png\":webp?\"image/webp\":pdf?\"application/pdf\":\"\";",
    "  if (!detected || (photoOnly && detected===\"application/pdf\")) throw new Error(\"Formato inválido. Use imagem JPG, PNG ou WebP\"+(photoOnly?\".\":\" ou PDF.\"));",
    "  if (type && type!==\"application/octet-stream\" && type!==detected && !(type===\"image/jpg\"&&detected===\"image/jpeg\"))",
    "    throw new Error(\"O conteúdo não corresponde ao formato informado.\");",
    "  const ext=detected===\"image/jpeg\"?\"jpg\":detected===\"image/png\"?\"png\":detected===\"image/webp\"?\"webp\":\"pdf\";",
    "  const name=(raw.name || \"arquivo\").replace(/\\.[^.]+$/,\"\") || \"arquivo\";",
    "  return new File([raw], name+\".\"+ext, {type:detected,lastModified:raw.lastModified||Date.now()});",
    "}",
    ""
  ].join("\n");
  write(shared,module);
  src=src.slice(0,start)+src.slice(end);
  src=once(src,'import { compressDocumentImage } from "@/lib/imageCompress";',
    'import { compressDocumentImage } from "@/lib/imageCompress";\nimport { preparePickedFile } from "@/lib/prepareDriverPickedFile";',
    "camera shared import");
  write(camera,src);
}
const p="src/components/ApoisDriverCorrections.tsx";
let s=read(p);
if(!s.includes("APOIS_REPORT04_CORRECTION_STATES")){
 s=once(s,'import {useCallback,useEffect,useState} from "react";',
  'import {useCallback,useEffect,useRef,useState} from "react";\nimport { preparePickedFile } from "@/lib/prepareDriverPickedFile";\n// APOIS_REPORT04_CORRECTION_STATES',
  "correction imports");
 s=once(s,' const [list,setList]=useState<Correction[]>([]);',
   ' const [list,setList]=useState<Correction[]>([]);\n const requestRef=useRef(0);\n const [loadError,setLoadError]=useState<string|null>(null);',
   "load error state");
 const start=s.indexOf(' const refresh=useCallback(async()=>{');
 const end=s.indexOf(' useEffect(()=>{void refresh();',start);
 if(start<0||end<0)throw Error("[INV047] refresh block changed");
 const refresh=[
 ' const refresh=useCallback(async()=>{',
 '  const ticket=++requestRef.current;',
 '  try{',
 '   const {data,error:loadError}=await (supabase as any).rpc("apois_driver_my_corrections");',
 '   if(ticket!==requestRef.current)return;',
 '   if(loadError||!Array.isArray(data))throw Error("corrections_query_failed");',
 '   setList(data);setLoadError(null);',
 '  }catch{if(ticket===requestRef.current)setLoadError("Não foi possível consultar as pendências; tente novamente.");}',
 '  finally{if(ticket===requestRef.current)setLoading(false);}',
 ' },[]);',
 ' '
 ].join("\n");
 s=s.slice(0,start)+refresh+s.slice(end);
 s=once(s,
  '  if(!["image/jpeg","image/png","image/webp"].includes(file.type)||file.size<=0||file.size>8*1024*1024){\n   setError("Envie imagem JPG, PNG ou WebP de até 8 MB.");return;\n  }',
  '  if(file.size<=0||file.size>24*1024*1024){setError("Escolha uma imagem válida de até 24 MB para preparação.");return;}',
  "correction file precheck");
 s=once(s,
  '  try{\n   const session=await supabase.auth.getUser();',
  '  try{\n   const prepared=await preparePickedFile(file,true);\n   if(prepared.size>8*1024*1024)throw Error("photo_too_large");\n   const session=await supabase.auth.getUser();',
  "correction file normalization");
 s=once(s,
  '   const ext=file.type==="image/jpeg"?"jpg":file.type==="image/png"?"png":"webp";',
  '   const ext=prepared.type==="image/jpeg"?"jpg":prepared.type==="image/png"?"png":"webp";',
  "normalized extension");
 s=once(s,
  '   const stored=await supabase.storage.from("apois-inspections").upload(path,file,{upsert:false,contentType:file.type});',
  '   const stored=await supabase.storage.from("apois-inspections").upload(path,prepared,{upsert:false,contentType:prepared.type});',
  "normalized upload");
 s=once(s,
  '      onChange={e=>{const file=e.currentTarget.files?.[0];e.currentTarget.value="";void sendPhoto(slot,file);}}',
  '      onChange={e=>{const input=e.currentTarget;const file=input.files?.[0];void sendPhoto(slot,file).finally(()=>{input.value="";});}}',
  "Android URI ownership");
 s=once(s,' if(!current)return null;',
  [
   ' if(!current&&!loadError)return null;',
   ' if(!current&&loadError)return <section data-apois-driver-corrections-v1 role="region" aria-label="Pendências do cadastro"',
   '  className="space-y-3 rounded-2xl border border-[#F2B6B9] bg-white p-4 text-[#374151]">',
   '  <p role="alert" className="text-sm text-red-700">{loadError}</p>',
   '  <button type="button" onClick={()=>void refresh()} className="min-h-11 rounded-xl bg-[#E51B23] px-4 text-sm font-bold text-white">Tentar novamente</button>',
   ' </section>;',
  ].join("\n"),
  "initial load error");
 s=once(s,
  '  <h2 className="text-base font-extrabold text-[#B71922]">Cadastro pendente de correção</h2>',
  '  <h2 className="text-base font-extrabold text-[#B71922]">Cadastro pendente de correção</h2>\n  {loadError&&<div className="space-y-2" role="alert"><p className="text-sm text-red-700">{loadError} Os dados já carregados continuam visíveis.</p><button type="button" onClick={()=>void refresh()} className="min-h-11 rounded-xl bg-[#E51B23] px-4 text-sm font-bold text-white">Tentar novamente</button></div>}',
  "loaded-error notice");
 write(p,s);
}
const docs="src/routes/motorista.documentos.tsx";
let d=read(docs);
if(!d.includes("APOIS_REPORT04_DOCUMENT_MIME")){
 d=once(d,
  'import { toast } from "sonner";',
  'import { toast } from "sonner";\nimport { preparePickedFile } from "@/lib/prepareDriverPickedFile";\n// APOIS_REPORT04_DOCUMENT_MIME',
  "documents helper import");
 d=once(d,
  '    if (!file) {\n      setUploadError("Nenhum arquivo foi selecionado.");\n      return;\n    }\n    if (!isAllowedFile(file, config)) {',
  '    if (!file) {\n      setUploadError("Nenhum arquivo foi selecionado.");\n      return;\n    }\n    try { file = await preparePickedFile(file, config.slot === "selfie" || config.slot === "vehicle_photo"); }\n    catch { setUploadError("Arquivo inválido. Use uma foto JPG, PNG ou WebP; PDF apenas para CNH/CRLV."); return; }\n    if (!isAllowedFile(file, config)) {',
  "documents normalized before MIME");
 d=once(d,
  'onChange={(event) => { const file = event.currentTarget.files?.[0]; event.currentTarget.value = ""; void handleFile(document, file); }}',
  'onChange={(event) => { const input=event.currentTarget; const file=input.files?.[0]; void handleFile(document, file).finally(()=>{input.value="";}); }}',
  "document URI retention");
 write(docs,d);
}
console.log("[OK] INV-047/048: retry visible in both modes; shared signature-based picker used by camera, corrections and documents");
