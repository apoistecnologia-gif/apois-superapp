// Read only versioned, non-production SQL. Emit both complete function bodies.
import { readFileSync } from "node:fs";
const source=readFileSync("supabase/corridas-forward-migrations/20260905162500_remove_retired_driver_subscription_gates.sql","utf8");
for(const name of ["apois_rpc_private.driver_accept_ride","apois_rpc_private.driver_accept_ride_candidate_legacy","private.enforce_driver_operational_stage_transition"]){
 const anchor="create or replace function "+name+"(";
 const start=source.indexOf(anchor),end=source.indexOf("$function$;",start);
 if(start<0||end<=start||source.indexOf(anchor,start+1)!==-1)throw Error("SQL function missing/duplicate: "+name);
 const sql=source.slice(start,end+"$function$;".length);
 if(sql.includes("driver_subscription_allows_rides"))throw Error("Retired subscription gate in "+name);
 if(!/security definer/i.test(sql))throw Error("Security mode changed in "+name);
 process.stdout.write(sql+"\n");
}
