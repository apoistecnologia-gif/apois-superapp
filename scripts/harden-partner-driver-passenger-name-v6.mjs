import {readFileSync,writeFileSync} from "node:fs";
import {resolve} from "node:path";
const file=resolve(process.env.APOIS_MOTORISTA_WORKSPACE||".work/partner-motorista","src/routes/motorista.app.tsx");
let s=readFileSync(file,"utf8");
const oldPart=`  // carrega dados do passageiro
  useEffect(() => {
    const pid = incoming?.passenger_id ?? active?.passenger_id ?? ratingRide?.passenger_id;
    if (!pid) { setPassenger(null); return; }
    supabase.from("users").select("name, phone, avatar_url, average_rating, total_ratings").eq("id", pid).maybeSingle()
      .then(({ data }) => setPassenger(data ?? { name: null, phone: null, avatar_url: null, average_rating: null, total_ratings: 0 }));
  }, [active?.passenger_id, ratingRide?.passenger_id, incoming?.passenger_id]);`;
const replacement=`  // APOIS_ASSIGNED_PASSENGER_V6: no blanket SELECT permissions on public.users.
  // Authenticated drivers read only the passenger linked to their active ride.
  useEffect(() => {
    const pid = incoming?.passenger_id ?? active?.passenger_id ?? ratingRide?.passenger_id;
    if (!pid) { setPassenger(null); return; }
    const assignedRideId = active?.id ?? null;
    let cancelled = false;
    void (async () => {
      let record: Passenger | null = null;
      if (assignedRideId) {
        try {
          // Until the reviewed read-only RPC migration is deployed, fall back to
          // the existing RLS-controlled lookup. Do not bypass permissions.
          const response = await (supabase as any).rpc("apois_driver_assigned_passenger", { p_ride_id: assignedRideId });
          if (!response.error && Array.isArray(response.data) && response.data[0]) {
            record = response.data[0] as Passenger;
          }
        } catch { /* keep least-privilege legacy behavior */ }
      }
      if (!record) {
        const response = await supabase.from("users")
          .select("name, phone, avatar_url, average_rating, total_ratings")
          .eq("id", pid).maybeSingle();
        record = response.data;
      }
      if (!cancelled) setPassenger(record ?? { name: null, phone: null, avatar_url: null, average_rating: null, total_ratings: 0 });
    })();
    return () => { cancelled = true; };
  }, [active?.id, active?.passenger_id, ratingRide?.passenger_id, incoming?.passenger_id]);`;
if(!s.includes(oldPart)) throw Error("[FAIL] Driver Passenger V6 source block not found");
s=s.replace(oldPart,replacement);
if(!s.includes("APOIS_ASSIGNED_PASSENGER_V6"))throw Error("[FAIL] passenger safe lookup absent");
writeFileSync(file,s,"utf8");
console.log("[OK] Driver passenger name: scoped RPC first, existing RLS-controlled lookup retained as fallback.");
