import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
// Patches a disposable QA workspace only; original private source remains untouched.
const root = resolve(".work/partner-motorista");
const path = resolve(root, "src/components/DriverDocumentField.tsx");
const compressPath = resolve(root, "src/lib/imageCompress.ts");
const original = readFileSync(path, "utf8");
if (!original.includes("compressDocumentImage") || !original.includes("cameraRef") || !original.includes("galleryRef")) {
  throw Error("[FAIL] DriverDocumentField source changed; review before overwriting.");
}
if (!original.includes("APOIS_ANDROID_DRIVER_PHOTO_CAPTURE_V2")) {
  const updated = "import { useEffect, useRef, useState } from \"react\";\nimport { Camera, Image as ImageIcon, Trash2, Loader2, CheckCircle2, FileText } from \"lucide-react\";\nimport { compressDocumentImage } from \"@/lib/imageCompress\";\n\ntype Props = {\n  id: string;\n  label: string;\n  helper?: string;\n  file: File | null;\n  onChange: (file: File | null) => void;\n  camera?: boolean;\n  facing?: \"user\" | \"environment\";\n  accept?: string;\n};\n\nconst MAX_BYTES = 8 * 1024 * 1024;\nconst PHOTO_TYPES = new Set([\"image/jpeg\", \"image/jpg\", \"image/png\", \"image/webp\"]);\nconst DOCUMENT_TYPES = new Set([...PHOTO_TYPES, \"application/pdf\"]);\nconst PHOTO_ACCEPT = \"image/jpeg,image/png,image/webp\";\nconst DOCUMENT_ACCEPT = PHOTO_ACCEPT + \",application/pdf\";\n\nasync function preparePickedFile(raw: File, photoOnly: boolean): Promise<File> {\n  if (raw.size <= 0) throw new Error(\"A câmera não retornou uma imagem. Tente novamente.\");\n  const type = raw.type.toLowerCase();\n  if (type === \"image/heic\" || type === \"image/heif\" || /\\.hei[cf]$/i.test(raw.name)) {\n    throw new Error(\"Esta foto está em HEIC/HEIF. Configure a câmera para JPG ou escolha uma imagem JPG/PNG.\");\n  }\n  if (photoOnly && type === \"application/pdf\") throw new Error(\"Este campo exige uma foto JPG, PNG ou WebP.\");\n  if ((photoOnly ? PHOTO_TYPES : DOCUMENT_TYPES).has(type)) return raw;\n  // Android document providers sometimes return an empty MIME type for valid camera pictures.\n  if (type === \"\" || type === \"application/octet-stream\") {\n    const head = new Uint8Array(await raw.slice(0, 16).arrayBuffer());\n    const jpeg = head[0] === 0xff && head[1] === 0xd8 && head[2] === 0xff;\n    const png = head[0] === 0x89 && head[1] === 0x50 && head[2] === 0x4e && head[3] === 0x47;\n    const webp = String.fromCharCode(...head.slice(0, 4)) === \"RIFF\"\n      && String.fromCharCode(...head.slice(8, 12)) === \"WEBP\";\n    const pdf = !photoOnly && String.fromCharCode(...head.slice(0, 4)) === \"%PDF\";\n    const normalized = jpeg ? \"image/jpeg\" : png ? \"image/png\" : webp ? \"image/webp\" : pdf ? \"application/pdf\" : \"\";\n    if (normalized) {\n      const ext = jpeg ? \".jpg\" : png ? \".png\" : webp ? \".webp\" : \".pdf\";\n      return new File([raw], (raw.name || \"arquivo\").replace(/\\.[^.]+$/, \"\") + ext,\n        { type: normalized, lastModified: raw.lastModified || Date.now() });\n    }\n  }\n  throw new Error(photoOnly ? \"Formato não suportado. Use uma foto JPG, PNG ou WebP.\"\n    : \"Formato não suportado. Use JPG, PNG, WebP ou PDF.\");\n}\n\n// APOIS_ANDROID_DRIVER_PHOTO_CAPTURE_V2: preserve file access until processing ends.\nexport function DriverDocumentField({\n  id, label, helper, file, onChange, camera = true, facing = \"environment\", accept,\n}: Props) {\n  const cameraRef = useRef<HTMLInputElement>(null);\n  const galleryRef = useRef<HTMLInputElement>(null);\n  const activeRef = useRef(false);\n  const [preview, setPreview] = useState<string | null>(null);\n  const [previewFailed, setPreviewFailed] = useState(false);\n  const [processing, setProcessing] = useState(false);\n  const [error, setError] = useState<string | null>(null);\n  const photoOnly = id === \"doc-selfie\" || id === \"doc-vehicle-photo\" || id.startsWith(\"inspection-\");\n  const effectiveAccept = photoOnly ? PHOTO_ACCEPT : (accept || DOCUMENT_ACCEPT);\n\n  useEffect(() => {\n    setPreviewFailed(false);\n    if (!file || file.type === \"application/pdf\") {\n      setPreview(null);\n      return;\n    }\n    const url = URL.createObjectURL(file);\n    setPreview(url);\n    return () => URL.revokeObjectURL(url);\n  }, [file]);\n\n  async function handle(raw?: File) {\n    if (activeRef.current || !raw) return;\n    activeRef.current = true;\n    setError(null);\n    setProcessing(true);\n    try {\n      // Do not clear the native input yet: Android WebView may still need its content URI.\n      const picked = await preparePickedFile(raw, photoOnly);\n      // Attempt compression even above 8 MB; many camera originals become much smaller.\n      if (picked.size > 24 * 1024 * 1024) {\n        throw new Error(\"Arquivo muito grande. Escolha uma foto de até 24 MB para processamento.\");\n      }\n      const out = await compressDocumentImage(picked, { maxSize: 1600, quality: 0.85 });\n      if (out.size <= 0) throw new Error(\"A foto ficou vazia. Tente outra imagem.\");\n      if (out.size > MAX_BYTES) {\n        throw new Error(\"Não foi possível reduzir a imagem para 8 MB. Use uma foto JPG menor.\");\n      }\n      onChange(out);\n    } catch (cause) {\n      setError(cause instanceof Error && cause.message && !cause.message.includes(\"image_decode_failed\")\n        ? cause.message : \"Não foi possível ler a foto. Tente novamente pela Galeria com uma imagem JPG.\");\n    } finally {\n      activeRef.current = false;\n      setProcessing(false);\n      if (cameraRef.current) cameraRef.current.value = \"\";\n      if (galleryRef.current) galleryRef.current.value = \"\";\n    }\n  }\n\n  const done = Boolean(file) && !processing;\n  const displayName = file?.name || (photoOnly ? \"Foto\" : \"Documento\");\n  return (\n    <div data-apois-driver-photo-field-v2\n      className={\"min-w-0 rounded-2xl border p-3.5 shadow-sm \" +\n        (done ? \"border-emerald-200 bg-white\" : \"border-slate-200 bg-white\")}\n      aria-busy={processing} aria-describedby={id + \"-status\" + (error ? \" \" + id + \"-error\" : \"\")}>\n      <div className=\"mb-3 flex min-w-0 items-start justify-between gap-2\">\n        <div className=\"min-w-0 flex-1\">\n          <p className=\"break-words text-sm font-bold leading-5 text-slate-900\">\n            {label} <span className=\"text-[#E51B23]\" aria-hidden=\"true\">*</span>\n            <span className=\"sr-only\">obrigatório</span>\n          </p>\n          {helper && <p className=\"mt-1 break-words text-xs leading-5 text-slate-600\">{helper}</p>}\n        </div>\n        {done && <CheckCircle2 aria-label=\"Anexado\" className=\"h-5 w-5 shrink-0 text-emerald-600\" />}\n      </div>\n\n      <div className=\"flex min-w-0 items-center gap-3\">\n        <div className=\"relative flex h-[76px] w-[76px] shrink-0 items-center justify-center overflow-hidden rounded-xl border border-slate-200 bg-slate-100\">\n          {preview && !previewFailed ? (\n            <img src={preview} alt={\"Prévia de \" + label} className=\"h-full w-full object-cover\"\n              onError={() => setPreviewFailed(true)} />\n          ) : file?.type === \"application/pdf\"\n            ? <FileText className=\"h-8 w-8 text-[#E51B23]\" aria-hidden=\"true\" />\n            : <ImageIcon className=\"h-7 w-7 text-slate-400\" aria-hidden=\"true\" />}\n          {processing && <div role=\"status\" aria-label=\"Preparando foto\"\n            className=\"absolute inset-0 flex items-center justify-center bg-black/60\">\n            <Loader2 className=\"h-6 w-6 animate-spin text-white\" aria-hidden=\"true\" />\n          </div>}\n        </div>\n\n        <div className=\"grid min-w-0 flex-1 grid-cols-1 gap-2\">\n          {camera && <button type=\"button\" disabled={processing}\n            onClick={() => cameraRef.current?.click()}\n            className=\"inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#E51B23] px-2 py-2 text-sm font-bold text-white shadow-sm disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#E51B23]\">\n            <Camera className=\"h-4 w-4 shrink-0\" aria-hidden=\"true\" />\n            {file ? \"Refazer foto\" : \"Tirar foto\"}\n          </button>}\n          <button type=\"button\" disabled={processing} onClick={() => galleryRef.current?.click()}\n            className=\"inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-2 py-2 text-sm font-bold text-slate-800 shadow-sm disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#E51B23]\">\n            <ImageIcon className=\"h-4 w-4 shrink-0\" aria-hidden=\"true\" />\n            {file ? \"Trocar arquivo\" : \"Galeria\"}\n          </button>\n        </div>\n      </div>\n\n      <input ref={cameraRef} id={id + \"-camera\"} type=\"file\" accept={PHOTO_ACCEPT}\n        capture={facing} className=\"sr-only\" aria-label={\"Tirar foto para \" + label}\n        disabled={processing} onChange={(e) => void handle(e.currentTarget.files?.[0])} />\n      <input ref={galleryRef} id={id} type=\"file\" accept={effectiveAccept}\n        className=\"sr-only\" aria-label={\"Selecionar arquivo para \" + label}\n        disabled={processing} onChange={(e) => void handle(e.currentTarget.files?.[0])} />\n\n      <div className=\"mt-3 flex min-w-0 items-center justify-between gap-2\">\n        <p id={id + \"-status\"} aria-live=\"polite\"\n          className={\"min-w-0 flex-1 break-words text-xs leading-5 \" +\n            (done ? \"font-semibold text-emerald-700\" : \"text-slate-600\")}>\n          {processing ? \"Preparando arquivo...\" : file ? displayName + \" anexado\" :\n            photoOnly ? \"Foto ainda não anexada\" : \"Documento ainda não anexado\"}\n        </p>\n        {file && !processing && <button type=\"button\" onClick={() => {\n          onChange(null); setError(null); setPreviewFailed(false);\n        }} className=\"inline-flex min-h-10 shrink-0 items-center gap-1 rounded-lg px-2 text-xs font-semibold text-red-700\"\n          aria-label={\"Remover \" + label}>\n          <Trash2 className=\"h-4 w-4\" aria-hidden=\"true\" /> Remover\n        </button>}\n      </div>\n      {error && <p id={id + \"-error\"} role=\"alert\"\n        className=\"mt-2 rounded-xl border border-red-200 bg-red-50 p-3 text-xs font-medium leading-5 text-red-800\">\n        {error}\n      </p>}\n    </div>\n  );\n}\n";
  writeFileSync(path, updated, "utf8");
}
let compressor = readFileSync(compressPath, "utf8");
const marker = "export async function compressDocumentImage(";
if (!compressor.includes("APOIS_ANDROID_IMAGE_FALLBACK_V2")) {
  if (!compressor.includes(marker) || !compressor.includes("export async function compressImageToSquare(")) {
    throw Error("[FAIL] Image compression contract changed; not replacing.");
  }
  const prefix = compressor.slice(0, compressor.indexOf(marker));
  const replacement = String.raw`// APOIS_ANDROID_IMAGE_FALLBACK_V2: Android WebView may reject bitmap/canvas for a valid
// camera content URI. Preserve validated original bytes rather than losing the chosen photo.
export async function compressDocumentImage(
  file: File,
  opts: { maxSize?: number; quality?: number } = {},
): Promise<File> {
  if (!file.type.startsWith("image/")) return file;
  const maxSize = opts.maxSize ?? 1600;
  const quality = opts.quality ?? 0.85;
  let bitmap: ImageBitmap | HTMLImageElement | null = null;
  try {
    bitmap = await loadBitmap(file);
    const w = (bitmap as ImageBitmap).width || (bitmap as HTMLImageElement).naturalWidth;
    const h = (bitmap as ImageBitmap).height || (bitmap as HTMLImageElement).naturalHeight;
    if (!w || !h) throw new Error("image_decode_failed");
    const scale = Math.min(1, maxSize / Math.max(w, h));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(w * scale));
    canvas.height = Math.max(1, Math.round(h * scale));
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("image_decode_failed");
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(bitmap as CanvasImageSource, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
    if (!blob) throw new Error("image_decode_failed");
    if (blob.size >= file.size) return file;
    const base = file.name.replace(/\.[^.]+$/, "") || "documento";
    return new File([blob], base + ".jpg", { type: "image/jpeg", lastModified: Date.now() });
  } catch {
    // Only allow fallback for a real JPEG/PNG/WebP signature; do not accept corrupt or HEIC bytes.
    const b = new Uint8Array(await file.slice(0, 16).arrayBuffer());
    const jpeg = file.type === "image/jpeg" && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff;
    const png = file.type === "image/png" && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47;
    const webp = file.type === "image/webp"
      && String.fromCharCode(...b.slice(0, 4)) === "RIFF"
      && String.fromCharCode(...b.slice(8, 12)) === "WEBP";
    if (!jpeg && !png && !webp) throw new Error("image_decode_failed");
    return file;
  } finally {
    if (bitmap && "close" in bitmap) (bitmap as ImageBitmap).close();
  }
}
`;
  compressor = prefix + replacement;
  writeFileSync(compressPath, compressor, "utf8");
}
console.log("[OK] APOIS Motorista: native file URI kept until read, valid original fallback, white photo cards.");
