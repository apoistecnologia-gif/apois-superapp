// Guardrails: QA signing must remain fixed and separate from production.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const workflow=readFileSync(".github/workflows/apois-client-android.yml","utf8");
const signing=readFileSync("scripts/configure-apois-client-qa-debug-signing.mjs","utf8");
const release=readFileSync("codemagic.yaml","utf8");
const decision=readFileSync("docs/decisoes/ADR-2026-11-05-assinaturas-apois-homologacao.md","utf8");
for(const marker of [
  "secrets.APOIS_CLIENT_QA_DEBUG_KEYSTORE_BASE64",
  "secrets.APOIS_CLIENT_QA_CERT_SHA256",
  "QA_CERT_EXPECTED_SHA256",
  "keytool -list -keystore",
  'test "$ACTUAL_FINGERPRINT" = "$REQUIRED_FINGERPRINT"',
  "Stamp monotonic QA Android version",
  'APP_PACKAGE: "br.com.apois.app"',
  "Configure-apois-client-qa-debug-signing.mjs".toLowerCase(),
]){
  const found=marker.includes("Configure-apois")?workflow.toLowerCase().includes(marker):workflow.includes(marker);
  assert.ok(found,"Cliente QA policy missing: "+marker);
}
assert.ok(!workflow.includes("apois-client-qa-encrypted-signing-v1"),"Lost old cache cannot determine signing identity");
assert.ok(!workflow.includes("97eaf64ee20ef16b2765a6dff5e96a25dbad4da12ccb6e5c2cd48d4c9c2f61f4"),"Lost old fingerprint not pinned");
assert.ok(!workflow.includes("keytool -genkeypair"),"Never auto-generate a new signing key during build");
assert.ok(signing.includes("signingConfig signingConfigs.apoisQaDebug"),"QA certificate must sign generated debug APK");
assert.ok(release.includes("apois_entregas_release"),"Current protected release signing remains unchanged");
assert.ok(decision.includes("Nenhum aplicativo APOIS foi publicado"),"Documented owner decision for future chats");
assert.ok(decision.includes("GitHub Actions"),"GitHub homologation remains approved");
assert.ok(decision.includes("PRODUÇÃO"),"Release signing explicitly postponed to launch review");
console.log("[PASS] APOIS Cliente: durable QA keystore, certificate pin, release separation and decision record preserved.");
