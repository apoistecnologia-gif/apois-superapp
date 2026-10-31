import {readFileSync,writeFileSync,mkdirSync} from "node:fs";
import {resolve,dirname} from "node:path";
const motor=resolve(".work/partner-motorista/src/routes/motorista.app.tsx");
const courier=resolve(".work/partner-entregador/src/routes/courier.tsx");
const component=String.raw`
import { useCallback, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

type Result = {label:string;status:"ok"|"warn"|"unknown";detail:string};
export function ApoisStatusCheck({role,online,onClose,approved,documentsReady}:{
  role:"motorista"|"entregador";online:boolean;onClose:()=>void;
  approved?:boolean|null;documentsReady?:boolean|null;
}) {
  const [busy,setBusy]=useState(false);
  const [results,setResults]=useState<Result[]>([]);
  const [tested,setTested]=useState(false);
  const test=useCallback(async()=>{
    setBusy(true);setTested(false);setResults([]);
    const output:Result[]=[];
    const add=(label:string,status:Result["status"],detail:string)=>output.push({label,status,detail});
    const internet=navigator.onLine;
    add("1. Internet",internet?"ok":"warn",internet?"Dispositivo conectado à rede.":"Sem conexão de rede detectada.");
    let gpsOk=false;
    if(typeof navigator.geolocation?.getCurrentPosition==="function"){
      gpsOk=await new Promise<boolean>(resolveGps=>{
        navigator.geolocation.getCurrentPosition(
          p=>resolveGps(Number.isFinite(p.coords.latitude)&&Number.isFinite(p.coords.longitude)),
          ()=>resolveGps(false),
          {enableHighAccuracy:true,timeout:12000,maximumAge:15000}
        );
      });
      add("2. Localização",gpsOk?"ok":"warn",gpsOk?"GPS respondeu com coordenadas válidas.":"GPS sem posição válida. Verifique a permissão e o sinal.");
    } else add("2. Localização","warn","Este dispositivo não disponibiliza geolocalização.");
    const {data:userData,error:authError}=await supabase.auth.getUser();
    const authenticated=Boolean(!authError&&userData.user);
    add("3. Conta autenticada",authenticated?"ok":"warn",authenticated?"Sessão verificada com o servidor.":"Sessão não verificada. Faça login novamente.");
    let serverReady=false;
    let accountApproved=approved??null;
    let docsOk=documentsReady??null;
    let backendOnline: boolean|null=null;
    if(authenticated){
      try {
        const name=role==="motorista"?"driver_get_profile":"get_courier_incoming_offers";
        const {data,error}=await (supabase as any).rpc(name);
        if(!error){
          serverReady=true;
          if(role==="motorista"&&data){
            accountApproved=String(data.approval_status??"").toLowerCase()==="aprovado" &&
              !data.blocked_at && !data.suspended_at;
            docsOk=String(data.documents_status??"") === "approved";
            backendOnline=data.is_online===true;
          }
        }
      } catch {serverReady=false;}
    }
    add("4. Cadastro e documentos",
      accountApproved===false||docsOk===false?"warn":accountApproved&&docsOk?"ok":"unknown",
      accountApproved===false?"Cadastro ainda não aprovado ou bloqueado.":
      docsOk===false?"Confira os documentos exigidos na área Perfil.":
      accountApproved&&docsOk?"Cadastro e documentos aprovados.":"Não foi possível confirmar os documentos nesta verificação.");
    const onlineVerified=backendOnline===null?null:online&&backendOnline;
    add("5. Disponibilidade",!online?"warn":onlineVerified===false?"warn":onlineVerified?"ok":"unknown",
      !online?"Você está OFFLINE. Ative sua disponibilidade para receber chamadas.":
      onlineVerified===false?"O aplicativo e o servidor divergem sobre o status ONLINE. Atualize a sessão.":
      onlineVerified===true?"ONLINE confirmado pelo servidor.":"ONLINE mostrado no aplicativo; confirmação remota ainda não realizada.");
    add("6. Servidor de chamadas",serverReady?"ok":"warn",
      serverReady?"API consultada com sucesso. Isso não garante permissão de notificações PUSH.":"Não foi possível consultar a API de ofertas. Verifique a conexão e tente novamente.");
    setResults(output);setTested(true);setBusy(false);
  },[role,online,approved,documentsReady]);
  return (
    <div className="fixed inset-0 z-[999] flex items-end justify-center bg-black/65 p-3 pb-[calc(env(safe-area-inset-bottom)+12px)] sm:items-center"
      role="dialog" aria-modal="true" aria-labelledby="apois-status-check-title">
      <section className="w-full max-w-md max-h-[88dvh] overflow-y-auto rounded-3xl border border-[#F0D9DE] bg-white p-5 text-[#111827] shadow-2xl">
        <div className="flex items-center justify-between gap-3">
          <h2 id="apois-status-check-title" className="text-lg font-extrabold">Teste de Status APOIS</h2>
          <button type="button" aria-label="Fechar diagnóstico" onClick={onClose}
            className="rounded-lg border border-zinc-300 px-3 py-1 text-sm font-bold">Fechar</button>
        </div>
        <p className="mt-1 text-sm text-zinc-600">Verificações reais de internet, GPS, cadastro e recebimento de chamadas.</p>
        <button type="button" disabled={busy} onClick={()=>void test()}
          className="mt-4 min-h-12 w-full rounded-xl bg-[#E00029] px-4 py-2 font-bold text-white disabled:opacity-60">
          {busy?"Verificando…":tested?"Testar novamente":"Iniciar teste"}
        </button>
        {busy&&<p role="status" className="mt-3 text-xs text-zinc-600">Consultando o GPS e o servidor…</p>}
        {results.length>0&&<ol className="mt-4 space-y-2">
          {results.map((item,i)=>(
            <li key={i} className="rounded-xl border border-zinc-200 bg-zinc-50 p-3">
              <div className="flex items-center justify-between gap-2">
                <strong className="text-sm">{item.label}</strong>
                <span className={"text-xs font-bold "+(item.status==="ok"?"text-green-700":item.status==="warn"?"text-red-700":"text-amber-700")}>
                  {item.status==="ok"?"OK":item.status==="warn"?"Verificar":"Não confirmado"}
                </span>
              </div>
              <p className="mt-1 text-xs text-zinc-600">{item.detail}</p>
            </li>
          ))}
        </ol>}
        <p className="mt-3 text-xs text-zinc-500">Nenhuma alteração de disponibilidade, conta, GPS ou documentos é feita por este teste.</p>
      </section>
    </div>
  );
}
`;
for(const root of [".work/partner-motorista",".work/partner-entregador"]){
 const target=resolve(root,"src/components/ApoisStatusCheck.tsx");
 mkdirSync(dirname(target),{recursive:true});
 writeFileSync(target,component,"utf8");
}
function modify(file,changes){
 let s=readFileSync(file,"utf8");
 for(const [a,b,label] of changes){
   if(s.includes(b))continue;
   if(s.split(a).length!==2)throw Error("[FAIL] status patch "+label+" "+file);
   s=s.replace(a,b);
 }
 writeFileSync(file,s,"utf8");
}
if(process.argv[2]==="motorista") modify(motor,[
 ['import { MovviMap } from "@/components/MovviMap";',
 'import { MovviMap } from "@/components/MovviMap";\nimport { ApoisStatusCheck } from "@/components/ApoisStatusCheck";','driver import'],
 ['  const [incoming, setIncoming] = useState<RideRow | null>(null);',
 '  const [showStatusCheck,setShowStatusCheck]=useState(false);\n  const [incoming, setIncoming] = useState<RideRow | null>(null);','driver state'],
 ['          onUseTestLocation={ativarLocalizacaoTesteBrasil}',
 '          onUseTestLocation={ativarLocalizacaoTesteBrasil}\n          onOpenStatusCheck={()=>setShowStatusCheck(true)}','driver callback'],
 ['      <DriverVoiceToggle\n', '      {showStatusCheck && <ApoisStatusCheck role="motorista" online={online} onClose={()=>setShowStatusCheck(false)} />}\n\n      <DriverVoiceToggle\n','driver modal'],
 ['  canUseTestLocation, onUseTestLocation,\n}: {',
 '  canUseTestLocation, onUseTestLocation, onOpenStatusCheck,\n}: {','driver panel prop'],
 ['  onUseTestLocation: () => void;\n}) {',
 '  onUseTestLocation: () => void;\n  onOpenStatusCheck: () => void;\n}) {','driver panel prop type'],
 ['        {/* GPS error */}',
 '        <button type="button" onClick={onOpenStatusCheck}\n          className="w-full rounded-xl border border-[#E00029]/35 bg-white/5 py-2 text-xs font-bold text-[#E00029]">\n          Teste de Status · 6 verificações\n        </button>\n        {/* GPS error */}','driver button']
]);
if(process.argv[2]==="entregador") modify(courier,[
 ['import { CourierLocationTracker, type CourierPosition } from "@/components/CourierLocationTracker";',
 'import { CourierLocationTracker, type CourierPosition } from "@/components/CourierLocationTracker";\nimport { ApoisStatusCheck } from "@/components/ApoisStatusCheck";','courier import'],
 ['  const [profileOpen, setProfileOpen] = useState(false);',
 '  const [profileOpen, setProfileOpen] = useState(false);\n  const [statusCheckOpen,setStatusCheckOpen]=useState(false);','courier modal state'],

 ['      <CourierSupportSheet\n', '      {statusCheckOpen&&<ApoisStatusCheck role="entregador" online={online}\n        approved={courier?.status==="approved"&&courier?.is_active===true}\n        documentsReady={documents?.length>0?documents.every((doc:any)=>doc.status==="approved"):null}\n        onClose={()=>setStatusCheckOpen(false)} />}\n      <CourierSupportSheet\n','courier modal']
]);
// Preserve every existing CourierStatusCard prop and layout; add a compact adjacent control.
if(process.argv[2]==="entregador") {
  let content=readFileSync(courier,"utf8");
  const marker='data-apois-courier-status-check-v1';
  if(!content.includes(marker)){
    const match=content.match(/<CourierStatusCard\b[\s\S]{0,800}?\/>/);
    if(!match)throw Error("[FAIL] Courier status card unavailable for diagnostic entry");
    const button='<button type="button" data-apois-courier-status-check-v1 onClick={()=>setStatusCheckOpen(true)} className="w-full rounded-xl border border-[#E00029]/35 bg-white px-4 py-2 text-sm font-bold text-[#E00029]">Teste de Status · 6 verificações</button>\n        ';
    content=content.replace(match[0],match[0]+'\n        '+button);
    writeFileSync(courier,content,"utf8");
  }
}
const motorResult=readFileSync(motor,"utf8"),courierResult=readFileSync(courier,"utf8");
for(const x of ["showStatusCheck","onOpenStatusCheck","role=\"motorista\""])if(process.argv[2]==="motorista"&&!motorResult.includes(x))throw Error("Motor missing "+x);
for(const x of ["statusCheckOpen","role=\"entregador\""])if(process.argv[2]==="entregador"&&!courierResult.includes(x))throw Error("Courier missing "+x);
console.log("[OK] Driver + courier: 6-check diagnostics modal integrated without touching job flows");
