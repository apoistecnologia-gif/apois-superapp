// INV-026/027 — Integrador: modifica apenas cópia .work do painel Entregas.
// Falha fechada se os contratos de origem tiverem mudado. Sem RPC executada.
import {readFileSync,writeFileSync} from "node:fs";
import {resolve} from "node:path";
const path=resolve(".work/entregas/src/components/AdminCoveragePanel.tsx");
let src=readFileSync(path,"utf8");
const MARKER="APOIS_ADMIN_COVERAGE_CONSISTENCY_V2";
if(src.includes(MARKER)){console.log("[OK] INV-026/027 já aplicado");process.exit(0);}
function replaceOnce(a,b,label){
 const hits=src.split(a).length-1;
 if(hits!==1)throw Error("[FAIL] cobertura "+label+": âncora encontrada "+hits+" vezes");
 src=src.replace(a,b);
}
replaceOnce('useCallback, useEffect, useMemo, useState',
 'useCallback, useEffect, useMemo, useRef, useState',"React useRef");
replaceOnce('type ZoneDraft = {\n  id: string | null;',
 'type ZoneDraft = {\n  id: string | null;\n  cityId: string | null;',"draft city");
replaceOnce('const emptyZoneDraft = (): ZoneDraft => ({\n  id: null,',
 'const emptyZoneDraft = (): ZoneDraft => ({\n  id: null,\n  cityId: null,',"default city");
replaceOnce('  const { confirm, confirmDialog } = useConfirmDialog();',
 `  const { confirm, confirmDialog } = useConfirmDialog();
  // ${MARKER}: stale queries cannot cross between cities.
  const zonesRequestRef = useRef(0);
  const zoneWriteRef = useRef(false);
  const changeCity = (nextId: string) => {
    if (nextId === selectedCityId) return;
    if (zoneWriteRef.current || busy === "zone") {
      toast.error("Aguarde a gravação da zona antes de trocar de cidade.");
      return;
    }
    const hasDraft = Boolean(
      zoneDraft.id || zoneDraft.name.trim() || zoneDraft.centerLatitude.trim() ||
      zoneDraft.centerLongitude.trim() || zoneDraft.geojson.trim()
    );
    if (hasDraft) {
      toast.error("Cancele ou salve o rascunho da zona antes de trocar de cidade.");
      return;
    }
    ++zonesRequestRef.current;
    setZones([]);
    setLoadingZones(Boolean(nextId));
    setSelectedCityId(nextId);
  };`, "city guard");
replaceOnce(`  const loadZones = useCallback(async () => {
    if (!selectedCityId) {
      setZones([]);
      return;
    }
    setLoadingZones(true);
    const { data, error } = await from("delivery_zones")
      .select("*")
      .eq("city_id", selectedCityId)
      .order("name");
    setLoadingZones(false);
    if (error) {
      toast.error("Não foi possível carregar as zonas de entrega.");
      setZones([]);
      return;
    }
    setZones((data ?? []) as DeliveryZone[]);
  }, [selectedCityId]);`,
`  const loadZones = useCallback(async () => {
    const sequence = ++zonesRequestRef.current;
    if (!selectedCityId) {
      setZones([]);setLoadingZones(false);
      return;
    }
    setLoadingZones(true);
    setZones([]);
    try {
      const { data, error } = await from("delivery_zones")
        .select("*")
        .eq("city_id", selectedCityId)
        .order("name");
      if(sequence !== zonesRequestRef.current)return;
      if(error)throw error;
      // A newly selected city must never show zones from a previous request.
      setZones(((data ?? []) as DeliveryZone[]).filter(z => z.city_id === selectedCityId));
    } catch {
      if(sequence !== zonesRequestRef.current)return;
      toast.error("Não foi possível carregar as zonas de entrega.");
      setZones([]);
    } finally {
      if(sequence === zonesRequestRef.current)setLoadingZones(false);
    }
  }, [selectedCityId]);`, "ordered city query");
replaceOnce('      id: zone.id,\n      mode: zone.geojson',
'      id: zone.id,\n      cityId: zone.city_id,\n      mode: zone.geojson',"edit zone bound");
replaceOnce('    if (!selectedCityId) return toast.error("Selecione uma cidade.");',
`    if (!selectedCityId) return toast.error("Selecione uma cidade.");
    if(zoneWriteRef.current)return;
    if(zoneDraft.id && (zoneDraft.cityId !== selectedCityId ||
       !zones.some(z => z.id === zoneDraft.id && z.city_id === selectedCityId)))
      return toast.error("Esta zona pertence a outra cidade. Cancele a edição e selecione a cidade correta.");`,"save bound city");
replaceOnce('    const latitude = zoneDraft.mode === "radius" ? Number(zoneDraft.centerLatitude) : null;\n    const longitude = zoneDraft.mode === "radius" ? Number(zoneDraft.centerLongitude) : null;',
`    const parseCoordinate=(raw:string,limit:number):number|null=>{
      const normalized=raw.trim();
      if(!/^[+-]?(?:\\d+(?:[.,]\\d+)?|[.,]\\d+)$/.test(normalized))return null;
      const value=Number(normalized.replace(",","."));
      return Number.isFinite(value)&&Math.abs(value)<=limit?value:null;
    };
    const latitude = zoneDraft.mode === "radius" ? parseCoordinate(zoneDraft.centerLatitude,90) : null;
    const longitude = zoneDraft.mode === "radius" ? parseCoordinate(zoneDraft.centerLongitude,180) : null;`, "nonempty coords");
replaceOnce(`        !Number.isFinite(latitude) ||
        !Number.isFinite(longitude) ||
        !Number.isFinite(radius) ||
        Number(radius) <= 0`,
`        latitude === null ||
        longitude === null ||
        radius === null ||
        !Number.isFinite(radius) ||
        radius <= 0`,"coordinate validation");
replaceOnce(`    setBusy("zone");
    const { error } = await rpc("admin_upsert_delivery_zone", {
      _zone_id: zoneDraft.id,
      _city_id: selectedCityId,
      _name: zoneDraft.name.trim(),
      _center_latitude: latitude,
      _center_longitude: longitude,
      _radius_km: radius,
      _geojson: geojson,
      _delivery_fee: deliveryFee,
      _minimum_order: minimumOrder,
      _is_active: zoneDraft.isActive,
    });
    setBusy(null);`,
`    zoneWriteRef.current=true;
    setBusy("zone");
    let error: {message?:string}|null = null;
    try{
      const response=await rpc("admin_upsert_delivery_zone", {
        _zone_id: zoneDraft.id,
        _city_id: zoneDraft.id ? zoneDraft.cityId : selectedCityId,
        _name: zoneDraft.name.trim(),
        _center_latitude: latitude,
        _center_longitude: longitude,
        _radius_km: radius,
        _geojson: geojson,
        _delivery_fee: deliveryFee,
        _minimum_order: minimumOrder,
        _is_active: zoneDraft.isActive,
      });
      error=response.error;
    }catch(e){
      error={message:e instanceof Error?e.message:"Erro de conexão ao salvar zona."};
    }finally{
      zoneWriteRef.current=false;
      setBusy(null);
    }`,"safe RPC ownership");
replaceOnce('onClick={() => setSelectedCityId(city.id)}','onClick={() => changeCity(city.id)}',"normal selection");
replaceOnce('                  setSelectedCityId(city.id);','                  changeCity(city.id);',"dispatch notice");
replaceOnce('    if (data) setSelectedCityId(String(data));','    if (data) changeCity(String(data));',"new city");
replaceOnce('  const editZone = (zone: DeliveryZone) => {\n    setZoneDraft({',
`  const editZone = (zone: DeliveryZone) => {
    if(zone.city_id !== selectedCityId || busy === "zone") {
      toast.error("Esta zona não pertence à cidade selecionada.");return;
    }
    setZoneDraft({`,"edit selection validation");
const must=[MARKER,'cityId: zone.city_id','zonesRequestRef.current','changeCity(city.id)',
'_city_id: zoneDraft.id ? zoneDraft.cityId : selectedCityId','latitude === null','longitude === null'];
for(const key of must)if(!src.includes(key))throw Error("[FAIL] falta guarda "+key);
writeFileSync(path,src,"utf8");
console.log("[OK] INV-026/027: cidade vinculada ao draft, consulta temporal isolada e centro validado.");
