/**
 * APOIS_PARCEIRO_QA283_PROFILE_COMPLETED_RIDES_V1
 * Fix profile '0 corridas': driver_get_profile returns a drivers row, which
 * does not contain completed_rides. An existing authorized public RPC
 * computes the completed ride count for the logged-in driver.
 * Edits disposable Motorista workspace only; no production SQL/finance.
 */
import {readFileSync,writeFileSync} from "node:fs";
import {resolve} from "node:path";
const file=resolve(".work/partner-motorista/src/routes/motorista.perfil.tsx");
let source=readFileSync(file,"utf8");
const marker="APOIS_PARCEIRO_QA283_PROFILE_COMPLETED_RIDES_V1";
if(source.includes(marker))throw Error("[FAIL] QA283 duplicate patch");
function once(before,after,label){
 const n=source.split(before).length-1;
 if(n!==1)throw Error("[FAIL] QA283 "+label+" expected 1 anchor, got "+n);
 source=source.replace(before,after);
}
for(const required of [
 'rpc("driver_get_profile")',
 'const nextDriver = (data ?? null) as Driver | null;',
 'setTotalRides(safeCount(nextDriver.completed_rides))',
 'const completed = safeCount(driver?.completed_rides ?? totalRides);',
 '<StatCard label="Corridas" value={String(completed)} />',
 'ApoisPremiumDriverNav active="perfil"',
])if(!source.includes(required))throw Error("[FAIL] QA283 prerequisite missing: "+required);
once('const [totalRides, setTotalRides] = useState(0);',
 'const [totalRides, setTotalRides] = useState<number | null>(null);',
 'nullable count state');
once('    setLoading(true);\n    setError(null);',
 '    setLoading(true);\n    setError(null);\n    setTotalRides(null);',
 'reset count on authenticated refresh');
once('        setTotalRides(0);','        setTotalRides(null);','missing profile');
const loadCount=[
 '      setDriver(nextDriver);',
 '      // QA283: get the completed rides aggregate from the existing secure',
 '      // owner-authorized RPC. A missing count must never be displayed as zero.',
 '      // No ride, wallet or payment record is modified.',
 '      try {',
 '        const {data: publicRows,error: countError} = await (supabase as any).rpc(',
 '          "get_driver_public_profile", {target_user_id: auth.user.id}',
 '        );',
 '        if(requestId !== requestRef.current)return;',
 '        const row=Array.isArray(publicRows) ? publicRows[0] : null;',
 '        const value=row?.completed_rides;',
 '        if(countError || typeof value !== "number" || !Number.isInteger(value) || value < 0){',
 '          setTotalRides(null);',
 '          if(countError)console.warn("[APOIS DRIVER PROFILE] total de corridas indisponível");',
 '        }else{',
 '          setTotalRides(value);',
 '        }',
 '      }catch{',
 '        if(requestId !== requestRef.current)return;',
 '        setTotalRides(null);',
 '      }'
].join("\n");
once('      setDriver(nextDriver);\n      setTotalRides(safeCount(nextDriver.completed_rides));',
 loadCount,'authenticated aggregate');
once('const completed = safeCount(driver?.completed_rides ?? totalRides);',
 'const completed = totalRides;','only verified count');
once('<Caption className="break-words">{completed} {completed === 1 ? "corrida" : "corridas"}</Caption>',
 '<Caption className="break-words">{completed === null ? "— corridas" : String(completed) + " " + (completed === 1 ? "corrida" : "corridas")}</Caption>',
 'header count');
once('<StatCard label="Corridas" value={String(completed)} />',
 '<StatCard label="Corridas" value={completed === null ? "—" : String(completed)} />',
 'stat card count');
for(const preserved of [
 'rpc("driver_get_profile")', '"get_driver_public_profile", {target_user_id: auth.user.id}',
 'requestId !== requestRef.current','<StatCard label="Avaliação"',
 '<StatCard label="Avaliações"','ApoisPremiumDriverNav active="perfil"',
 'handleLogout','ProfileForm'
])if(!source.includes(preserved))throw Error("[FAIL] QA283 lost profile feature: "+preserved);
if(source.includes('safeCount(driver?.completed_rides ?? totalRides)'))
 throw Error("[FAIL] QA283 stale missing-count fallback survived");
source="// "+marker+"\n"+source;
writeFileSync(file,source,"utf8");
console.log("[OK] QA283: profile completed rides from authenticated server aggregate, missing shown as dash.");
