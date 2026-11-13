// APOIS_PARTNER_QA243_COURIER_DAILY_STATS_V1
// get_courier_metrics.completed_deliveries is all-time. Never label it 'today'.
// Apply on disposable courier workspace only: no SQL migration or financial update.
import {readFileSync,writeFileSync} from "node:fs";
import {resolve} from "node:path";
const root=resolve(process.env.APOIS_ENTREGAS_WORKSPACE||".work/partner-entregador");
const homePath=resolve(root,"src/routes/courier.tsx");
const panelPath=resolve(root,"src/components/CourierPremiumViews.tsx");
let home=readFileSync(homePath,"utf8"),panel=readFileSync(panelPath,"utf8");
function once(s,a,b,label){const count=s.split(a).length-1;if(count!==1)throw Error("[FAIL] QA243 "+label+" count="+count);return s.replace(a,b);}
if(home.includes("APOIS_PARTNER_QA243_COURIER_DAILY_STATS_V1"))throw Error("[FAIL] QA243 duplicate");

const helper=[
'// APOIS_PARTNER_QA243_COURIER_DAILY_STATS_V1: exact, timezone-aware, RLS-scoped count.',
'function qa243ZonedParts(date:Date,timezone:string){',
'  const parts=new Intl.DateTimeFormat("en-US",{timeZone:timezone,year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit",second:"2-digit",hourCycle:"h23"}).formatToParts(date);',
'  const field=(name:string)=>Number(parts.find(item=>item.type===name)?.value);',
'  return {year:field("year"),month:field("month"),day:field("day"),hour:field("hour"),minute:field("minute"),second:field("second")};',
'}',
'function qa243ZonedMidnightUtc(y:number,m:number,d:number,tz:string){',
'  const target=Date.UTC(y,m-1,d);let guess=target;',
'  for(let i=0;i<4;i++){',
'    const p=qa243ZonedParts(new Date(guess),tz);',
'    const rendered=Date.UTC(p.year,p.month-1,p.day,p.hour,p.minute,p.second);',
'    const delta=target-rendered;guess+=delta;if(delta===0)break;',
'  }',
'  return new Date(guess).toISOString();',
'}',
'function qa243DayBounds(timezone:string,now=new Date()){',
'  const tz=timezone||"America/Recife";const p=qa243ZonedParts(now,tz);',
'  const tomorrow=new Date(Date.UTC(p.year,p.month-1,p.day+1));',
'  return {start:qa243ZonedMidnightUtc(p.year,p.month,p.day,tz),',
'    end:qa243ZonedMidnightUtc(tomorrow.getUTCFullYear(),tomorrow.getUTCMonth()+1,tomorrow.getUTCDate(),tz)};',
'}',
'async function qa243DeliveredToday(courierId:string,timezone:string):Promise<number|null>{',
'  try {',
'    const bounds=qa243DayBounds(timezone);',
'    const filter="and(delivered_at.gte."+bounds.start+",delivered_at.lt."+bounds.end+")"+',
'      ",and(delivered_at.is.null,updated_at.gte."+bounds.start+",updated_at.lt."+bounds.end+")";',
'    const {count,error}=await from("delivery_jobs")',
'      .select("id",{head:true,count:"exact"})',
'      .eq("courier_id",courierId).eq("status","delivered").or(filter);',
'    if(error)throw error;',
'    return typeof count==="number"&&Number.isInteger(count)&&count>=0?count:null;',
'  } catch(error){',
'    console.warn("[APOIS] Contagem de entregas hoje indisponível",error);',
'    return null; // Never claim zero on an unverified error.',
'  }',
'}',
''
].join("\n");
home=once(home,"function CourierApp() {",helper+"\nfunction CourierApp() {","insert day bounds");
home=once(home,
"const [availabilityRes, offersRes, jobsRes, walletRes, metricsRes, merchantsRes] =",
"const [availabilityRes, offersRes, jobsRes, walletRes, metricsRes, deliveredToday, merchantsRes] =",
"promise binding");
home=once(home,
'rpc("get_courier_metrics", { _timezone: timezone }),',
'rpc("get_courier_metrics", { _timezone: timezone }),\n        qa243DeliveredToday(courierId,timezone),',
"exact count query");
const previous=[
'    if (metricsRes.error) {',
'      console.warn("courier metrics load failed", metricsRes.error.message);',
'      setMetrics(null);',
'    } else {',
'      setMetrics(metricsRes.data ?? null);',
'    }'
].join("\n");
const replacement=[
'    if(metricsRes.error)console.warn("courier metrics load failed",metricsRes.error.message);',
'    const baseMetrics=metricsRes.data&&typeof metricsRes.data==="object"&&!Array.isArray(metricsRes.data)?metricsRes.data:{};',
'    setMetrics({...baseMetrics,completed_deliveries_today:deliveredToday});'
].join("\n");
home=once(home,previous,replacement,"store separate daily count");
const start=panel.indexOf("export function CourierWaitingSheet(");
const end=panel.indexOf("export function CourierOfflineCard(",start);
if(start<0||end<=start)throw Error("[FAIL] QA243 waiting section");
let waiting=panel.slice(start,end);
waiting=once(waiting,
'{String(metrics?.completed_deliveries ?? 0)}',
'{metrics?.completed_deliveries_today == null ? "—" : String(metrics.completed_deliveries_today)}',
"replace misleading all-time number");
waiting=once(waiting,
'>Entregas hoje</p>',
' data-apois-qa243-real-today="true">Entregas hoje</p>',
"daily metric marker");
panel=panel.slice(0,start)+waiting+panel.slice(end);
if(!panel.includes("String(metrics?.completed_deliveries ?? 0)"))throw Error("[FAIL] QA243 all-time finance metrics lost");
if(!home.includes('setActiveJob(jobsRes.data ?? null)'))throw Error("[FAIL] QA243 live delivery refresh lost");
writeFileSync(homePath,home,"utf8");
writeFileSync(panelPath,panel,"utf8");
console.log("[OK] QA243 true deliveries today: exact authorized count, local day boundary, no database write");
