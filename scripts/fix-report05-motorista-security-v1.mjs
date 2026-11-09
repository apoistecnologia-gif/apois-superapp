// APOIS Relatorio 05 (INV-049/050/051) — workspace Motorista Parceiro only.
// Apply AFTER harden-partner-motorista-native-utilities.mjs; no changes to source pins.
// No SOS, calls, navigation, Firebase, Supabase writes or emergency actions are executed.
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

const base=resolve(process.cwd(),process.env.APOIS_MOTORISTA_WORKSPACE||".work/partner-motorista");
const file=(p)=>resolve(base,p);
const read=(p)=>readFileSync(file(p),"utf8");
const write=(p,s)=>writeFileSync(file(p),s,"utf8");
function once(source,oldText,newText,label){
  const count=source.split(oldText).length-1;
  if(count!==1)throw Error("[INV05] "+label+": expected one anchor, got "+count);
  return source.replace(oldText,newText);
}
const classifierPath="src/lib/partnerLocationPermission.ts";
const classifier=[
  "// INV-049: Android 12+ may grant approximate/coarse while precise/fine is denied.",
  "export type PartnerLocationPermission = \"precise\" | \"approximate\" | \"denied\";",
  "export function classifyPartnerLocationPermission(status: { location?: string; coarseLocation?: string } | null | undefined): PartnerLocationPermission {",
  "  if(status?.location===\"granted\")return \"precise\";",
  "  if(status?.coarseLocation===\"granted\")return \"approximate\";",
  "  return \"denied\";",
  "}",
  ""
].join("\n");
if(existsSync(file(classifierPath))){
  if(read(classifierPath)!==classifier)throw Error("[INV05] shared permission helper drift");
}else write(classifierPath,classifier);

const security="src/routes/motorista.seguranca.tsx";
let s=read(security);
if(!s.includes("APOIS_REPORT05_SECURITY_V1")){
  s=once(s,'import { toast } from "sonner";',
    'import { toast } from "sonner";\nimport { classifyPartnerLocationPermission } from "@/lib/partnerLocationPermission";\n// APOIS_REPORT05_SECURITY_V1',"security import");
  const phoneStart=s.indexOf("function normalizePhone(value: unknown): string {");
  const phoneEnd=s.indexOf("\nfunction safeContactName(",phoneStart);
  if(phoneStart<0||phoneEnd<0)throw Error("[INV050] phone helpers moved");
  const phoneHelpers=[
    "function normalizePhone(value: unknown): string {",
    "  const raw=String(value??\"\").trim();",
    "  if(!raw || !/^\\+?[0-9 ()\\-.]+$/.test(raw))return \"\";",
    "  const digits=raw.replace(/\\D/g,\"\");",
    "  // Never truncate an emergency number: 16 digits must fail, not become 15.",
    "  if(digits.length<8||digits.length>15)return \"\";",
    "  return (raw.startsWith(\"+\")?\"+\":\"\")+digits;",
    "}",
    "",
    "function isUsablePhone(value: string): boolean {",
    "  return /^\\+?[0-9]{8,15}$/.test(value);",
    "}",
    ""
  ].join("\n");
  s=s.slice(0,phoneStart)+phoneHelpers+s.slice(phoneEnd);
  const geoStart=s.indexOf("async function getPartnerCurrentPosition(");
  const geoEnd=s.indexOf("\nfunction DriverSecurityPage() {",geoStart);
  if(geoStart<0||geoEnd<0)throw Error("[INV049] native helper not yet installed");
  const geoHelper=[
    "type SafetyPosition = { latitude:number; longitude:number; permission:\"precise\"|\"approximate\"|\"unknown\" };",
    "async function getPartnerCurrentPosition(timeout = 8000): Promise<SafetyPosition> {",
    "  if(Capacitor.isNativePlatform()){",
    "    const current=await Geolocation.checkPermissions();",
    "    let permission=classifyPartnerLocationPermission(current);",
    "    if(permission===\"denied\"){",
    "      const requested=await Geolocation.requestPermissions({permissions:[\"location\",\"coarseLocation\"]});",
    "      permission=classifyPartnerLocationPermission(requested);",
    "    }",
    "    if(permission===\"denied\")throw new Error(\"location_permission_denied\");",
    "    const position=await Geolocation.getCurrentPosition({enableHighAccuracy:permission===\"precise\",timeout,maximumAge:15000});",
    "    return {latitude:position.coords.latitude,longitude:position.coords.longitude,permission};",
    "  }",
    "  if(typeof navigator===\"undefined\"||!navigator.geolocation)throw new Error(\"geolocation_unavailable\");",
    "  const position=await new Promise<GeolocationPosition>((resolve,reject)=>{",
    "    navigator.geolocation.getCurrentPosition(resolve,reject,{enableHighAccuracy:true,timeout,maximumAge:15000});",
    "  });",
    "  return {latitude:position.coords.latitude,longitude:position.coords.longitude,permission:\"unknown\"};",
    "}",
    ""
  ].join("\n");
  s=s.slice(0,geoStart)+geoHelper+s.slice(geoEnd);
  s=once(s,"  const [sharingLocation, setSharingLocation] = useState(false);",
    "  const [sharingLocation, setSharingLocation] = useState(false);\n  const [shareFallback, setShareFallback] = useState<{url:string;permission:SafetyPosition[\"permission\"]}|null>(null);",
    "share fallback state");
  s=once(s,'      setFormError("Informe um telefone válido com DDD.");',
    '      setFormError(phone.replace(/\\D/g,"").length>15 ? "Telefone excede 15 dígitos. Confira o número completo antes de salvar." : "Informe um telefone válido com DDD, sem letras ou caracteres inválidos.");',
    "invalid number feedback");
  s=once(s,'{cleanPhone || "Telefone indisponível"}',
    '{cleanPhone || String(contact.phone ?? "").trim() || "Telefone indisponível"}',
    "preserve display of historical invalid numbers");
  s=once(s,'setPhone(event.target.value.slice(0, 24));','setPhone(event.target.value);',
    "non destructive phone input");
  s=once(s,' maxLength={24} placeholder="Ex.: (87) 99999-9999"',' placeholder="Ex.: (87) 99999-9999"',
    "remove silent input maxLength");

  const shareStart=s.indexOf("  async function shareLocation(): Promise<void> {");
  const shareEnd=s.indexOf("\n  return (\n    <div",shareStart);
  if(shareStart<0||shareEnd<0)throw Error("[INV051] location share function boundary changed");
  const shareFunctions=[
    "  async function shareLocation(): Promise<void> {",
    "    if(sharingLocation)return;",
    "    setSharingLocation(true);",
    "    setShareFallback(null);",
    "    try {",
    "      const {latitude,longitude,permission}=await getPartnerCurrentPosition(8000);",
    "      if(!validCoordinate(latitude,longitude))throw Error(\"invalid_location\");",
    "      const url=\"https://maps.google.com/?q=\"+latitude+\",\"+longitude;",
    "      const message=permission===\"approximate\"",
    "        ? \"Esta é minha localização aproximada; não representa um ponto preciso de embarque.\"",
    "        : permission===\"unknown\" ? \"Localização obtida pelo dispositivo (precisão não confirmada).\"",
    "        : \"Localização atual (a precisão depende do sinal GPS).\";",
    "      if(navigator.share){",
    "        try {",
    "          await navigator.share({title:\"Minha localização — APOIS\",text:message,url});",
    "          return;",
    "        }catch(shareError){",
    "          // User intentionally closed the OS share sheet: never copy or reveal fallback.",
    "          if(shareError&&typeof shareError===\"object\"&&\"name\" in shareError&&shareError.name===\"AbortError\")return;",
    "          setShareFallback({url,permission});",
    "          toast.error(\"Compartilhamento não concluído. Use Copiar link para tentar manualmente.\");",
    "          return;",
    "        }",
    "      }",
    "      // Do not copy automatically: clipboard may need a new user gesture.",
    "      setShareFallback({url,permission});",
    "      toast.message(\"Link preparado. Toque em Copiar link para continuar.\");",
    "    }catch(caughtError){",
    "      if(caughtError&&typeof caughtError===\"object\"&&\"name\" in caughtError&&caughtError.name===\"AbortError\")return;",
    "      if(import.meta.env.DEV)console.warn(\"[APOIS Motorista] share location unavailable\",caughtError);",
    "      toast.error(caughtError instanceof Error&&caughtError.message===\"location_permission_denied\"",
    "        ? \"Permissão de localização negada. Ative a localização para compartilhar.\"",
    "        : \"Não foi possível obter a localização. Confira o GPS e tente novamente.\");",
    "    }finally{setSharingLocation(false);}",
    "  }",
    "",
    "  async function copyPreparedLocationLink():Promise<void> {",
    "    if(!shareFallback)return;",
    "    try {",
    "      if(!navigator.clipboard?.writeText)throw Error(\"clipboard_unavailable\");",
    "      await navigator.clipboard.writeText(shareFallback.url);",
    "      toast.success(\"Link da localização copiado.\");",
    "      setShareFallback(null);",
    "    }catch{toast.error(\"Cópia automática indisponível. Selecione o endereço abaixo para copiar manualmente.\");}",
    "  }",
    ""
  ].join("\n");
  s=s.slice(0,shareStart)+shareFunctions+s.slice(shareEnd);
  const afterShare='          </div>\n        </section>\n\n        <section className="min-w-0 rounded-[24px]';
  const shareUI=[
    '          </div>',
    '          {shareFallback && <div className="mt-3 min-w-0 space-y-2 rounded-xl border border-white/10 bg-[#111315] p-3" role="status" aria-live="polite">',
    '            <p className="break-words text-xs text-zinc-300">{shareFallback.permission==="approximate" ? "Localização aproximada: não usar como ponto exato de embarque." : shareFallback.permission==="unknown" ? "Precisão do dispositivo não confirmada." : "Link de localização preparado."}</p>',
    '            <label className="block break-words text-xs text-zinc-300">Link para copiar',
    '              <input type="text" readOnly value={shareFallback.url} onFocus={e=>e.currentTarget.select()}',
    '                aria-label="Link de localização para copiar manualmente" className="mt-1 min-h-11 w-full min-w-0 rounded-lg border border-white/20 bg-[#050607] px-2 text-sm text-white" />',
    '            </label>',
    '            <div className="flex flex-wrap gap-2">',
    '              <button type="button" onClick={()=>void copyPreparedLocationLink()} className="min-h-11 flex-1 rounded-xl bg-[#F6BE1C] px-3 text-sm font-bold text-black">Copiar link</button>',
    '              <button type="button" onClick={()=>setShareFallback(null)} className="min-h-11 rounded-xl border border-white/20 px-3 text-sm text-white">Ocultar</button>',
    '            </div>',
    '          </div>}',
    '        </section>',
    '',
    '        <section className="min-w-0 rounded-[24px]'
  ].join("\n");
  s=once(s,afterShare,shareUI,"share fallback JSX");
  if(s.includes('.slice(0, 15)')||!s.includes("getPartnerCurrentPosition(5000).catch(() => null)"))
    throw Error("[INV05] phone truncation or SOS continuity regression");
  // A coarse-only coordinate may help the SOS, but must never be described as precise.
  s=once(s,
    'description: hasValidPosition ? "Sua localização atual foi incluída no alerta." : "O alerta foi enviado sem coordenadas de localização.",',
    'description: hasValidPosition ? (coords?.permission==="approximate" ? "A localização aproximada foi incluída no alerta." : "Sua localização atual foi incluída no alerta.") : "O alerta foi enviado sem coordenadas de localização.",',
    "SOS approximate description");
  s=once(s,
    '      toast.error(caughtError instanceof Error&&caughtError.message==="location_permission_denied"\n        ? "Permissão de localização negada. Ative a localização para compartilhar."\n        : "Não foi possível obter a localização. Confira o GPS e tente novamente.");',
    [
      '      const reason=caughtError instanceof Error?caughtError.message:"";',
      '      toast.error(reason==="location_permission_denied"',
      '        ? "Permissão de localização negada. Ative a localização para compartilhar."',
      '        : /OS-PLUG-GLOC-0007|OS-PLUG-GLOC-0017/.test(reason)',
      '          ? "A localização está desligada no aparelho."',
      '          : /OS-PLUG-GLOC-0010|timeout|timed out/i.test(reason)',
      '            ? "O GPS não respondeu a tempo. Tente novamente."',
      '            : "Não foi possível obter a localização. Confira o GPS e tente novamente.");'
    ].join("\n"),"GPS disabled and timeout feedback");
  write(security,s);
}

const settings="src/routes/motorista.configuracoes.tsx";
let config=read(settings);
if(!config.includes("APOIS_REPORT05_LOCATION_DIAGNOSTIC_V1")){
  config=once(config,'import { Geolocation } from "@capacitor/geolocation";',
    'import { Geolocation } from "@capacitor/geolocation";\nimport { classifyPartnerLocationPermission } from "@/lib/partnerLocationPermission";\n// APOIS_REPORT05_LOCATION_DIAGNOSTIC_V1',
    "settings imports");
  config=once(config,'useState<PermissionState | "unsupported" | null>(null)',
    'useState<PermissionState | "approximate" | "off" | "timeout" | "unsupported" | null>(null)',
    "settings approximate state");
  config=once(config,
    '          setLocState(\n            nativeState.location === "granted"\n              ? "granted"\n              : nativeState.location === "denied"\n                ? "denied"\n                : "unsupported",\n          );',
    '          // The session adapter can report fine-denied despite coarse-granted.\n          const nativeGps=await Geolocation.checkPermissions().catch(()=>null);\n          const gpsQuality=nativeGps?classifyPartnerLocationPermission(nativeGps):"denied";\n          setLocState(nativeGps ? (gpsQuality==="precise"?"granted":gpsQuality==="approximate"?"approximate":"denied") : (nativeState.location==="granted"?"granted":nativeState.location==="denied"?"denied":"unsupported"));',
    "settings native initial state");
  const start=config.indexOf("  async function handleTestLocation() {");
  const end=config.indexOf("  function handleClearCache() {",start);
  if(start<0||end<0)throw Error("[INV049] settings helper not installed");
  const test=[
    "  async function handleTestLocation() {",
    "    if(testingLocation)return;",
    "    setTestingLocation(true);",
    "    try{",
    "      let lat:number,lng:number;",
    "      let quality:\"precise\"|\"approximate\"|\"unknown\"=\"unknown\";",
    "      if(isNative()){",
    "        const current=await Geolocation.checkPermissions();",
    "        quality=classifyPartnerLocationPermission(current);",
    "        if(quality===\"denied\"){",
    "          const requested=await Geolocation.requestPermissions({permissions:[\"location\",\"coarseLocation\"]});",
    "          quality=classifyPartnerLocationPermission(requested);",
    "        }",
    "        if(quality===\"denied\"){setLocState(\"denied\");throw Error(\"location_permission_denied\");}",
    "        const position=await Geolocation.getCurrentPosition({enableHighAccuracy:quality===\"precise\",timeout:10000,maximumAge:0});",
    "        lat=position.coords.latitude;lng=position.coords.longitude;",
    "      }else{",
    "        if(typeof navigator===\"undefined\"||!navigator.geolocation){setLocState(\"unsupported\");throw Error(\"geolocation_unavailable\");}",
    "        const position=await new Promise<GeolocationPosition>((resolve,reject)=>navigator.geolocation.getCurrentPosition(resolve,reject,{enableHighAccuracy:true,timeout:10000,maximumAge:0}));",
    "        lat=position.coords.latitude;lng=position.coords.longitude;",
    "      }",
    "      if(!Number.isFinite(lat)||!Number.isFinite(lng)||Math.abs(lat)>90||Math.abs(lng)>180)throw Error(\"invalid_location\");",
    "      setLocState(quality===\"approximate\"?\"approximate\":\"granted\");",
    "      toast.success(quality===\"approximate\"",
    "        ? \"Localização aproximada disponível. Para embarque e corridas, ative a localização precisa nas configurações do aparelho.\"",
    "        : \"Localização disponível. A precisão depende do sinal GPS.\");",
    "    }catch(error){",
    "      const message=error instanceof Error?error.message:\"\";",
    "      const denied=message===\"location_permission_denied\";",
    "      const off=/OS-PLUG-GLOC-0007|OS-PLUG-GLOC-0017/.test(message);",
    "      const timeout=/OS-PLUG-GLOC-0010|timeout|timed out/i.test(message);",
    "      if(denied)setLocState(\"denied\");",
    "      else if(off)setLocState(\"off\");",
    "      else if(timeout)setLocState(\"timeout\");",
    "      toast.error(denied?\"Permissão de localização negada.\":off?\"A localização está desligada no aparelho.\":timeout?\"Tempo esgotado ao obter localização. Tente novamente.\":\"Não foi possível obter sua localização agora.\");",
    "    }finally{setTestingLocation(false);}",
    "  }",
    ""
  ].join("\n");
  config=config.slice(0,start)+test+config.slice(end);
  config=once(config,
    'hint={locState === "granted" ? "Permitida" : locState === "denied" ? "Bloqueada — ajuste nas configurações do aparelho" : locState === "unsupported" ? "Indisponível" : "Pendente"}',
    'hint={locState === "granted" ? "Permissão precisa — disponível" : locState === "approximate" ? "Localização aproximada — para corridas, habilite a precisa" : locState === "denied" ? "Bloqueada — ajuste nas configurações do aparelho" : locState === "off" ? "GPS desligado no aparelho" : locState === "timeout" ? "GPS demorou para responder — tente novamente" : locState === "unsupported" ? "Indisponível" : "Pendente"}',
    "settings hint");
  write(settings,config);
}
console.log("[OK] Relatorio 05: coarse-vs-precise, phone no truncation and explicit share recovery");
