// APOIS_DRIVER_PROFILE_NATIVE_AVATAR_V1
// Native Android picker for MOTORISTA profile ONLY; preserves existing storage RPC.
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
const root=resolve(process.env.APOIS_MOTORISTA_WORKSPACE||".work/partner-motorista");
function one(s,old,next,label){const count=s.split(old).length-1;if(count!==1)throw Error("[FAIL] driver avatar "+label+" count="+count);return s.replace(old,next);}
const file=resolve(root,"src/components/ProfilePhotoUploader.tsx");
let s=readFileSync(file,"utf8");
if(!s.includes("APOIS_DRIVER_PROFILE_NATIVE_AVATAR_V1")){
  s=one(s,'import { compressImageToSquare } from "@/lib/imageCompress";',
    'import { compressImageToSquare } from "@/lib/imageCompress";\nimport { isNativeDriverPhotoPicker, pickDriverPhotoNative, isNativePickerCancellation } from "@/lib/driverNativePhotoPicker";\n// APOIS_DRIVER_PROFILE_NATIVE_AVATAR_V1',
    "native picker imports");
  s=one(s,'  currentUrl: string | null;','  currentUrl: string | null;\n  nativeDriverPicker?: boolean;', "optional driver-only picker prop");
  s=one(s,'  currentUrl,\n  onUploaded,','  currentUrl,\n  nativeDriverPicker = false,\n  onUploaded,', "picker prop extraction");
  s=one(s,'  const localPreviewRef = useRef<string | null>(null);',
    '  const localPreviewRef = useRef<string | null>(null);\n  const nativePickingRef = useRef(false);', "prevent native picker double tap");
  const handler=[
    '  async function selectNativeDriverPhoto() {',
    '    if (!nativeDriverPicker || !isNativeDriverPhotoPicker() || nativePickingRef.current || busy || loadingCurrent) return;',
    '    nativePickingRef.current=true;',
    '    setError(null);',
    '    try {',
    '      const picked=await pickDriverPhotoNative("gallery","user");',
    '      await handleFile(picked); // same compression, validation, upload and profile RPC',
    '    } catch (cause) {',
    '      if (!isNativePickerCancellation(cause) && mountedRef.current) {',
    '        setError("Não foi possível acessar a foto no Android. Confira as permissões da galeria e tente novamente.");',
    '      }',
    '    } finally { nativePickingRef.current=false; }',
    '  }',
    ''
  ].join("\n");
  s=one(s,'  async function handleRemove() {',handler+'  async function handleRemove() {',"native photo handler");
  s=one(s,
    '          onClick={() => inputRef.current?.click()}',
    '          onClick={() => { if (nativeDriverPicker && isNativeDriverPhotoPicker()) void selectNativeDriverPhoto(); else inputRef.current?.click(); }}',
    "photo selection button");
  writeFileSync(file,s,"utf8");
}
const profileFile=resolve(root,"src/routes/motorista.perfil.tsx");
let profile=readFileSync(profileFile,"utf8");
if(!profile.includes("APOIS_DRIVER_PROFILE_NATIVE_AVATAR_ROUTE_V1")){
  const before="onUploaded={handlePhotoUploaded} size=";
  profile=one(profile,before,'nativeDriverPicker onUploaded={handlePhotoUploaded} size=',"only Motorista profile opts in");
  profile=one(profile,'function DriverProfilePage() {',
    'function DriverProfilePage() {\n  // APOIS_DRIVER_PROFILE_NATIVE_AVATAR_ROUTE_V1',
    "driver opt-in marker");
  writeFileSync(profileFile,profile,"utf8");
}
for(const required of [
  "APOIS_DRIVER_PROFILE_NATIVE_AVATAR_V1",
  'pickDriverPhotoNative("gallery","user")',
  'await handleFile(picked)',
  'nativeDriverPicker && isNativeDriverPhotoPicker()'
])if(!s.includes(required))throw Error("[FAIL] native driver avatar "+required);
if(!profile.includes("APOIS_DRIVER_PROFILE_NATIVE_AVATAR_ROUTE_V1") || !profile.includes("nativeDriverPicker onUploaded={handlePhotoUploaded}"))throw Error("[FAIL] driver avatar opt-in missing");
console.log("[OK] Motorista profile uses native Android photo picker, old upload/RPC and browser input fallback preserved.");
