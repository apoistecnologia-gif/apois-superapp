/**
 * APOIS_C0_LAUNCH_POLICY_V1
 *
 * Public QA build of this isolated branch ships only Corridas. Legacy
 * full-mode sources remain completely unchanged for future reactivation.
 * No runtime/user-controlled toggle can enable deliveries inside an APK:
 * excluded modules simply are not packaged.
 */
export const APOIS_LAUNCH_MODE = "corridas_only";
export const SUPPORTED_LAUNCH_MODES = Object.freeze(["corridas_only", "full"]);

export function launchMode(env = process.env) {
  const mode = String(env.APOIS_LAUNCH_MODE ?? APOIS_LAUNCH_MODE).trim();
  if (!SUPPORTED_LAUNCH_MODES.includes(mode))
    throw Error("APOIS_LAUNCH_MODE_INVALID: " + mode);
  return mode;
}
export function enabledModules(product, env = process.env) {
  const mode = launchMode(env);
  if (product === "client")
    return mode === "corridas_only" ? ["corridas"] : ["corridas", "entregas"];
  if (product === "partner")
    return mode === "corridas_only" ? ["motorista"] : ["motorista", "entregador"];
  throw Error("APOIS_UNSUPPORTED_PRODUCT: " + product);
}
export function isCorridasOnly(env = process.env) {
  return launchMode(env) === "corridas_only";
}
