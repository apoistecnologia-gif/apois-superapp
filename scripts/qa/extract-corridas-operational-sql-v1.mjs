// Print ONLY the two live-equivalent Corridas operational SQL functions
// already versioned in a forward-only migration. No remote DB/credentials.
import { readFileSync } from "node:fs";
const path="supabase/corridas-forward-migrations/20260905162500_remove_retired_driver_subscription_gates.sql";
const source=readFileSync(path,"utf8");
const names=[
 "apois_rpc_private.driver_set_presence",
 "private.enforce_driver_operational_stage_transition"
];
for(const name of names){
 const anchor="create or replace function "+name+"(";
 const start=source.indexOf(anchor);
 const end=start<0?-1:source.indexOf("$function$;",start);
 if(start<0||end<0||source.indexOf(anchor,start+1)>=0)throw Error("Function anchor invalid: "+name);
 const sql=source.slice(start,end+"$function$;".length);
 if(sql.includes("driver_subscription_allows_rides"))throw Error("Retired subscription gate still referenced by "+name);
 if(!sql.includes("SECURITY DEFINER") && !sql.includes("security definer"))throw Error("Function security context changed: "+name);
 process.stdout.write(sql+"\n");
}
