// Emit exactly the staged busy-driver expansion SQL (never production SQL).
import {readFileSync} from "node:fs";
const sql=readFileSync("supabase/corridas-forward-migrations/20260905162500_remove_retired_driver_subscription_gates.sql","utf8");
const anchor="create or replace function public.append_nearby_busy_driver_candidates()";
const start=sql.indexOf(anchor);
const end=sql.indexOf("$function$;",start);
if(start<0||end<start||sql.indexOf(anchor,start+1)!==-1) throw Error("Busy-candidate function missing/duplicated");
const body=sql.slice(start,end+"$function$;".length);
for(const invariant of [
 "d.current_lat between -34 and 6",
 "d.current_lng between -74 and -32",
 "d.last_location_at<=now()+interval '30 seconds'",
 "new.origin_lat not between -34 and 6",
 "new.origin_lng not between -74 and -32",
 "new.request_expires_at<=now()",
 "private.driver_kyc_is_ready(d.id)",
 "d.blocked_at is null",
 "d.suspended_at is null",
 "not exists(select 1 from public.rides queued_ride",
]) if(!body.includes(invariant)) throw Error("Missing busy-driver dispatch invariant: "+invariant);
process.stdout.write(body+"\n");
