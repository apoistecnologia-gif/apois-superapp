import {readFileSync,writeFileSync} from "node:fs";
import {resolve} from "node:path";
const root=resolve(".work/partner-entregador");
const componentPath=resolve(root,"src/components/ApoisStatusCheck.tsx");
const courierPath=resolve(root,"src/routes/courier.tsx");
let s=readFileSync(componentPath,"utf8");
function once(src,from,to,label){const n=src.split(from).length-1;if(n!==1)throw Error("[FAIL] Courier status "+label+" anchors="+n);return src.replace(from,to)}
if(s.includes("APOIS_COURIER_STATUS_ONLINE_CONFIRMED_V1"))throw Error("[FAIL] Duplicate status correction");
s=once(s,'  approved?:boolean|null;documentsReady?:boolean|null;',
  '  approved?:boolean|null;documentsReady?:boolean|null;courierId?:string|null;',"status props type");
s=once(s,'export function ApoisStatusCheck({role,online,onClose,approved,documentsReady}:',
  'export function ApoisStatusCheck({role,online,onClose,approved,documentsReady,courierId}:',"status props");
s=once(s,'    setBusy(true);setTested(false);setResults([]);',
  '    setBusy(true);setTested(false);setResults([]);\n    try {',"guaranteed finalization");
const point='    add("4. Cadastro e documentos",';
if(!s.includes(point))throw Error("[FAIL] Cannot find registration results");
const addition=[
'    // APOIS_COURIER_STATUS_ONLINE_CONFIRMED_V1: owner-scoped RLS read of actual availability.',
'    if(role==="entregador" && authenticated && courierId) {',
'      try {',
'        const {data:availability,error:availabilityError}=await Promise.race([',
'          supabase.from("courier_availability").select("is_online").eq("courier_id",courierId).maybeSingle(),',
'          new Promise<never>((_,reject)=>setTimeout(()=>reject(new Error("availability_timeout")),8000))',
'        ]);',
'        if(!availabilityError && availability)backendOnline=availability.is_online===true;',
'      } catch {backendOnline=null;}',
'    }',
''
].join("\n");
s=s.replace(point,addition+point);
s=once(s,'    setResults(output);setTested(true);setBusy(false);',
  '    setResults(output);setTested(true);\n    } catch {\n      setResults([{label:"Consulta ao servidor",status:"warn",detail:"Não foi possível concluir a verificação. Verifique a conexão e tente novamente."}]);\n      setTested(true);\n    } finally {setBusy(false);}',"bounded busy state");
s=once(s,'  },[role,online,approved,documentsReady]);',
  '  },[role,online,approved,documentsReady,courierId]);',"test deps");
writeFileSync(componentPath,s,"utf8");
let c=readFileSync(courierPath,"utf8");
c=once(c,'<ApoisStatusCheck role="entregador" online={online}',
  '<ApoisStatusCheck role="entregador" online={online} courierId={courier?.id??null}',"real courier id");
writeFileSync(courierPath,c,"utf8");
console.log("[OK] Courier status verifies owner-scoped remote availability without changing ONLINE.");
