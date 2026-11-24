import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

// Accept both older "Signer #1" and Android Build Tools newer "V2 Signer"/"V3.0 Signer".
// Only the CERTIFICATE digest matters: never mistake public-key digests for APK identity.
export function extractPartnerApkCertSha256(output) {
  const input = String(output ?? "");
  const fingerprints = [...input.matchAll(/^[^\r\n]*\bcertificate SHA-256 digest:[ \t]*([0-9a-fA-F]{64})[ \t]*$/gim)]
    .map((match) => match[1].toLowerCase());
  const unique = [...new Set(fingerprints)];
  if (unique.length !== 1) {
    throw new Error("[FAIL] Partner APK signer must have exactly one unique certificate SHA256; found " + unique.length);
  }
  return unique[0];
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const fingerprint = extractPartnerApkCertSha256(readFileSync(0, "utf8"));
    process.stdout.write(fingerprint + "\n");
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
