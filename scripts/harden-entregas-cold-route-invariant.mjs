// APOIS_ENTREGAS_COLD_ROUTE_INVARIANT_V1
//
// Defeito reproduzido em navegador (Playwright, 390x844, build customer):
// abrir diretamente #/courier, #/merchant ou #/admin — rotas que o build do
// Cliente remove da árvore por `routeFileIgnorePattern` — derruba o app com
// "Error: Invariant failed" e tela em branco (0 caracteres), em vez de
// redirecionar. O AuthSessionIsolation redireciona depois, mas o router já
// tentou casar uma rota inexistente e lançou antes.
//
// Correção: normalizar o hash ANTES de criar o router. Assim a rota proibida
// nunca chega ao matcher e o usuário cai na landing do produto.
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.env.APOIS_ENTREGAS_WORKSPACE || '.work/entregas';
const path = resolve(root, 'src/router.tsx');
let source = readFileSync(path, 'utf8');

const marker = 'APOIS_ENTREGAS_COLD_ROUTE_INVARIANT_V1';
if (!source.includes(marker)) {
  const importAnchor = 'import { installNativeGeolocationBridge } from "./lib/native-geolocation-bridge";';
  if (!source.includes(importAnchor)) {
    console.error('[FAIL] Entregas: import do bridge de geolocalização não encontrado em router.tsx');
    process.exit(1);
  }
  source = source.replace(
    importAnchor,
    `${importAnchor}\nimport { getApoisProductMode, getProductLandingRoute, isPathAllowedForProduct } from "./lib/product-routing";`,
  );

  const callAnchor = 'export const getRouter = () => {\n  installNativeGeolocationBridge();';
  if (!source.includes(callAnchor)) {
    console.error('[FAIL] Entregas: getRouter não encontrado em router.tsx');
    process.exit(1);
  }
  source = source.replace(
    callAnchor,
    `export const getRouter = () => {
  installNativeGeolocationBridge();

  // ${marker}: rota de outro produto nunca chega ao matcher. Sem isto o app
  // lançava "Invariant failed" e ficava em branco no cold load.
  if (typeof window !== "undefined") {
    const product = getApoisProductMode();
    const rawHash = window.location.hash.startsWith("#/")
      ? window.location.hash.slice(1).split(/[?#]/, 1)[0] || "/"
      : null;
    const initialPath = rawHash ?? (window.location.pathname || "/");
    if (!isPathAllowedForProduct(initialPath, product)) {
      window.location.replace(\`#\${getProductLandingRoute(product)}\`);
    }
  }`,
  );
  writeFileSync(path, source, 'utf8');
  console.log('[OK] Entregas: cold load em rota de outro produto redireciona antes do router');
} else {
  console.log('[OK] Entregas: normalização de rota inicial já aplicada');
}

const final = readFileSync(path, 'utf8');
if (!/isPathAllowedForProduct\(initialPath, product\)/.test(final)) {
  console.error('[FAIL] Entregas: guarda de rota inicial ausente no router');
  process.exit(1);
}
console.log('[OK] Entregas: contrato confirmado — rota inicial validada antes de criar o router.');
