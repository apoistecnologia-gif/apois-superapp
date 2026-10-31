import {readFileSync,writeFileSync} from "node:fs";
import {resolve} from "node:path";
const base=resolve(".work/partner-motorista");
function read(p){return readFileSync(resolve(base,p),"utf8");}
function save(p,s){writeFileSync(resolve(base,p),s,"utf8");}
function rep(s,a,b,label){if(!s.includes(a))throw Error("[FAIL] Admin vehicle inspection "+label);return s.replace(a,b);}
let p="src/lib/driverDocs.functions.ts",s=read(p);
if(!s.includes("APOIS_ADMIN_VEHICLE_INSPECTION_V1")){
 s=rep(s,"    return out;",[
 '    // APOIS_ADMIN_VEHICLE_INSPECTION_V1: private, staff-only temporary links.',
 '    const inspection=await supabaseAdmin.from("apois_vehicle_inspection_photos")',
 '      .select("id,slot,bucket_id,object_path,review_status,review_note,submitted_at")',
 '      .eq("driver_id",data.driverId).order("submitted_at",{ascending:false});',
 '    if(inspection.error)throw Error("inspection_unavailable");',
 '    const photographs=await Promise.all((inspection.data??[]).map(async (item)=>{',
 '      const signed=await supabaseAdmin.storage.from(item.bucket_id).createSignedUrl(item.object_path,600);',
 '      if(signed.error)throw Error("photo_signed_url_failed");',
 '      return {id:item.id,slot:item.slot,url:signed.data?.signedUrl??null,',
 '       review_status:item.review_status,review_note:item.review_note,submitted_at:item.submitted_at};',
 '    }));',
 '    return {...out,inspection_photos:photographs};',
 ].join("\n"),"signed URLs");
 save(p,s);
}
p="src/routes/admin.motoristas.tsx";s=read(p);
if(!s.includes("APOIS_ADMIN_INSPECTION_REVIEW_V1")){
 s=rep(s,"  vehicle_document_url: string | null;\n};\n\ntype ApprovalStatus",[
 '  vehicle_document_url: string | null;',
 '  inspection_photos: Array<{id:string;slot:string;url:string|null;review_status:string;review_note:string|null;submitted_at:string}>;',
 '};',
 '',
 'type ApprovalStatus',
 ].join("\n"),"Docs type");
 s=rep(s,"  const [docsLoading, setDocsLoading] = useState(false);",
 '  const [docsLoading, setDocsLoading] = useState(false);\n  const [inspectionBusy,setInspectionBusy]=useState<string|null>(null);',"review state");
 s=rep(s,"        vehicle_document_url: safeDocumentUrl(next?.vehicle_document_url),",
 '        vehicle_document_url: safeDocumentUrl(next?.vehicle_document_url),\n        inspection_photos: (next?.inspection_photos??[]).map(photo=>({...photo,url:safeDocumentUrl(photo.url)})),',"load photo");
 const fn=[
 '  // APOIS_ADMIN_INSPECTION_REVIEW_V1: explicit image-by-image assessment.',
 '  async function reviewVehiclePhoto(id:string,approved:boolean){',
 '    if(inspectionBusy||!selected)return;',
 '    const note=approved?null:window.prompt("Informe o motivo da reprovação desta foto:");',
 '    if(!approved&&(!note||note.trim().length<5))return;',
 '    setInspectionBusy(id);',
 '    try{',
 '      const {error}=await (supabase as any).rpc("apois_review_vehicle_photo",{_id:id,_approved:approved,_note:note});',
 '      if(error)throw error;',
 '      toast.success(approved?"Foto da vistoria aprovada.":"Foto da vistoria reprovada.");',
 '      await openDetails(selected);',
 '    }catch{setActionError("Não foi possível salvar a análise da foto.");}',
 '    finally{setInspectionBusy(null);}',
 '  }',
 ].join("\n");
 s=rep(s,"  async function openDetails(driver: DriverRow) {",fn+"\n\n  async function openDetails(driver: DriverRow) {","review action");
 const view=[
 '            <section data-apois-admin-vehicle-inspection-v1 className="space-y-3 rounded-xl border border-primary/20 p-3">',
 '              <h3 className="text-sm font-extrabold">Vistoria fotográfica do veículo (6 ângulos)</h3>',
 '              <p className="text-xs text-muted-foreground">Arquivos privados com acesso temporário, decisões individuais e histórico de envio.</p>',
 '              {selected.category==="carros" && docs?.inspection_photos.length===0 && <p className="text-sm text-amber-600">Vistoria ainda não enviada. Não aprove sem todas as fotos analisadas.</p>}',
 '              <div className="grid gap-3 sm:grid-cols-2">',
 '                {docs?.inspection_photos.map(photo=><article key={photo.id} className="space-y-2 rounded-xl border border-border p-3">',
 '                  <div className="flex items-center justify-between gap-2"><strong className="text-xs">{({front:"Frente",right:"Lado direito",left:"Lado esquerdo",dashboard:"Painel",front_seats:"Bancos dianteiros",rear_seats:"Bancos traseiros"} as Record<string,string>)[photo.slot]??photo.slot}</strong><span className="text-[10px]">{photo.review_status}</span></div>',
 '                  {photo.url?<a href={photo.url} target="_blank" rel="noreferrer noopener" className="block rounded-lg border border-border p-2 text-sm font-semibold text-primary">Abrir foto original (link temporário)</a>:<p className="text-xs text-destructive">Foto indisponível</p>}',
 '                  <p className="text-[10px] text-muted-foreground">{photo.submitted_at?new Date(photo.submitted_at).toLocaleString("pt-BR"):"Sem data"}</p>',
 '                  {photo.review_note&&<p className="text-xs text-destructive">{photo.review_note}</p>}',
 '                  <div className="grid grid-cols-2 gap-2">',
 '                    <DSButton variant="outline" size="sm" disabled={Boolean(inspectionBusy)} onClick={()=>void reviewVehiclePhoto(photo.id,true)}>Aprovar foto</DSButton>',
 '                    <DSButton variant="outline" size="sm" disabled={Boolean(inspectionBusy)} onClick={()=>void reviewVehiclePhoto(photo.id,false)}>Reprovar foto</DSButton>',
 '                  </div>',
 '                </article>)}',
 '              </div>',
 '            </section>',
 ].join("\n");
 s=rep(s,'            {selected.motivo_reprovacao &&',view+'\n            {selected.motivo_reprovacao &&',"render");
 save(p,s);
}
console.log("[OK] Admin motoristas: signed inspection gallery and individual review actions.");
