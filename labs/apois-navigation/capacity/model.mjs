// Planning model only. No provider pricing, network, deployment or live users.
const finite=(v,lo,hi)=>typeof v==="number"&&Number.isFinite(v)&&v>=lo&&v<=hi;
const integer=(v,lo,hi)=>Number.isSafeInteger(v)&&v>=lo&&v<=hi;
const round=n=>Math.round(n*100)/100;
export function readLocalEvidence(report){
  if(!report||!integer(report.requests,1,1000000)||report.successes!==report.requests||
    !report.failures||Object.keys(report.failures).length!==0||
    !finite(report.durationSeconds,60,86400)||!finite(report.totalLatency?.p95Ms,0,60000)||
    !integer(report.responseBytes?.total,1,Number.MAX_SAFE_INTEGER)||
    !integer(report.responseBytes?.max,1,2000000)||report.responseBytes.total>report.requests*report.responseBytes.max||
    !Array.isArray(report.samples)||report.samples.length<2)throw Error("Incomplete or failed local capacity evidence");
  return Object.freeze({requests:report.requests,durationSeconds:report.durationSeconds,
    achievedPerMinute:report.requests/report.durationSeconds*60,
    meanResponseBytes:report.responseBytes.total/report.requests,p95Ms:report.totalLatency.p95Ms});
}
// Asset payload is not the full APK, not the actual store download, and not
// proof of billing by a particular distribution provider.
export function planMapDistribution({activeDrivers,assetBytes=3524826,downloadsPerDriver=null,chargedShare=null,archiveBytes=3422737}={}){
  if(!integer(activeDrivers,1,1000000)||!integer(assetBytes,1,1e9)||!integer(archiveBytes,1,assetBytes)||
    !(downloadsPerDriver===null||finite(downloadsPerDriver,0,1000))||
    !(chargedShare===null||finite(chargedShare,0,1)))throw Error("Invalid map distribution assumptions");
  const mapPayloadGb=downloadsPerDriver===null?null:activeDrivers*downloadsPerDriver*assetBytes/1e9;
  const chargedPayloadGb=mapPayloadGb===null||chargedShare===null?null:mapPayloadGb*chargedShare;
  return {assetBytes,archiveBytes,packagedPlusPrivateArchiveBytes:assetBytes+archiveBytes,
    downloadsPerDriver,chargedShare,mapPayloadGb:mapPayloadGb===null?null:round(mapPayloadGb),
    chargedPayloadGb:chargedPayloadGb===null?null:round(chargedPayloadGb),
    chargedGbPerDriver:chargedPayloadGb===null?null:chargedPayloadGb/activeDrivers,
    actualDistributionVerified:false};
}
export function planCapacity(input){
  const {activeDrivers,daysPerMonth,ridesPerDriverDay,reroutesPerLeg,peakHourShare,burstFactor,
    reserveFraction,routeQuotaPerMinute=60,targetPerDriver=5,meanResponseBytes=null,
    mapGbPerDriver=null,egressBrlPerGb=null,fixedMonthlyBrl=null,variableBrlPer1000Routes=null,
    localEvidence=null}=input??{};
  if(!integer(activeDrivers,1,1000000)||!integer(daysPerMonth,1,31)||
    !finite(ridesPerDriverDay,0,1000)||!finite(reroutesPerLeg,0,20)||
    !finite(peakHourShare,1/24,1)||!finite(burstFactor,1,100)||
    !finite(reserveFraction,0,.95)||!integer(routeQuotaPerMinute,1,1000000)||
    !finite(targetPerDriver,0,1000000)||
    ![meanResponseBytes,mapGbPerDriver,egressBrlPerGb,fixedMonthlyBrl,variableBrlPer1000Routes]
      .every(v=>v===null||finite(v,0,1e9)))throw Error("Invalid planning assumptions");
  // Two legs per ride, one initial route plus the assumed average reroutes.
  const routesPerDriverDay=ridesPerDriverDay*2*(1+reroutesPerLeg);
  const routesPerDay=activeDrivers*routesPerDriverDay;
  const monthlyRoutes=routesPerDay*daysPerMonth;
  const peakPerMinute=routesPerDay*peakHourShare/60*burstFactor;
  const requiredQuota=Math.ceil(peakPerMinute/(1-reserveFraction));
  const evidence=localEvidence===null?null:readLocalEvidence(localEvidence);
  // An empirical local sample is not a remote production capacity guarantee.
  const bytes=meanResponseBytes??evidence?.meanResponseBytes??null;
  const routePayloadGb=bytes===null?null:monthlyRoutes*bytes/1e9;
  const mapGb=mapGbPerDriver===null?null:activeDrivers*mapGbPerDriver;
  const totalPayloadGb=routePayloadGb===null||mapGb===null?null:routePayloadGb+mapGb;
  const ceiling=activeDrivers*targetPerDriver;
  const variable=variableBrlPer1000Routes===null||
    egressBrlPerGb===null||totalPayloadGb===null?null:
      variableBrlPer1000Routes*monthlyRoutes/1000+egressBrlPerGb*totalPayloadGb;
  const cost=variable===null||fixedMonthlyBrl===null?null:fixedMonthlyBrl+variable;
  return {activeDrivers,monthlyRoutes:Math.ceil(monthlyRoutes),routesPerDriverDay:round(routesPerDriverDay),
    peakRequestsPerMinute:round(peakPerMinute),requiredQuotaPerMinute:requiredQuota,routeQuotaPerMinute,
    configuredQuotaFits:requiredQuota<=routeQuotaPerMinute,
    localEvidence:evidence,localEvidenceCoversOfferedLoad:evidence===null?null:requiredQuota<=evidence.achievedPerMinute,
    productionCapacityVerified:false,
    targetPerDriverBrl:targetPerDriver,monthlyCostCeilingBrl:round(ceiling),
    routePayloadGb:routePayloadGb===null?null:round(routePayloadGb),
    mapPayloadGb:mapGb===null?null:round(mapGb),
    estimatedCostBrl:cost===null?null:round(cost),
    estimatedCostPerDriverBrl:cost===null?null:round(cost/activeDrivers),
    withinBudget:cost===null?null:cost<=ceiling,
    maxFixedMonthlyBrl:variable===null?null:round(ceiling-variable),
    assumptions:{daysPerMonth,ridesPerDriverDay,reroutesPerLeg,peakHourShare,burstFactor,reserveFraction,
      responseBytes:bytes,mapGbPerDriver,egressBrlPerGb,fixedMonthlyBrl,variableBrlPer1000Routes}};
}
