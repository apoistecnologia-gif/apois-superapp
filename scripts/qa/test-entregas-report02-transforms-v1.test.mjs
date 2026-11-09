// INV-013 / INV-033: exercise actual workspace transformers against pinned
// Entregas files in a disposable temp directory; never edit source submodules.
// This does not replace TSX build, mobile or authenticated E2E testing.
import test from 'node:test';
import assert from 'node:assert/strict';
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const source = resolve(root, 'sources/apois-entregas');
const paths = [
  'src/contexts/CartContext.tsx',
  'src/routes/sacola.tsx',
  'src/routes/checkout.tsx',
  'src/routes/pedidos.tsx',
  'src/components/MerchantProductEditor.tsx',
  'src/routes/perfil/dados-pessoais.tsx',
  'src/routes/merchant.tsx',
];
const scripts = [
  'scripts/fix-entregas-cart-price-refresh-v2.mjs',
  'scripts/fix-entregas-persisted-cart-validation-v3.mjs',
  'scripts/fix-entregas-customer-orders-pagination-v1.mjs',
  'scripts/harden-entregas-merchant-image-mime.mjs',
  'scripts/fix-entregas-merchant-assets-v1.mjs',
  'scripts/fix-entregas-merchant-product-image-reconciliation-v1.mjs',
  'scripts/fix-entregas-customer-avatar-cache-v1.mjs',
];

function runTransformer(script, workspace) {
  const result = spawnSync(process.execPath, [resolve(root, script)], {
    cwd: root,
    env: { ...process.env, APOIS_ENTREGAS_WORKSPACE: workspace },
    encoding: 'utf8',
  });
  assert.equal(result.status, 0,
    script + ' failed (status ' + result.status + '): ' + result.stderr + result.stdout);
}

test('pinned Entregas source accepts cart and history repair without source mutation', () => {
  for (const relative of paths) {
    assert.ok(existsSync(resolve(source, relative)),
      'missing pinned submodule source: ' + relative);
  }
  const originals = new Map(paths.map(relative => [
    relative, readFileSync(resolve(source, relative), 'utf8'),
  ]));
  const workspace = mkdtempSync(join(tmpdir(), 'apois-report02-fixture-'));
  try {
    for (const relative of paths) {
      const destination = resolve(workspace, relative);
      mkdirSync(dirname(destination), { recursive: true });
      copyFileSync(resolve(source, relative), destination);
    }
    for (const script of scripts) runTransformer(script, workspace);
    const cart = readFileSync(resolve(workspace, paths[0]), 'utf8');
    const sacola = readFileSync(resolve(workspace, paths[1]), 'utf8');
    const checkout = readFileSync(resolve(workspace, paths[2]), 'utf8');
    const pedidos = readFileSync(resolve(workspace, paths[3]), 'utf8');
    const editor = readFileSync(resolve(workspace, paths[4]), 'utf8');
    const profileEditor = readFileSync(resolve(workspace, paths[5]), 'utf8');
    const merchantRoute = readFileSync(resolve(workspace, paths[6]), 'utf8');

    assert.match(cart, /APOIS_CART_PERSISTED_REVALIDATION_V3/);
    assert.match(cart, /snapshot\.some\(item=>item\.merchantId!==merchant\.id\)/);
    assert.match(cart, /if\(sequence!==catalogRequest\.current\)return false/);
    assert.ok((cart.match(/catalogRequest\.current \+= 1/g) ?? []).length >= 4,
      'cart mutation must invalidate in-flight catalog reads');
    assert.match(sacola, /Item indisponível ou personalização inválida/);
    assert.match(checkout, /await refreshCartCatalog\(\)/);
    const guard = checkout.indexOf('await refreshCartCatalog()');
    const order = checkout.indexOf('create-order', guard);
    assert.ok(guard >= 0 && order > guard, 'cart check must precede create-order');

    assert.match(pedidos, /APOIS_CUSTOMER_ORDERS_CURSOR_V1/);
    assert.match(pedidos, /Carregar pedidos anteriores/);
    assert.match(pedidos, /\.eq\("customer_user_id",user\.id\)/);
    assert.match(pedidos, /\.order\("id",\{ascending:false\}\)/);
    assert.match(pedidos, /\.or\(filter\)/);

    assert.match(editor, /APOIS_MERCHANT_PRODUCT_IMAGE_RECONCILIATION_V1/);
    assert.match(editor, /image\/jpeg/);
    assert.match(editor, /\.select\("id, image_url"\)/);
    assert.match(editor, /checked\.data\?\.image_url !== data\.publicUrl/);
    assert.match(editor, /Never blindly delete this new file/);

    assert.match(profileEditor, /APOIS_CUSTOMER_AVATAR_VERSIONED_V1/);
    assert.match(profileEditor, /\/customer-avatar\/\$\{Date\.now\(\)\}/);
    assert.match(profileEditor, /upsert: false/);
    assert.match(profileEditor, /checked\.data\?\.avatar_url !== avatarUrl/);
    assert.match(merchantRoute, /APOIS_MERCHANT_IMAGE_MIME_V1/);
    assert.doesNotMatch(merchantRoute, /accept="image\/\*"/);
    assert.match(merchantRoute, /accept="image\/jpeg,image\/png,image\/webp"/);
    assert.match(merchantRoute, /APOIS_MERCHANT_ASSET_RECONCILIATION_V1/);
    const assetHandler = merchantRoute.split('const uploadMerchantAsset = async')[1]?.split('const saveSettings = async')[0];
    assert.ok(assetHandler, 'merchant upload handler still present');
    assert.match(assetHandler, /\.select\("id, logo_url, cover_url"\)/);
    assert.match(assetHandler, /checked\.data\?\.\[field\] !== publicUrl/);
    assert.doesNotMatch(assetHandler, /\.remove\(/, 'do not delete asset on ambiguous update');

    const copies = new Map(paths.map(relative => [
      relative, readFileSync(resolve(workspace, relative), 'utf8'),
    ]));
    // Generators must be idempotent over their already-patched output.
    for (const script of scripts) runTransformer(script, workspace);
    for (const relative of paths) {
      assert.equal(readFileSync(resolve(workspace, relative), 'utf8'),
        copies.get(relative), 'non-idempotent transform: ' + relative);
      assert.equal(readFileSync(resolve(source, relative), 'utf8'),
        originals.get(relative), 'pinned source mutated: ' + relative);
    }
  } finally {
    rmSync(workspace, { recursive: true, force: true });
  }
});
