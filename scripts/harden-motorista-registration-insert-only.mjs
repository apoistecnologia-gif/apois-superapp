import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

// O cadastro cria nomes novos por documento. Sem colisão, não é necessário
// solicitar UPDATE/SELECT além do INSERT permitido pela RLS de Storage.
const workspace = process.env.APOIS_MOTORISTA_WORKSPACE || ".work/motorista";
const path = resolve(workspace, "src/lib/driverRegistration.mobile.ts");
if (!existsSync(path)) throw Error("[FAIL] Motorista: registro mobile ausente");
const original = readFileSync(path, "utf8");
const marker = "APOIS_DRIVER_DOCS_CREATE_ONLY_V1";
const sourceNeedle = 'upsert: true,';
const countTrue = original.split(sourceNeedle).length - 1;
const countFalse = original.split('upsert: false,').length - 1;
if (original.includes(marker)) {
  if (countTrue > 0 || countFalse < 2) throw Error("[FAIL] Motorista: política de upload parcialmente alterada");
  console.log("[OK] Motorista: documentos já usam INSERT-only");
} else if (countTrue === 2) {
  const patch = original.replace(
    sourceNeedle,
    '// APOIS_DRIVER_DOCS_CREATE_ONLY_V1\n        upsert: false,',
  ).replace(sourceNeedle, 'upsert: false,');
  if (patch.includes('upsert: true,') || patch.split('upsert: false,').length - 1 !== 2) {
    throw Error("[FAIL] Motorista: conversão de upload incompleta");
  }
  writeFileSync(path, patch, "utf8");
  console.log("[OK] Motorista: CNH, selfie e avatar salvos por INSERT sem sobrescrita");
} else if (countTrue === 0 && countFalse === 2) {
  console.log("[OK] Motorista: documentos já usam INSERT-only");
} else {
  throw Error("[FAIL] Motorista: versão inesperada do upload de documentos");
}
