import test from "node:test";
import assert from "node:assert/strict";
import { extractPartnerApkCertSha256 } from "./extract-partner-apk-cert-sha256-v1.mjs";
const signature = "4a3476b91674301eb066146b6f3b8384d9827ab4bdb287b6f00cbbeab56a33f4";
const other = "b".repeat(64);

test("older Android Build Tools apksigner label", () => {
  assert.equal(extractPartnerApkCertSha256("Signer #1 certificate SHA-256 digest: " + signature), signature);
});

test("Android Build Tools 37 scheme-specific label", () => {
  assert.equal(extractPartnerApkCertSha256("V2 Signer: certificate SHA-256 digest: " + signature), signature);
  assert.equal(extractPartnerApkCertSha256("V3.0 Signer: certificate SHA-256 digest: " + signature.toUpperCase()), signature);
});

test("duplicate schemes with the same cert are allowed", () => {
  const output = ["V2 Signer: certificate SHA-256 digest: " + signature,
                  "V3.0 Signer: certificate SHA-256 digest: " + signature].join("\n");
  assert.equal(extractPartnerApkCertSha256(output), signature);
});

test("public key SHA256 must not be treated as signing certificate", () => {
  assert.throws(() => extractPartnerApkCertSha256("Signer #1 public key SHA-256 digest: " + signature), /exactly one/);
});

test("different signer certificates are blocked, not silently accepted", () => {
  const output = ["Signer #1 certificate SHA-256 digest: " + signature,
                  "Signer #2 certificate SHA-256 digest: " + other].join("\n");
  assert.throws(() => extractPartnerApkCertSha256(output), /exactly one/);
});

test("empty, malformed, and truncated input fail closed", () => {
  for (const sample of ["", "Signer #1 certificate SHA-256 digest: zz", "V2 Signer: certificate SHA-256 digest: " + signature.slice(0, 63)]) {
    assert.throws(() => extractPartnerApkCertSha256(sample), /exactly one/);
  }
});
