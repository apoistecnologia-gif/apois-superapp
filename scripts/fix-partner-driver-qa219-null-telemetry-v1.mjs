// APOIS_DRIVER_QA219_NULL_TELEMETRY_V1
// Preserve unknown GPS course/speed as NULL, never turn absent values into zero.
// Only modifies generated Motorista src/hooks/useDriverBroadcast.ts.
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const marker = "APOIS_DRIVER_QA219_NULL_TELEMETRY_V1";

export function patchNullTelemetry(source) {
  if (source.includes(marker)) throw new Error("[FAIL] QA219 telemetry already patched");
  const heading = [
    'function normalizeHeading(value: number | null | undefined): number | null {',
    '  const heading = Number(value);',
    '  if (!Number.isFinite(heading)) return null;',
    '  return ((heading % 360) + 360) % 360;',
    '}'
  ].join("\n");
  const speed = [
    'function normalizeSpeed(value: number | null | undefined): number | null {',
    '  const speed = Number(value);',
    '  return Number.isFinite(speed) && speed >= 0 ? speed : null;',
    '}'
  ].join("\n");
  if (source.split(heading).length !== 2 || source.split(speed).length !== 2) {
    throw new Error("[FAIL] QA219 unexpected GPS telemetry normalizers");
  }
  const safeHeading = [
    '// ' + marker + ': unknown heading is not 0 degrees (north).',
    'function normalizeHeading(value: number | null | undefined): number | null {',
    '  if (value == null) return null;',
    '  const heading = Number(value);',
    '  if (!Number.isFinite(heading)) return null;',
    '  return ((heading % 360) + 360) % 360;',
    '}'
  ].join("\n");
  const safeSpeed = [
    'function normalizeSpeed(value: number | null | undefined): number | null {',
    '  if (value == null) return null;',
    '  const speed = Number(value);',
    '  return Number.isFinite(speed) && speed >= 0 ? speed : null;',
    '}'
  ].join("\n");
  const updated = source.replace(heading,safeHeading).replace(speed,safeSpeed);
  for (const token of ['driver_set_presence', '_online: publishOnline', '_heading: publishOnline ? normalizeHeading(position?.heading) : null', '_speed: publishOnline ? normalizeSpeed(position?.speed) : null']) {
    if (!updated.includes(token)) throw new Error("[FAIL] QA219 protected presence contract missing: " + token);
  }
  return updated;
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const path = resolve(process.env.APOIS_MOTORISTA_WORKSPACE || ".work/partner-motorista", "src/hooks/useDriverBroadcast.ts");
  writeFileSync(path,patchNullTelemetry(readFileSync(path,"utf8")),"utf8");
  console.log("[OK] QA219 Motorista: missing course/speed sent as NULL, real 0 preserved");
}
