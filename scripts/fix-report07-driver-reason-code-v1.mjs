// Relatorio 07 / INV-054 + INV-056: reason protocol and honest unavailable-edge errors.
// Source lock is immutable; patch only the isolated Motorista workspace.
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const file=resolve(process.env.APOIS_MOTORISTA_WORKSPACE || ".work/partner-motorista","src/lib/driverRideLifecycle.mobile.ts");
const marker="APOIS_REPORT07_DRIVER_REASON_CODE_V1";
let content=readFileSync(file,"utf8");
function once(from,to,label){
 const n=content.split(from).length-1;
 if(n!==1)throw Error("[FAIL] report07 "+label+" anchor="+n);
 content=content.replace(from,to);
}
if(content.includes(marker)){
 if(!content.includes('reason_code: reasonCode')||!content.includes("Operação de corrida temporariamente indisponível"))
   throw Error("[FAIL] report07: partial existing patch");
 console.log("[OK] Report07 reason code already applied");
 process.exit(0);
}
once('function assertRideId(rideId: string) {',
`// ${marker}: UI label is not the rule selector.\nfunction report07ReasonCode(reason: string): "passenger_no_show" | "other" {\n  const normalized = reason.trim().toLocaleLowerCase("pt-BR").normalize("NFD")\n    .replace(/[\\u0300-\\u036f]/g, "").replace(/\\s+/g, " ");\n  return ["passageiro nao apareceu", "passageiro nao compareceu", "no-show", "no show"].includes(normalized)\n    ? "passenger_no_show" : "other";\n}\n\nfunction assertRideId(rideId: string) {`,
"canonical classifier");
once('  if (error) throw new Error(readableDriverRpcError(error.message));\n  const result = (response ?? {}) as DriverRedispatchResponse;',
`  if (error) {\n    if (/function.?not.?found|not found|404/i.test(String(error.message ?? ""))) {\n      throw new Error("Operação de corrida temporariamente indisponível. Atualize os dados da corrida antes de tentar novamente.");\n    }\n    throw new Error(readableDriverRpcError(error.message));\n  }\n  const result = (response ?? {}) as DriverRedispatchResponse;`,
"missing endpoint");
once('  const reason = String(data.motivo ?? "").trim().slice(0, 240);\n  return callDriverRedispatchFunction("driver-cancel-redispatch", {\n    ride_id: data.rideId,\n    reason: reason || null,\n  });',
`  const reason = String(data.motivo ?? "").trim().slice(0, 240);\n  const reasonCode = report07ReasonCode(reason);\n  return callDriverRedispatchFunction("driver-cancel-redispatch", {\n    ride_id: data.rideId,\n    reason: reason || null,\n    reason_code: reasonCode,\n  });`,
"reason code payload");
writeFileSync(file,content,"utf8");
console.log("[OK] Report07: reason_code distinct from UI label; missing edge has no RPC fallback");
