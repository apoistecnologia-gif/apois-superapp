import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { extname, resolve } from 'node:path';

const root = resolve('.work/entregas/.output/public');
if (!existsSync(root)) {
  console.error('[FAIL] Entregas customer bundle: .output/public ausente após build:customer');
  process.exit(1);
}

const executableExtensions = new Set(['.js', '.mjs', '.html']);
const files = [];
function walk(dir) {
  for (const name of readdirSync(dir)) {
    const full = resolve(dir, name);
    const stat = statSync(full);
    if (stat.isDirectory()) walk(full);
    else if (!name.endsWith('.map') && executableExtensions.has(extname(name))) files.push(full);
  }
}
walk(root);

if (!files.length) {
  console.error('[FAIL] Entregas customer bundle: nenhum artefato JS/HTML executável encontrado');
  process.exit(1);
}

const corpus = files.map((file) => readFileSync(file, 'utf8')).join('\n');
let failed = false;

// Estes identificadores representam chamadas/superfícies que não podem sobreviver no
// produto Cliente em pagamento direto. Texto jurídico ou documentação não entra no
// corpus porque source maps/markdown/source foram deliberadamente excluídos.
const forbiddenActiveMarkers = [
  'create-merchant-mercadopago-pix',
  'create-asaas-pix-charge',
  'create-pix-charge',
  'PixPaymentScreen',
  'https://sdk.mercadopago.com/js/v2',
  'https://api.openpix.com',
  'https://api.asaas.com',
];
for (const marker of forbiddenActiveMarkers) {
  if (corpus.includes(marker)) {
    console.error(`[FAIL] Entregas customer bundle contém resíduo ativo proibido: ${marker}`);
    failed = true;
  }
}

const requiredMarkers = ['create-order', 'cash', 'payment_status'];
for (const marker of requiredMarkers) {
  if (!corpus.includes(marker)) {
    console.error(`[FAIL] Entregas customer bundle não preserva marcador operacional esperado: ${marker}`);
    failed = true;
  }
}

// Nomes genéricos podem aparecer em chunks compartilhados/legados sem constituir uma
// chamada alcançável do Cliente. Eles são contados e explicitamente classificados para
// investigação, mas não transformados automaticamente em falha funcional.
const classifiedMarkers = [
  'merchant-payment-readiness',
  'process-superapp-refund',
  'sync-payment-status',
  'Mercado Pago',
  'MercadoPago',
  'OpenPix',
  'PagBank',
  'Asaas',
];
for (const marker of classifiedMarkers) {
  const occurrences = corpus.split(marker).length - 1;
  if (occurrences > 0) {
    console.warn(`[WARN] Entregas customer bundle: ${marker} aparece ${occurrences} vez(es); classificado como chunk compartilhado/legado até prova de chamada alcançável.`);
  }
}

if (failed) process.exit(1);
console.log(`[OK] Entregas customer bundle: ${files.length} artefato(s) executável(is) verificados sem gateway proibido de alta confiança.`);
console.log('[OK] Entregas customer bundle preserva create-order + cash + payment_status no artefato final.');
