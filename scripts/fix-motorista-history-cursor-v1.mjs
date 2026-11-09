// OBS-011 Report 1: owner-bound stable cursor pagination for Driver history.
// Source submodules are immutable. This generator changes only an isolated workspace.
import {readFileSync,writeFileSync} from "node:fs";
import {resolve} from "node:path";
const file=resolve(process.env.APOIS_MOTORISTA_WORKSPACE||".work/motorista","src/routes/motorista.corridas.tsx");
let s=readFileSync(file,"utf8");
const marker="APOIS_MOTORISTA_HISTORY_CURSOR_V1";
if(s.includes(marker)){console.log("[OK] Driver history cursor already present.");process.exit(0);}
const edits=[
  [
    "  const [query, setQuery] = useState(\"\");",
    "  const [query, setQuery] = useState(\"\");\n  // APOIS_MOTORISTA_HISTORY_CURSOR_V1\n  const [driverId,setDriverId]=useState<string|null>(null);\n  const [hasMore,setHasMore]=useState(false);\n  const [nextCursor,setNextCursor]=useState<{created_at:string;id:string}|null>(null);\n  const [loadingMore,setLoadingMore]=useState(false);\n  const [moreError,setMoreError]=useState<string|null>(null);",
    "state"
  ],
  [
    "      const driverId = profile.profile.id;",
    "      const driverId = profile.profile.id;\n      if(!active)return;\n      setDriverId(driverId);\n      setHasMore(false);\n      setNextCursor(null);",
    "owner"
  ],
  [
    "        .order(\"created_at\", { ascending: false })\n        .limit(50);",
    "        .order(\"created_at\", { ascending: false })\n        .order(\"id\", { ascending: false })\n        .limit(51);",
    "first page"
  ],
  [
    "      const baseRides = (data ?? []) as RideRow[];",
    "      const baseRides = ((data ?? []) as RideRow[]).slice(0,50);\n      setHasMore((data ?? []).length>50);\n      const tail=baseRides[baseRides.length-1];\n      setNextCursor(tail?{created_at:tail.created_at,id:tail.id}:null);",
    "first cursor"
  ],
  [
    "  const filtered = useMemo(() => {",
    "\n  // APOIS_MOTORISTA_HISTORY_CURSOR_V1: older pages without offset duplicates.\n  const loadMoreRides = async () => {\n    if (loadingMore || !hasMore || !nextCursor || !driverId) return;\n    setLoadingMore(true);\n    setMoreError(null);\n    try {\n      const profile = await loadDriverProfile();\n      if (!profile.ok || profile.profile.id !== driverId) {\n        setRides([]); setHasMore(false); setNextCursor(null);\n        setError(\"Sua sessão mudou. Reabra o histórico para carregar suas corridas.\");\n        return;\n      }\n      const cursor = nextCursor;\n      if (!/^\\d{4}-\\d{2}-\\d{2}T[\\d:.+-]+Z?$/.test(cursor.created_at)\n        || !/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(cursor.id))\n        throw new Error(\"Cursor inválido no histórico de corridas\");\n      const cursorFilter = \"created_at.lt.\" + cursor.created_at\n        + \",and(created_at.eq.\" + cursor.created_at + \",id.lt.\" + cursor.id + \")\";\n      const { data, error: pageError } = await supabase\n        .from(\"rides\")\n        .select(\n          \"id,status,category,payment_method,passenger_id,origin_name,destination_name,final_price,estimated_price,distance_km,duration_min,completed_at,created_at,accepted_at,passenger_rating,passenger_rating_comment,passenger_rated_at\",\n        )\n        .eq(\"driver_id\", driverId)\n        .or(cursorFilter)\n        .order(\"created_at\", { ascending: false })\n        .order(\"id\", { ascending: false })\n        .limit(51);\n      if (pageError) throw pageError;\n      const currentProfile = await loadDriverProfile();\n      if (!currentProfile.ok || currentProfile.profile.id !== driverId) {\n        setRides([]); setHasMore(false); setNextCursor(null);\n        setError(\"Sua sessão mudou. Reabra o histórico para carregar suas corridas.\");\n        return;\n      }\n      const page = ((data ?? []) as RideRow[]).slice(0, 50);\n      const passengerIds = [...new Set(page.map(r => r.passenger_id).filter(Boolean))] as string[];\n      let passengerMap = new Map<string, { name: string | null; avatar_url: string | null }>();\n      if (passengerIds.length) {\n        const { data: passengers, error: passengersError } = await supabase\n          .from(\"users\").select(\"id,name,avatar_url\").in(\"id\", passengerIds);\n        if (passengersError) console.warn(\"[APOIS Motorista] dados públicos indisponíveis:\", passengersError);\n        else passengerMap = new Map((passengers ?? []).map(p => [\n          p.id, { name: p.name ?? null, avatar_url: p.avatar_url ?? null },\n        ]));\n      }\n      const enriched = page.map(r => {\n        const passenger = r.passenger_id ? passengerMap.get(r.passenger_id) : null;\n        return { ...r, passenger_name: passenger?.name ?? null,\n          passenger_photo_url: passenger?.avatar_url ?? null };\n      });\n      setRides(existing => {\n        const byId = new Map((existing ?? []).map(r => [r.id, r]));\n        for (const ride of enriched) byId.set(ride.id, ride);\n        return [...byId.values()].sort((a, b) =>\n          String(b.created_at).localeCompare(String(a.created_at))\n          || String(b.id).localeCompare(String(a.id)));\n      });\n      setHasMore((data ?? []).length > 50);\n      const tail = page[page.length - 1];\n      setNextCursor(tail ? { created_at: tail.created_at, id: tail.id } : null);\n    } catch (cause) {\n      console.error(\"[APOIS Motorista] página antiga indisponível:\", cause);\n      setMoreError(\"Não foi possível carregar corridas anteriores. Tente novamente.\");\n    } finally {\n      setLoadingMore(false);\n    }\n  };\n\n  const filtered = useMemo(() => {",
    "older pages"
  ],
  [
    "          )}\n        </div>\n      </main>\n      <ApoisDriverBottomNav />",
    "          )}\n          {rides !== null && hasMore && !customRangeInvalid && (\n            <div className=\"flex flex-col items-center gap-2 py-3\">\n              <BodySmall className=\"text-center text-muted-foreground\">O resumo mostra as corridas carregadas até agora.</BodySmall>\n              <DSButton type=\"button\" variant=\"outline\" disabled={loadingMore}\n                onClick={() => void loadMoreRides()} className=\"min-h-11 px-5\">\n                {loadingMore ? \"Carregando…\" : \"Carregar corridas anteriores\"}\n              </DSButton>\n              {moreError ? <BodySmall role=\"alert\" className=\"text-destructive\">{moreError}</BodySmall> : null}\n            </div>\n          )}\n        </div>\n      </main>\n      <ApoisDriverBottomNav />",
    "load more UI"
  ]
];
for(const [before,after,label] of edits){
 const count=s.split(before).length-1;
 if(count!==1)throw Error("[FAIL] Driver history "+label+" anchor="+count);
 s=s.replace(before,after);
}
if(!s.includes(marker)||!s.includes("loadMoreRides")||!s.includes("Carregar corridas anteriores"))
 throw Error("[FAIL] Driver history cursor code not generated");
writeFileSync(file,s,"utf8");
console.log("[OK] Driver history: owner-scoped stable cursor, 50 rows/page, load-more UI.");
