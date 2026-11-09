// D-004: On registration, a rejected feature-flag RPC must not cause an
// unhandled rejection. Fail closed for gated categories; car/moto stay enabled.
import {readFileSync,writeFileSync} from "node:fs";
import {resolve} from "node:path";
const path=resolve(process.env.APOIS_MOTORISTA_WORKSPACE || ".work/motorista","src/lib/rideFeatureFlags.ts");
const before=readFileSync(path,"utf8");
if(before.includes("APOIS_DRIVER_FLAGS_OFFLINE_RECOVERY_V1")){
  console.log("[OK] driver feature-flag offline recovery already present");
} else {
  const anchor="export async function fetchRideFeatureFlags(): Promise<RideFeatureFlags> {\n  const { data, error } = await (supabase as unknown as FeatureFlagRpcClient).rpc(\n    \"get_ride_feature_flags\",\n  );\n  if (error) {\n    if (import.meta.env.DEV) {\n      console.warn(\"[APOIS] ride feature flags unavailable; disabling gated operations\", error.message);\n    }\n    return { ...DISABLED_RIDE_FEATURE_FLAGS };\n  }\n  return parseRideFeatureFlags(data);\n}";
  if(before.split(anchor).length!==2)throw Error("[FAIL] Driver feature-flag fetch changed; do not patch blindly");
  const after=before.replace(anchor,"export async function fetchRideFeatureFlags(): Promise<RideFeatureFlags> {\n  // APOIS_DRIVER_FLAGS_OFFLINE_RECOVERY_V1: offline RPC may reject instead of\n  // returning an {error} object; onboarding must never lose its render tree.\n  try {\n    const { data, error } = await (supabase as unknown as FeatureFlagRpcClient).rpc(\n      \"get_ride_feature_flags\",\n    );\n    if (error) {\n      if (import.meta.env.DEV) {\n        console.warn(\"[APOIS] ride feature flags unavailable; disabling gated operations\", error.message);\n      }\n      return { ...DISABLED_RIDE_FEATURE_FLAGS };\n    }\n    return parseRideFeatureFlags(data);\n  } catch (cause) {\n    if (import.meta.env.DEV) {\n      console.warn(\"[APOIS] ride feature flag request failed; using safe defaults\", cause);\n    }\n    return { ...DISABLED_RIDE_FEATURE_FLAGS };\n  }\n}");
  writeFileSync(path,after,"utf8");
  console.log("[OK] driver feature-flag rejects recover with disabled flags");
}
