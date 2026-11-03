import {readFileSync,writeFileSync} from "node:fs";
import {resolve} from "node:path";
const path=resolve(".work/partner-motorista/src/lib/driverRegistration.mobile.ts");
let src=readFileSync(path,"utf8");
function change(a,b,name){if(!src.includes(a))throw Error("[FAIL] Vehicle upload "+name);src=src.replace(a,b);}
if(!src.includes("APOIS_VEHICLE_INSPECTION_UPLOAD_V1")){
 change('bucket: "driver-selfies" | "driver-cnh" | "vehicle-documents";','bucket: "driver-selfies" | "driver-cnh" | "vehicle-documents" | "apois-inspections";',"bucket");
 change('label: "selfie" | "cnh" | "cnh_back" | "veiculo" | "vehicle_photo";','label: "selfie" | "cnh" | "cnh_back" | "veiculo" | "vehicle_photo" | "right" | "left" | "dashboard" | "front_seats" | "rear_seats" | "tire_fl" | "tire_fr" | "tire_rl" | "tire_rr" | "belt_front" | "belt_rear" | "headlights_on";',"labels");
 change('  documents: [DriverDocument, DriverDocument, DriverDocument, DriverDocument, DriverDocument];','  documents: [DriverDocument, DriverDocument, DriverDocument, DriverDocument, DriverDocument];\n  inspection_photos?: DriverDocument[];',"input");
 change('  let photoPath: string | null = null;','  // APOIS_VEHICLE_INSPECTION_UPLOAD_V1: add immutable inspection records after registration.\n  let photoPath: string | null = null;\n  let committed=false;\n  let registrationAttempted=false;\n  const inspectionPaths: Record<string,string>={};',"tracker");
 change('    for (const doc of input.documents) {','    for (const doc of [...input.documents,...(input.inspection_photos??[])]) {',"files");
 const pattern=/      const path = .+doc\.label.+Date\.now\(\).+cleanExt\(doc\.fileName\).+;/;
 if(!pattern.test(src))throw Error("[FAIL] original path naming moved");
 src=src.replace(pattern,'      const path = doc.bucket==="apois-inspections" ? authUser.id+"/"+doc.label+"/"+crypto.randomUUID().replace(/-/g,"")+"."+cleanExt(doc.fileName) : authUser.id+"/"+doc.label+"-"+Date.now()+"-"+Math.random().toString(36).slice(2,8)+"."+cleanExt(doc.fileName);');
 change('      paths[doc.label] = path;','      paths[doc.label] = path;\n      if(doc.bucket==="apois-inspections") inspectionPaths[doc.label]=path;',"path tracking");
 // Every registration upload uses a fresh unique object path; never request overwrite.
 // Supabase Storage upsert:true requires UPDATE and SELECT permissions, which evidence buckets deny.
 if((src.match(/upsert: true,/g)||[]).length!==2)throw Error("[FAIL] unexpectedly changed Storage upload contract");
 src=src.replaceAll("upsert: true,","upsert: false,");
 change('    const { data, error } = await (supabase as any).rpc("driver_complete_registration_v3", {',
 '    // Prevent cleanup of possibly committed documents on ambiguous network failure.\\n    registrationAttempted=true;\\n    const { data, error } = await (supabase as any).rpc("driver_complete_registration_v3", {',"registration RPC uncertainty");
 change('    if (error) throw new Error(readableRegistrationError(error.message));',[
 '    if (error) throw new Error(readableRegistrationError(error.message));',
 '    committed=true;',
 '    if(input.category==="carros"){',
 '      if(["right","left","dashboard","front_seats","rear_seats","tire_fl","tire_fr","tire_rl","tire_rr","belt_front","belt_rear","headlights_on"].some(slot=>!inspectionPaths[slot]))',
 '        throw new Error("Vistoria fotográfica incompleta.");',
 '      const result=await (supabase as any).rpc("apois_submit_driver_vehicle_inspection",{_slots:inspectionPaths});',
 '      if(result.error){
        // Idempotent RPC; a repeat can recover from a dropped response or brief network interruption.
        await new Promise(resolve=>setTimeout(resolve,350));
        const retry=await (supabase as any).rpc("apois_submit_driver_vehicle_inspection",{_slots:inspectionPaths});
        if(retry.error)throw new Error("Cadastro recebido, mas a vistoria está pendente. Contate a equipe APOIS.");
      }',
 '    }',
 ].join("\n"),"inspection RPC");
 change('    await Promise.allSettled(uploaded.map((item) => supabase.storage.from(item.bucket).remove([item.path])));',
 '    if(!registrationAttempted&&!committed)await Promise.allSettled(uploaded.map((item) => supabase.storage.from(item.bucket).remove([item.path])));',"preserve evidence");
 writeFileSync(path,src,"utf8");
}
console.log("[OK] Driver registration: photos uploaded privately, immutable paths, inspector RPC, no deletion after committed.");
