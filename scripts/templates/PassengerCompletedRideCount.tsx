import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

// APOIS_PASSENGER_COMPLETED_COUNT_QA216_V1
// public.users.completed_rides is a denormalized counter that can be stale.
// Count only the authenticated passenger's actual server-finalized rides.
// Never turn a failed/blocked request into a misleading zero.
export function PassengerCompletedRideCount({ passengerId }: { passengerId: string | null }) {
  const [count, setCount] = useState<number | null>(null);
  useEffect(() => {
    let active = true;
    setCount(null);
    if (!passengerId) return () => { active = false; };
    void supabase.from("rides").select("id", { count: "exact", head: true })
      .eq("passenger_id", passengerId)
      .eq("status", "finalizada")
      .then(({ count: total, error }) => {
        if (!active) return;
        if (error || total === null || !Number.isSafeInteger(total)) {
          console.warn("[PassengerProfile] Contagem de viagens indisponível");
          setCount(null);
          return;
        }
        setCount(total);
      });
    return () => { active = false; };
  }, [passengerId]);

  return <span data-apois-passenger-completed-count-qa216="true" role="status">
    {count === null ? "— corridas" : `${count} ${count === 1 ? "corrida" : "corridas"}`}
  </span>;
}
