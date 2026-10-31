import {readFileSync,writeFileSync} from "node:fs";
import {resolve} from "node:path";
const path=resolve(".work/partner-motorista/src/routes/admin.motoristas.tsx");
let s=readFileSync(path,"utf8");
function rep(before,after,label){
 if(s.split(before).length!==2)throw Error("[FAIL] Admin pending patch "+label);
 s=s.replace(before,after);
}
if(!s.includes("APOIS_ADMIN_PENDING_CORRECTIONS_V1")){
 rep("  vehicle_color: string | null;","  vehicle_color: string | null;\n  vehicle_year: number | null;","driver year type");
 rep("vehicle_model,vehicle_plate,vehicle_color,selfie_url",
     "vehicle_model,vehicle_plate,vehicle_color,vehicle_year,selfie_url","admin select year");
 rep('vehicle_color: cleanText(row.vehicle_color) || null,',
     'vehicle_color: cleanText(row.vehicle_color) || null,\n          vehicle_year: row.vehicle_year==null?null:Number(row.vehicle_year),',"year row");
 rep('  const [rejectReason, setRejectReason] = useState("");',
 '  // APOIS_ADMIN_PENDING_CORRECTIONS_V1: explicit staff correction request.\n  const [pendingReason,setPendingReason]=useState("");\n  const [pendingSlots,setPendingSlots]=useState<string[]>([]);\n  const [internalPreview,setInternalPreview]=useState<{url:string;name:string;image:boolean}|null>(null);\n  const [rejectReason, setRejectReason] = useState("");',"state");
 const actions=[
 '  const correctionSlots=[["front","Frente do veículo"],["right","Lado direito"],["left","Lado esquerdo"],',
 '   ["dashboard","Painel"],["front_seats","Bancos dianteiros"],["rear_seats","Bancos traseiros"],',
 '   ["tire_fl","Pneu dianteiro esquerdo"],["tire_fr","Pneu dianteiro direito"],',
 '   ["tire_rl","Pneu traseiro esquerdo"],["tire_rr","Pneu traseiro direito"],',
 '   ["belt_front","Cintos dianteiros"],["belt_rear","Cintos traseiros"],',
 '   ["headlights_on","Faróis acesos"],["selfie","Selfie"],["cnh_front","CNH frente"],',
 '   ["cnh_back","CNH verso"],["crlv","CRLV"],["manufacture_year","Ano de fabricação"]] as const;',
 '  async function pendDriver(driver:DriverRow){',
 '    if(busyId||driver.approval_status==="aprovado")return;',
 '    if(pendingSlots.length===0||pendingReason.trim().length<10){setActionError("Selecione os itens e explique a correção (mínimo 10 caracteres).");return;}',
 '    setBusyId(driver.id);setActionError(null);',
 '    try {',
 '      const {data,error}=await (supabase as any).rpc("apois_admin_request_driver_correction",{',
 '        _driver_id:driver.id,_items:pendingSlots,_reason:pendingReason.trim()',
 '      });',
 '      if(error||!data?.request_id)throw error??Error("pending_not_saved");',
 '      toast.success("Pendência registrada e enviada à caixa de notificações do motorista.");',
 '      if(data.email_queued){',
 '        const mail=await supabase.functions.invoke("apois-driver-review-mailer",{body:{request_id:data.request_id}});',
 '        if(mail.error||mail.data?.status!=="accepted_by_provider")',
 '          toast.warning("Notificação no app registrada. E-mail ainda pendente de envio; confira a fila e o serviço de e-mail.");',
 '        else toast.success("E-mail aceito pelo serviço de entrega.");',
 '      } else toast.warning("O motorista não tem e-mail válido para notificação.");',
 '      setPendingSlots([]);setPendingReason("");',
 '      await load();',
 '    }catch {setActionError("Não foi possível pendenciar. Nenhuma mudança deve ser presumida.");}',
 '    finally{setBusyId(null);}',
 '  }',
 ].join("\n");
 rep("  async function openDetails(driver: DriverRow) {",actions+"\n\n  async function openDetails(driver: DriverRow) {","admin action");
 const section=[
 '            <section data-apois-admin-pending-v1 className="space-y-3 rounded-xl border border-amber-500/30 bg-amber-500/5 p-3">',
 '              <h3 className="font-extrabold">Pendenciar cadastro e solicitar correções</h3>',
 '              <p className="text-xs text-muted-foreground">Selecione exatamente o que falta e descreva o motivo. O motorista verá no aplicativo e haverá tentativa de aviso por e-mail rastreável.</p>',
 '              {selected.category==="carros"&&<p className="text-sm font-semibold">Ano de fabricação: {selected.vehicle_year??"Não informado"} · mínimo {new Date().getFullYear()-10}</p>}',
 '              <div className="grid grid-cols-2 gap-2">',
 '                {correctionSlots.map(([key,label])=><label key={key} className="flex items-start gap-2 rounded-lg border border-border px-2 py-2 text-xs">',
 '                  <input type="checkbox" checked={pendingSlots.includes(key)}',
 '                    onChange={e=>setPendingSlots(old=>e.target.checked?[...old,key]:old.filter(x=>x!==key))}/>',
 '                  <span>{label}</span>',
 '                </label>)}',
 '              </div>',
 '              <label className="block text-sm font-bold">O que o motorista precisa corrigir?',
 '                <DSTextarea value={pendingReason} maxLength={1000} rows={3}',
 '                  onChange={e=>setPendingReason(e.target.value)}',
 '                  placeholder="Ex.: Pneu dianteiro esquerdo com desgaste aparente. Envie nova foto nítida após correção."/>',
 '              </label>',
 '              <DSButton variant="outline" disabled={Boolean(busyId)||selected.approval_status==="aprovado"||pendingSlots.length===0||pendingReason.trim().length<10}',
 '                onClick={()=>void pendDriver(selected)}>Pendenciar cadastro e notificar motorista</DSButton>',
 '            </section>',
 ].join("\n");
 rep('            {selected.motivo_reprovacao &&',section+"\n            {selected.motivo_reprovacao &&","pending section");
 const button=[
 '            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">',
 '              {([{key:"selfie_url",label:"Selfie",image:true},{key:"cnh_url",label:"CNH",image:false},',
 '                {key:"vehicle_document_url",label:"CRLV",image:false}] as const).map(doc=>{',
 '                const url=docs?.[doc.key];',
 '                return <DSButton key={doc.key} variant="outline" disabled={!url||docsLoading}',
 '                  onClick={()=>url&&setInternalPreview({url,name:doc.label,image:doc.image})}>',
 '                  Visualizar {doc.label} no painel',
 '                </DSButton>;',
 '              })}',
 '            </div>',
 ].join("\n");
 rep('            {selected.motivo_reprovacao &&',button+"\n            {selected.motivo_reprovacao &&","document preview controls");
 const photoAction='<a href={photo.url} target="_blank" rel="noreferrer noopener" className="block rounded-lg border border-border p-2 text-sm font-semibold text-primary">Abrir foto original (link temporário)</a>';
 if(!s.includes(photoAction))throw Error("[FAIL] old gallery link");
 s=s.replace(photoAction,'<button type="button" onClick={()=>setInternalPreview({url:photo.url!,name:photo.slot,image:true})} className="block w-full rounded-lg border border-border p-2 text-left text-sm font-semibold text-primary">Visualizar foto internamente</button>');
 const lightbox=[
 '      {internalPreview&&<div role="dialog" aria-modal="true" aria-label={"Visualização protegida: "+internalPreview.name}',
 '        className="fixed inset-0 z-[9999] flex flex-col bg-black/95 p-3 text-white">',
 '        <div className="flex items-center justify-between gap-4 pb-3">',
 '          <strong>{internalPreview.name} · Acesso temporário</strong>',
 '          <DSButton variant="outline" onClick={()=>setInternalPreview(null)}>Fechar</DSButton>',
 '        </div>',
 '        <iframe src={internalPreview.url} title={internalPreview.name}',
 '          className="min-h-0 w-full flex-1 rounded-xl bg-white" referrerPolicy="no-referrer"/>',
 '        <a href={internalPreview.url} target="_blank" rel="noopener noreferrer"',
 '          className="mt-3 text-xs text-white/80 underline">Abrir em outra guia somente se não visualizar aqui</a>',
 '      </div>}',
 ].join("\n");
 rep('      {selected && (',lightbox+"\n      {selected && (","overlay render");
 writeFileSync(path,s,"utf8");
}
console.log("[OK] Admin: internal signed-document viewer, 13 inspection photo slots and correction workflow.");
