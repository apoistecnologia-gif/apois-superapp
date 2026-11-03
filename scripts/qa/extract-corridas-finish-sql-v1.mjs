// Extract actual queued-ride finish SQL from the existing un-applied migration.
import {readFileSync} from "node:fs";
const text=readFileSync("supabase/corridas-forward-migrations/20260905162500_remove_retired_driver_subscription_gates.sql","utf8");
for(const name of ["private.enforce_driver_operational_stage_transition","apois_rpc_private.driver_finish_ride"]){
 const marker="create or replace function "+name+"(", start=text.indexOf(marker);
 const end=start<0?-1:text.indexOf("$function$;",start);
 if(start<0||end<0||text.indexOf(marker,start+1)!==-1)throw new Error("Invalid SQL function: "+name);
 const body=text.slice(start,end+"$function$;".length);
 if(body.includes("driver_subscription_allows_rides"))throw new Error("Retired subscription gate in "+name);
 process.stdout.write(body+"\n");
}
