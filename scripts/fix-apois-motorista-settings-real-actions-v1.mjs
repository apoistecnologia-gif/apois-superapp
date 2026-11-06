// APOIS_DRIVER_SETTINGS_REAL_ACTIONS_V1 — scoped to Motorista.
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
const root=resolve(process.env.APOIS_MOTORISTA_WORKSPACE||".work/partner-motorista");
function edit(file,fn,marker) {
  const path=resolve(root,file),previous=readFileSync(path,"utf8");
  if(previous.includes(marker)) {console.log("[OK] settings action already applied "+file);return;}
  const next=fn(previous);
  if(previous===next||!next.includes(marker)) throw Error("[FAIL] settings action "+file);
  writeFileSync(path,next,"utf8");console.log("[OK] settings action "+file);
}
function one(s,from,to,label){
  const count=s.split(from).length-1;
  if(count!==1)throw Error("[FAIL] settings action "+label+" found "+count);
  return s.replace(from,to);
}
edit("src/routes/motorista.configuracoes.tsx",s=>{
  const titleAt=s.indexOf('title="Idioma"');
  if(titleAt<0){
    if(s.includes('<option value="en">') || s.includes('<option value="es">'))
      throw Error("[FAIL] language options still selectable without title");
    return '// APOIS_DRIVER_REAL_SETTINGS_VIDEO_V1: idioma unico do app, nao oferecer idiomas inativos.\n'+s;
  }
  const begin=s.lastIndexOf("<SettingsRow",titleAt);
  const closing=s.indexOf("/>",titleAt);
  const end=closing>=0 ? closing+2 : -1;
  if(begin<0||end<titleAt||end-begin>2400)
    throw Error("[FAIL] language control changed: "+JSON.stringify(s.slice(Math.max(0,titleAt-150),titleAt+780)));
  const old=s.slice(begin,end);
  if(!old.includes('value={prefs.language}')||!old.includes('<option value="es">'))
    throw Error("[FAIL] language options changed: "+JSON.stringify(old.slice(0,750)));
  // Textos reais nao sao traduzidos no aplicativo: nao anunciar tradutores inexistentes.
  const row=[
    '                {/* APOIS_DRIVER_REAL_SETTINGS_VIDEO_V1: not a fake language switch */}',
    '                <SettingsRow icon={Languages} title="Idioma da interface"',
    '                  hint="Novas traduções serão disponibilizadas somente quando estiverem completas."',
    '                  right={<span className="text-sm font-semibold text-[#111827]">Português (Brasil)</span>} />',
    ''
  ].join("\n");
  return one(s,old,row,"remove fake language selector");
},"APOIS_DRIVER_REAL_SETTINGS_VIDEO_V1");
edit("src/routes/motorista.app.tsx",s=>{
  // Waze/Google salvos nas configuracoes passam a afetar os botoes Navegar.
  s=one(s,'import { RIDE_CATEGORIES } from "@/lib/rideCategories";',
    'import { RIDE_CATEGORIES } from "@/lib/rideCategories";\nimport { loadDriverPrefs, type DriverPrefs } from "@/lib/driverPrefs";',
    "pref import");
  const helper=[
    '// APOIS_DRIVER_PREFERRED_NAV_VIDEO_V1 — map interno sempre permanece.',
    'function driverExternalNavigationHref(app: DriverPrefs["navigation_app"],lat:number|null|undefined,lng:number|null|undefined):string|undefined {',
    '  if(typeof lat!=="number"||typeof lng!=="number"||!Number.isFinite(lat)||!Number.isFinite(lng)||Math.abs(lat)>90||Math.abs(lng)>180)return undefined;',
    '  const point=encodeURIComponent(String(lat)+","+String(lng));',
    '  return app==="waze" ? "https://www.waze.com/ul?ll="+point+"&navigate=yes" : "https://www.google.com/maps/dir/?api=1&destination="+point+"&travelmode=driving";',
    '}',
    ''
  ].join("\n");
  s=one(s,'function ActiveRidePanel({',helper+'function ActiveRidePanel({',"nav function");
  const after='  const [cancelReason, setCancelReason] = useState("Passageiro não apareceu");';
  const hook=[
    '  const [preferredNavigationApp,setPreferredNavigationApp]=useState<DriverPrefs["navigation_app"]>("internal");',
    '  useEffect(()=>{',
    '    let alive=true;',
    '    void (async()=>{',
    '      const {data,error}=await supabase.auth.getUser();',
    '      if(error||!data.user?.id)return;',
    '      const prefs=await loadDriverPrefs(data.user.id);',
    '      if(alive)setPreferredNavigationApp(prefs.navigation_app);',
    '    })().catch(()=>{/* use default Google external link if prefs cannot load */});',
    '    return ()=>{alive=false;};',
    '  },[]);'
  ].join("\n");
  s=one(s,after,after+"\n"+hook,"nav preference hook");
  const patternPickup=/    const navHref = [^\n]*ride\.origin_lat[^\n]*ride\.origin_lng[^\n]*;/;
  const patternDest=/    const navHref = [^\n]*ride\.destination_lat[^\n]*ride\.destination_lng[^\n]*;/;
  if(!patternPickup.test(s)||!patternDest.test(s))throw Error("[FAIL] driver navigation CTA changed");
  s=s.replace(patternPickup,'    const navHref = driverExternalNavigationHref(preferredNavigationApp, ride.origin_lat, ride.origin_lng);');
  s=s.replace(patternDest,'    const navHref = driverExternalNavigationHref(preferredNavigationApp, ride.destination_lat, ride.destination_lng);');
  const oldChat=[
    '            <CircleAction',
    '              icon={MessageCircle}',
    '              label="Chat"',
    '              onClick={() => toast.info("Chat em breve")}',
    '            />'
  ].join("\n");
  const newChat=[
    '            <CircleAction',
    '              icon={MessageCircle}',
    '              label="Chat indisponível"',
    '              disabled',
    '            />'
  ].join("\n");
  const chatCount=s.split(oldChat).length-1;
  if(chatCount!==2)throw Error("[FAIL] legacy placeholder chat count="+chatCount);
  s=s.replaceAll(oldChat,newChat);
  const oldPickupLink=/href=\{\x60https:\/\/www\.google\.com\/maps\/dir\/\?api=1&destination=\$\{ride\.origin_lat\},\$\{ride\.origin_lng\}&travelmode=driving\x60\}/;
  if(!oldPickupLink.test(s))throw Error("[FAIL] pickup shortcut link changed");
  s=s.replace(oldPickupLink,'href={driverExternalNavigationHref(preferredNavigationApp, ride.origin_lat, ride.origin_lng)}');
  return s;
},"APOIS_DRIVER_PREFERRED_NAV_VIDEO_V1");
console.log("[OK] Motorista: navigation preference applied; no inoperative chat buttons or fake language list.");
