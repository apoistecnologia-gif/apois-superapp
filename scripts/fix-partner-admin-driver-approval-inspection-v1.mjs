// KY-01: additional fail-closed staff UI guard before the existing approval RPC.
// The server Stage2 migration is still the authoritative protection and is NOT deployed here.
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
const file=resolve(process.env.APOIS_MOTORISTA_WORKSPACE||".work/partner-motorista","src/routes/admin.motoristas.tsx");
let s=readFileSync(file,"utf8");
if(s.includes("APOIS_DRIVER_KYC_APPROVAL_UI_GUARD_V1"))throw Error("[FAIL] KYC staff guard duplicated");
const anchor="  async function approval(driver: DriverRow, status: ApprovalStatus) {";
const helper=`  // APOIS_DRIVER_KYC_APPROVAL_UI_GUARD_V1 — defense in depth; server must enforce too.
  async function assertCarVehicleInspected(driver: DriverRow) {
    if (String(driver.category ?? "").trim().toLowerCase() !== "carros") return;
    const { data: fresh, error: driverError } = await supabase
      .from("drivers").select("vehicle_year,category").eq("id",driver.id).maybeSingle();
    if (driverError || !fresh || fresh.category !== "carros") {
      throw new Error("Vistoria: não foi possível confirmar os dados do veículo no servidor.");
    }
    const year = Number(fresh.vehicle_year);
    if (!Number.isInteger(year) || year < new Date().getFullYear() - 10 || year > new Date().getFullYear() + 1) {
      throw new Error("Vistoria: ano de fabricação fora do limite de dez anos.");
    }
    const { data: photos, error: photoError } = await (supabase as any)
      .from("apois_vehicle_inspection_photos")
      .select("slot,review_status,submitted_at")
      .eq("driver_id",driver.id)
      .order("submitted_at",{ascending:false});
    if (photoError || !Array.isArray(photos)) throw new Error("Vistoria: fotos indisponíveis para conferência.");
    const slots = ["front","right","left","dashboard","front_seats","rear_seats","tire_fl","tire_fr","tire_rl","tire_rr","belt_front","belt_rear","headlights_on"];
    const latest = new Map<string,string>();
    for (const photo of photos) {
      const slot = String(photo.slot ?? "");
      if (slots.includes(slot) && !latest.has(slot)) latest.set(slot,String(photo.review_status ?? ""));
    }
    const missing = slots.filter(slot => latest.get(slot) !== "approved");
    if (missing.length) throw new Error("Vistoria: " + missing.length + " de 13 fotos aguardam aprovação na revisão mais recente.");
  }

`;
if(s.split(anchor).length!==2)throw Error("[FAIL] Admin approval function drift");
s=s.replace(anchor,helper+anchor);
const call="      await setAdminDriverApproval(driver.id, status, reason);";
if(s.split(call).length!==2)throw Error("[FAIL] Admin approval handler call drift");
s=s.replace(call,'      if (status === "aprovado") await assertCarVehicleInspected(driver);\n'+call);
const oldError='      setActionError("Não foi possível alterar a aprovação. Tente novamente.");';
if(s.split(oldError).length!==2)throw Error("[FAIL] Admin approval error handling drift");
s=s.replace(oldError,'      setActionError(error instanceof Error && error.message.startsWith("Vistoria:") ? error.message : "Não foi possível alterar a aprovação. Tente novamente.");');
for(const key of ["apois_vehicle_inspection_photos","const latest = new Map","status === \"aprovado\"","assertCarVehicleInspected(driver)"]){
 if(!s.includes(key))throw Error("[FAIL] Admin inspection guard: "+key);
}
writeFileSync(file,s,"utf8");
console.log("[OK] Admin Corridas: front-end approval now requires 13 most recent approved slots and vehicle age <=10 years; server Stage2 remains pending.");
