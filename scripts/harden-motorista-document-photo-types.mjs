import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const work = process.env.APOIS_MOTORISTA_WORKSPACE || ".work/motorista";
const cases = [
  {
    path: "src/routes/motorista.cadastro.tsx",
    edits: [
      ['<DriverDocumentField id="doc-selfie"', '<DriverDocumentField accept="image/jpeg,image/png,image/webp" id="doc-selfie"'],
      ['<DriverDocumentField id="doc-vehicle-photo"', '<DriverDocumentField accept="image/jpeg,image/png,image/webp" id="doc-vehicle-photo"'],
    ],
  },
  {
    path: "src/components/DriverDocumentField.tsx",
    edits: [
      [
        'if (!ALLOWED_TYPES.has(raw.type.toLowerCase())) {',
        '// APOIS_DRIVER_DOCUMENT_FIELD_ACCEPT_V1\n    const mime = raw.type.toLowerCase();\n    const allowedByField = accept.split(",").map((item) => item.trim().toLowerCase());\n    if (!ALLOWED_TYPES.has(mime) || !allowedByField.some((item) => item === mime || (item === "image/*" && mime.startsWith("image/")))) {',
      ],
    ],
  },
];
const staging = [];
for (const config of cases) {
  const file = resolve(work, config.path);
  if (!existsSync(file)) throw Error("[FAIL] Motorista: controle de documentos ausente: " + config.path);
  const old = readFileSync(file, "utf8");
  let current = old;
  for (const [before, after] of config.edits) {
    if (current.includes(after)) continue;
    if (current.split(before).length !== 2) throw Error("[FAIL] Motorista: campo de documento inesperado em " + config.path);
    current = current.replace(before, after);
  }
  staging.push({ file, old, current });
}
// Somente gravar após validação completa dos dois arquivos.
for (const { file, old, current } of staging) if (old !== current) writeFileSync(file, current, "utf8");
console.log("[OK] Motorista: selfie e foto de veículo exigem imagem; documentos aceitam PDF quando apropriado");
