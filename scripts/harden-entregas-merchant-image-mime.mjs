import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

// Todas as validações acontecem ANTES da primeira gravação. Não deixar a
// workspace parcialmente transformada se uma estrutura de formulário mudar.
const workspace = process.env.APOIS_ENTREGAS_WORKSPACE || ".work/entregas";
const changes = [
  {
    path: "src/components/MerchantProductEditor.tsx",
    old: 'if (!file.type.startsWith("image/")) return toast.error("Selecione uma imagem válida.");',
    newer: '// APOIS_MERCHANT_IMAGE_MIME_V1\n    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) return toast.error("Envie uma imagem JPG, PNG ou WEBP.");',
  },
  {
    path: "src/routes/merchant.tsx",
    old: 'if (!file.type.startsWith("image/")) {\n      toast.error("Selecione um arquivo de imagem válido.");\n      return;\n    }',
    newer: '// APOIS_MERCHANT_IMAGE_MIME_V1\n    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {\n      toast.error("Envie uma imagem JPG, PNG ou WEBP.");\n      return;\n    }',
  },
];

const staged = [];
for (const item of changes) {
  const file = resolve(workspace, item.path);
  if (!existsSync(file)) throw Error("[FAIL] Entregas: rota não encontrada: " + item.path);
  const original = readFileSync(file, "utf8");
  let next = original;

  if (original.includes(item.newer)) {
    // Idempotente. O hardener deve preservar as demais alterações.
  } else if (original.includes("APOIS_MERCHANT_IMAGE_MIME_V1")) {
    throw Error("[FAIL] Entregas: transformação MIME parcialmente alterada em " + item.path);
  } else if (original.split(item.old).length === 2) {
    next = original.replace(item.old, item.newer);
  } else {
    throw Error("[FAIL] Entregas: regra de upload mudou em " + item.path);
  }

  if (item.path === "src/routes/merchant.tsx") {
    const broad = (next.match(/accept="image\/\*"/g) || []).length;
    const narrow = (next.match(/accept="image\/jpeg,image\/png,image\/webp"/g) || []).length;
    if (broad === 2) {
      next = next.replaceAll('accept="image/*"', 'accept="image/jpeg,image/png,image/webp"');
    } else if (!(broad === 0 && narrow >= 2)) {
      throw Error("[FAIL] Entregas: seletor de logo/capa mudou; revisão necessária");
    }
  }
  staged.push({ file, original, next });
}
for (const { file, original, next } of staged) {
  if (original !== next) writeFileSync(file, next, "utf8");
}
console.log("[OK] Entregas: uploads e seletores JPG/PNG/WEBP consistentes e idempotentes");
