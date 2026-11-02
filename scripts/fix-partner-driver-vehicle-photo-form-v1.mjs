import {readFileSync,writeFileSync} from "node:fs";
import {resolve} from "node:path";
const root=resolve(".work/partner-motorista");
const read=p=>readFileSync(resolve(root,p),"utf8");
const save=(p,s)=>writeFileSync(resolve(root,p),s,"utf8");
function replace(s,a,b,label){if(!s.includes(a))throw Error("[FAIL] Vehicle inspection "+label);return s.replace(a,b);}
let file="src/routes/motorista.cadastro.tsx",s=read(file);
if(!s.includes("APOIS_VEHICLE_SIX_PHOTOS_V1")){
  s=replace(s,"  const [vehiclePhoto, setVehiclePhoto] = useState<File | null>(null);",[
    "  const [vehiclePhoto, setVehiclePhoto] = useState<File | null>(null);",
    "  // APOIS_VEHICLE_SIX_PHOTOS_V1: the existing vehicle photo is the front view.",
    '  const [vehicleCategory,setVehicleCategory]=useState("carros");',
    '  const inspectionSlots=[{key:"right",label:"Lado direito"},{key:"left",label:"Lado esquerdo"},{key:"dashboard",label:"Painel"},{key:"front_seats",label:"Bancos dianteiros"},{key:"rear_seats",label:"Bancos traseiros"},{key:"tire_fl",label:"Pneu dianteiro esquerdo"},{key:"tire_fr",label:"Pneu dianteiro direito"},{key:"tire_rl",label:"Pneu traseiro esquerdo"},{key:"tire_rr",label:"Pneu traseiro direito"},{key:"belt_front",label:"Cintos dianteiros"},{key:"belt_rear",label:"Cintos traseiros"},{key:"headlights_on",label:"Faróis acesos (ambos)"}] as const;',
    '  type Slot=typeof inspectionSlots[number]["key"];',
    '  const [inspection,setInspection]=useState<Partial<Record<Slot,File>>>({});',
    '  const inspectionReady=inspectionSlots.every(({key})=>Boolean(inspection[key]));',
  ].join("\n"),"state");
  s=replace(s,"[Boolean(selfie), Boolean(cnhFront && cnhBack), Boolean(vehicleDoc), Boolean(vehiclePhoto)]",'[Boolean(selfie), Boolean(cnhFront && cnhBack), Boolean(vehicleDoc), Boolean(vehiclePhoto), ...(vehicleCategory==="carros"?inspectionSlots.map(({key})=>Boolean(inspection[key])):[])]',"progress");
  s=replace(s,"[selfie, cnhFront, cnhBack, vehicleDoc, vehiclePhoto],","[selfie, cnhFront, cnhBack, vehicleDoc, vehiclePhoto, inspection, vehicleCategory],","deps");
  s=replace(s,"  const allDocsReady = completedItems === 4;",'  const allDocsReady = completedItems === (vehicleCategory==="carros"?16:4);',"ready");
  s=replace(s,"if (!selfie || !cnhFront || !cnhBack || !vehicleDoc || !vehiclePhoto) {",'if (!selfie || !cnhFront || !cnhBack || !vehicleDoc || !vehiclePhoto || (parsed.data.category==="carros"&&!inspectionReady)) {',"required");
  s=replace(s,'type Bucket = "driver-selfies" | "driver-cnh" | "vehicle-documents";','type Bucket = "driver-selfies" | "driver-cnh" | "vehicle-documents" | "apois-inspections";',"photo bucket type");
  s=replace(s,'type Label = "selfie" | "cnh" | "cnh_back" | "veiculo" | "vehicle_photo";','type Label = "selfie" | "cnh" | "cnh_back" | "veiculo" | "vehicle_photo" | "right" | "left" | "dashboard" | "front_seats" | "rear_seats" | "tire_fl" | "tire_fr" | "tire_rl" | "tire_rr" | "belt_front" | "belt_rear" | "headlights_on";',"photo slot type");
  s=replace(s,"      const documents = await Promise.all([",[
    '      const inspectionPhotos=parsed.data.category==="carros" ? await Promise.all(inspectionSlots.map(async ({key})=>{',
    '        const file=inspection[key]; if(!file)throw Error("Foto da vistoria ausente");',
    '        const compressed=await compressDocumentImage(file,{maxSize:1400,quality:0.85});',
    '        return fileToBase64(compressed,"apois-inspections",key);',
    '      })) : [];',
    "      const documents = await Promise.all([",
  ].join("\n"),"convert photos");
  s=replace(s,"        documents: documents as any,","        documents: documents as any,\n        inspection_photos: inspectionPhotos as any,","submit extras");
  s=replace(s,'<DSSelect name="category" defaultValue="carros">','<DSSelect name="category" value={vehicleCategory} onValueChange={setVehicleCategory}>',"car category");
  const anchor='<DocumentCard title="Foto do veículo" done={Boolean(vehiclePhoto)}><DriverDocumentField id="doc-vehicle-photo" label="Veículo" helper="Mostre o veículo inteiro com boa iluminação" file={vehiclePhoto} onChange={setVehiclePhoto} /></DocumentCard>';
  const extra=[
  '<DocumentCard title={vehicleCategory==="carros"?"Frente do veículo":"Foto do veículo"} done={Boolean(vehiclePhoto)}><DriverDocumentField id="doc-vehicle-photo" label="Frente do veículo" helper="Frente completa, placa legível" file={vehiclePhoto} onChange={setVehiclePhoto} /></DocumentCard>',
  '{vehicleCategory==="carros" && <section data-apois-vehicle-inspection-v1 className="space-y-3 rounded-[20px] border border-[#E00029]/30 p-3">',
  '<h3 className="text-sm font-extrabold text-white">Vistoria fotográfica · 13 fotos obrigatórias</h3>',
  '<p className="text-xs text-zinc-400">Fotos privadas para análise do estado do carro. Não inclua pessoas.</p>',
  '{inspectionSlots.map(({key,label})=><DocumentCard key={key} title={label} done={Boolean(inspection[key])}>',
  '<DriverDocumentField id={"inspection-"+key} label={label} helper={key.startsWith("tire_")?"Mostre lateral e sulcos da banda de rodagem, sem ocultar danos":key.startsWith("belt_")?"Mostre os fechos, cintos e estado aparente dos assentos":key==="headlights_on"?"Foto frontal com ambos os faróis acesos e visíveis":"Foto nítida: "+label.toLowerCase()}',
  ' accept="image/jpeg,image/png,image/webp" file={inspection[key]??null}',
  ' onChange={file=>setInspection(prev=>({...prev,[key]:file??undefined}))}/>',
  '</DocumentCard>)}',
  '</section>}',
  ].join("\n");
  s=replace(s,anchor,extra,"inspection fields");
  s=replace(s,"{completedItems}/4</span>",'{completedItems}/{vehicleCategory==="carros"?16:4}</span>',"counter");
  save(file,s);
}
console.log("[OK] Motorista cadastro: six-angle photo form and extra photos in registration payload.");
