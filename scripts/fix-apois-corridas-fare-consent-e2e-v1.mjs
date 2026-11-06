// APOIS Corridas: quote consent on server recalculation, source-only.
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
const root=resolve(process.env.APOIS_CORRIDAS_WORKSPACE || ".work/corridas");
function edit(file, transform, marker) {
  const path=resolve(root,file), original=readFileSync(path,"utf8");
  if(original.includes(marker)) { console.log("[OK] fare consent already applied: "+file); return; }
  const updated=transform(original);
  if(original===updated || !updated.includes(marker)) throw Error("[FAIL] fare consent "+file);
  writeFileSync(path,updated,"utf8");console.log("[OK] fare consent "+file);
}
function once(source, from, to, label) {
  const count=source.split(from).length-1;
  if(count!==1){
    const details=label.includes("signature") || label.includes("callback")
      ? source.split("\n").filter(line => line.includes("confirmRide")).slice(0,8).map(line => line.trim()).join(" | ")
      : "";
    throw Error("[FAIL] "+label+": expected 1, got "+count+(details ? " / actual: "+details : ""));
  }
  return source.replace(from,to);
}
edit("src/types/rides/ride-request.ts",s=>once(s,
  '  request_key: string;',
  '  request_key: string;\n  // APOIS_FARE_CONSENT_PAYLOAD_E2E_V1: displayed fare in BRL cents.\n  expected_price_cents?: number;',
  "payload quote"),
  "APOIS_FARE_CONSENT_PAYLOAD_E2E_V1");
edit("src/hooks/rides/use-ride-request.tsx",s=>{
  s=once(s,
    "  lastResponse: RideRequestResponse | null;",
    "  lastResponse: RideRequestResponse | null;\n  updatedFareCents?: number | null; // APOIS_FARE_CONSENT_HOOK_E2E_V1",
    "request interface");
  s=once(s,
    "  confirmRide: () => Promise<RideRequestResponse | null>;",
    "  confirmRide: (expectedPriceCents?: number) => Promise<RideRequestResponse | null>;",
    "context signature");
  s=once(s,
    "  const confirmRide = useCallback(async (): Promise<RideRequestResponse | null> => {",
    "  const confirmRide = useCallback(async (expectedPriceCents?: number): Promise<RideRequestResponse | null> => {",
    "callback signature");
  s=once(s,
    '        request_key: request.requestKey,',
    '        request_key: request.requestKey,\n        ...(Number.isSafeInteger(expectedPriceCents) && Number(expectedPriceCents) > 0 ? { expected_price_cents: expectedPriceCents } : {}),',
    "payload quote");
  const discrepancy=[
    '        // An unapproved price change must never insert a ride silently.',
    '        if (isRecord(data) && data["error_code"] === "price_changed" &&',
    '            typeof data["estimated_price"] === "number" &&',
    '            Number.isFinite(data["estimated_price"]) && data["estimated_price"] > 0) {',
    '          setRequest((previous) => ({',
    '            ...previous, isSubmitting: false,',
    '            updatedFareCents: Math.round(Number(data["estimated_price"]) * 100),',
    '            error: "O valor mudou. Confira o novo preco e toque novamente em Solicitar corrida para confirmar.",',
    '          }));',
    '          return null;',
    '        }',
    '        const parsed = parseRideResponse(data);'
  ].join("\n");
  s=once(s,"        const parsed = parseRideResponse(data);",discrepancy,"reconfirm fare");
  s=once(s,
    "          lastResponse: parsed,",
    "          lastResponse: parsed,\n          updatedFareCents: null,",
    "clear accepted fare");
  s=once(s,
    "        lastResponse: null,\n      }));",
    "        lastResponse: null,\n        updatedFareCents: null,\n      }));",
    "clear changed route quote");
  return s;
},"APOIS_FARE_CONSENT_HOOK_E2E_V1");
edit("src/routes/_authenticated.revisar-solicitacao.tsx",s=>{
  const count=s.split('{formatCurrency(checkout.finalTotal)}').length-1;
  if(count<1||count>4)throw Error("[FAIL] review amount changed");
  s=s.replaceAll('{formatCurrency(checkout.finalTotal)}','{formatCurrency(displayFare)}');
  s=once(s,
    '  const canSubmit = checkout.readiness && walletState !== "blocked" && !isSubmitting;',
    '  // APOIS_FARE_CONSENT_REVIEW_E2E_V1: server price is visible before reconfirmation.\n  const displayFare = request.updatedFareCents != null ? request.updatedFareCents / 100 : checkout.finalTotal;\n  const canSubmit = checkout.readiness && walletState !== "blocked" && !isSubmitting;',
    "review fare");
  s=once(s,
    '      const response = await confirmRide();',
    '      const response = await confirmRide(request.updatedFareCents ?? Math.round(checkout.finalTotal * 100));',
    "quote submission");
  s=once(s,
    '  }, [confirmRide, isSubmitting, navigate, recoverActiveRide, walletState]);',
    '  }, [confirmRide, isSubmitting, navigate, recoverActiveRide, walletState, request.updatedFareCents, checkout.finalTotal]);',
    "deps");
  return s;
},"APOIS_FARE_CONSENT_REVIEW_E2E_V1");
console.log("[OK] fare consent: server price change requires second explicit tap.");
