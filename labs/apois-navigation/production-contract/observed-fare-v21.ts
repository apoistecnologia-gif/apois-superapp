const rounded = (n: number) => Math.round(n * 100) / 100;

function extraFare(category: string, tariff: Record<string, number>, details: Record<string, unknown>) {
  const yes = (v: unknown) => v === true || ["sim","yes","true","1"].includes(String(v ?? "").trim().toLowerCase());
  const num = (v: unknown) => { const n = Number(String(v ?? "").replace(",", ".")); return Number.isFinite(n) && n > 0 ? n : 0; };
  let extras = 0;
  if (category === "fretes") {
    if (details.ajudantes === "um") extras += tariff.helper1_fee ?? 0;
    if (details.ajudantes === "dois") extras += tariff.helper2_fee ?? 0;
    if (yes(details.itemPesado)) extras += tariff.heavy_furniture_fee ?? 0;
    if (yes(details.desmontar)) extras += tariff.assembly_fee ?? 0;
    if (yes(details.embalar)) extras += tariff.packing_fee ?? 0;
  }
  if (category === "guincho") {
    if (["utilitario","caminhonete"].includes(String(details.tipoVeiculo))) extras += tariff.heavy_vehicle_fee ?? 0;
    if (yes(details.dificilAcesso)) extras += tariff.difficult_access_fee ?? 0;
    if (yes(details.acidente)) extras += tariff.accident_fee ?? 0;
    if (yes(details.precisaPlataforma)) extras += tariff.platform_fee ?? 0;
    if (yes(details.rodasTravadas)) extras += tariff.locked_wheels_fee ?? 0;
    if (yes(details.garagemSubsolo)) extras += tariff.garage_fee ?? 0;
  }
  if (category === "envios") {
    const weight = num(details.weightKg);
    const max = tariff.max_weight_kg ?? 0;
    if (max > 0 && weight > max) throw new Error("service_weight_exceeds_limit");
    extras += weight * (tariff.per_kg ?? 0);
  }
  return extras;
}

export async function loadFare(admin: any, categoryId: string, category: string, km: number, min: number, details: Record<string, unknown>) {
  const { data: rules, error } = await admin
    .from("tariff_rules")
    .select("*")
    .eq("category_id", categoryId)
    .eq("is_active", true);
  if (error) throw error;
  const candidates = rules ?? [];
  const rule =
    candidates.find((r: any) => String(r.city ?? "").trim().toLowerCase() === "petrolina") ??
    candidates.find((r: any) => !String(r.city ?? "").trim()) ??
    candidates[0];
  if (!rule) throw new Error("tariff_not_found");

  const fields = [
    "base_fare","min_fare","per_km","per_min","helper1_fee","helper2_fee","heavy_furniture_fee",
    "assembly_fee","packing_fee","difficult_access_fee","stair_fee","heavy_vehicle_fee","accident_fee",
    "platform_fee","locked_wheels_fee","garage_fee","max_weight_kg","per_kg"
  ];
  const tariff: Record<string, number> = {};
  for (const key of fields) {
    const n = Number(rule[key]);
    if (Number.isFinite(n)) tariff[key] = n;
  }
  const baseRaw = (category === "guincho" ? (tariff.base_fare ?? 0) : (tariff.base_fare ?? 0))
    + (tariff.per_km ?? 0) * km + (tariff.per_min ?? 0) * min;
  const base = Math.max(tariff.min_fare ?? 0, baseRaw);
  const total = rounded(base + extraFare(category, tariff, details));
  if (!(total > 0)) throw new Error("tariff_invalid");
  return total;
}

