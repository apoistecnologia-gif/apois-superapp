import {readFileSync,writeFileSync} from "node:fs";
import {resolve} from "node:path";
const file=resolve(".work/partner-motorista/src/routes/motorista.cadastro.tsx");
let s=readFileSync(file,"utf8");
if(!s.includes("APOIS_CAR_MANUFACTURE_10Y_V1")){
 const a='  const [vehicleCategory,setVehicleCategory]=useState("carros");';
 if(!s.includes(a))throw Error("[FAIL] 10y car category state not found");
 s=s.replace(a,a+'\n  // APOIS_CAR_MANUFACTURE_10Y_V1: applies only to new car applications.\n  const manufactureCutoff=new Date().getFullYear()-10;');
 const field='label="Ano" icon={Car}><DSInput name="vehicle_year" type="number" inputMode="numeric" required placeholder="2022"';
 if(!s.includes(field))throw Error("[FAIL] Year manufacture field moved");
 s=s.replace(field,'label="Ano de fabricação" icon={Car}><DSInput name="vehicle_year" type="number" inputMode="numeric" min={vehicleCategory==="carros"?manufactureCutoff:1971} max={new Date().getFullYear()} required placeholder={String(new Date().getFullYear()-2)}');
 const onsubmit='    if (!selfie || !cnhFront || !cnhBack || !vehicleDoc || !vehiclePhoto || (parsed.data.category==="carros"&&!inspectionReady)) {';
 if(!s.includes(onsubmit))throw Error("[FAIL] Year submit validation position moved");
 s=s.replace(onsubmit,'    if (parsed.data.category==="carros" && (parsed.data.vehicle_year<manufactureCutoff || parsed.data.vehicle_year>new Date().getFullYear())) {\n      setError("Para carros, aceitamos ano de fabricação entre "+manufactureCutoff+" e "+new Date().getFullYear()+".");\n      return;\n    }\n'+onsubmit);
 writeFileSync(file,s,"utf8");
}
console.log("[OK] Motorista: new car manufacturing year max 10 years, dynamic year and server gate.");
