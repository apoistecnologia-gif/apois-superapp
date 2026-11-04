import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

// Scope: the transient APOIS Parceiro Motorista build workspace only.
// The source submodule and Supabase production configuration remain intact.
const root = resolve(process.env.APOIS_MOTORISTA_WORKSPACE || ".work/partner-motorista");
function edit(relativePath, transform) {
  const file = resolve(root, relativePath);
  const previous = readFileSync(file, "utf8");
  const next = transform(previous);
  if (next === previous) throw Error("[FAIL] Google PKCE V20 produced no change: " + relativePath);
  writeFileSync(file, next, "utf8");
}
function exactlyOne(source, needle, label) {
  const n = source.split(needle).length - 1;
  if (n !== 1) throw Error("[FAIL] Google PKCE V20: " + label + " (" + n + ")");
}

edit("src/integrations/supabase/client.ts", (src) => {
  // The generated driver Google callback is deliberately code-only:
  // exchangeCodeForSession() cannot complete when the default implicit
  // flow is used. Enable PKCE on the SAME Supabase client (no second session).
  const target = "      persistSession: true,\n      autoRefreshToken: true,";
  exactlyOne(src, target, "Supabase auth configuration");
  if (src.includes('flowType: "pkce"')) throw Error("[FAIL] Google PKCE V20 is already configured");
  return src.replace(
    target,
    '      persistSession: true,\n      autoRefreshToken: true,\n      flowType: "pkce", // APOIS_PARTNER_MOTORISTA_GOOGLE_PKCE_V20',
  );
});

edit("src/components/DriverGoogleLoginButton.tsx", (src) => {
  if (!src.includes('const CALLBACK = "br.com.apois.parceiro://auth/motorista-google";')) {
    throw Error("[FAIL] Google PKCE V20: unexpected Android callback URL");
  }
  const inFlightAnchor = "  const listenerRef = useRef<PluginListenerHandle | null>(null);";
  exactlyOne(src, inFlightAnchor, "listenerRef");
  src = src.replace(inFlightAnchor,
    inFlightAnchor + "\n  const googleCallbackProcessingRef = useRef(false);");

  const callbackAnchor = "    if (!isDriverCallback(rawUrl)) return;\n    try {";
  exactlyOne(src, callbackAnchor, "callback authentication guard");
  src = src.replace(callbackAnchor,
    '    if (!isDriverCallback(rawUrl) || googleCallbackProcessingRef.current) return;\n' +
    '    googleCallbackProcessingRef.current = true;\n' +
    '    try {');

  const loginAnchor = "  const login = async () => {\n    if (loading) return;\n    setLoading(true);";
  exactlyOne(src, loginAnchor, "login start");
  src = src.replace(loginAnchor, loginAnchor +
    '\n    googleCallbackProcessingRef.current = false;');

  // Duplicate Android appUrlOpen / cold-start forwarded events must never
  // exchange the same one-time code simultaneously.
  if (!src.includes("googleCallbackProcessingRef.current = true;") ||
      !src.includes("exchangeCodeForSession(code)") ||
      !src.includes("google_callback_tokens_rejected") ||
      !src.includes('const FORWARDED_KEY = "apois-parceiro:motorista-google-url";')) {
    throw Error("[FAIL] Google PKCE V20: OAuth safety invariants absent");
  }
  return src;
});
console.log("[OK] Motorista: Google OAuth uses PKCE with one-time code exchange; duplicate Android callbacks ignored.");
