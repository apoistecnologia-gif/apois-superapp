// APOIS_DRIVER_PROFILE_NATIVE_AVATAR_GATE_V1 — static; no file uploads or apps.
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
const root=resolve(process.env.APOIS_MOTORISTA_WORKSPACE||".work/partner-motorista");
const read=(p)=>readFileSync(resolve(root,p),"utf8");
const uploader=read("src/components/ProfilePhotoUploader.tsx");
const profile=read("src/routes/motorista.perfil.tsx");
const helper=resolve(root,"src/lib/driverNativePhotoPicker.ts");
assert.ok(existsSync(helper),"native picker helper from existing registration pipeline required");
for(const marker of [
  "APOIS_DRIVER_PROFILE_NATIVE_AVATAR_V1", 'pickDriverPhotoNative("gallery","user")',
  "isNativePickerCancellation(cause)","await handleFile(picked)",
  "nativeDriverPicker = false","nativePickingRef.current",
  "uploadProfilePhoto(safeUserId, compressed)",
  "onUploaded({ ...result, signedUrl })"
]) assert.ok(uploader.includes(marker),"avatar contract lost "+marker);
assert.ok(profile.includes("APOIS_DRIVER_PROFILE_NATIVE_AVATAR_ROUTE_V1"));
assert.equal((profile.match(/nativeDriverPicker onUploaded=\{handlePhotoUploaded\}/g)||[]).length,1,"only Motorista opts in");
assert.ok(uploader.includes('else inputRef.current?.click()'),"browser fallback preserved");
assert.ok(!uploader.includes('service_role'),"no privileged key in client");
console.log("[OK] Motorista avatar Android native, browser fallback, old upload+RPC and isolated opt-in.");
