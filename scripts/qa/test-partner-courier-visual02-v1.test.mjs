import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const root = resolve(fileURLToPath(new URL("../..", import.meta.url)));
const script = resolve(root, "scripts/fix-partner-courier-visual02-v1.mjs");
const activePath = "src/components/CourierPremiumViews.tsx";
const offerPath = "src/components/CourierOfferOverlay.tsx";

const activeFixture = [
  "export function ActiveDelivery() {",
  "  // APOIS_COURIER_SIMPLE_FLOW_V1",
  "  return (",
  "    <section>",
  "      <button type=\"button\" onClick={() => void onTransition(\"picked_up\")}>",
  "          PEDIDO RETIRADO",
  "      </button>",
  "      <p>Código de entrega (PIN)</p>",
  "      <div className=\"mt-2 flex items-center justify-between\">",
  "        <button onClick={() => setShowDetails((value) => !value)}",
  "          className=\"text-xs font-bold text-[#4B5563] underline underline-offset-2\">Ver endereços</button>",
  "        <button onClick={() => void onReport()}",
  "          className=\"text-xs font-bold text-[#B91C32] underline underline-offset-2\">Ajuda / Problema</button>",
  "      </div>",
  "    </section>",
  "  );",
  "}",
  "export function CourierFinance() { return null; }",
].join("\n");

const offerFixture = [
  "export function CourierOfferOverlay() {",
  "  const alertTimerRef = useRef<number | null>(null);",
  "  const offerId = 'synthetic';",
  "  const enabled = true, courierId = 'synthetic', offer = {};",
  "  const remaining = 20;",
  "  const estimated_earnings = 0;",
  "  const stopAlert = () => {};",
  "  if (!enabled || !courierId || !offer) return null;",
  "  return (",
  "    <div className=\"fixed inset-x-0 top-0 bottom-[calc(4.75rem+env(safe-area-inset-bottom))] z-[1400] flex items-end justify-center bg-black/65 p-3 backdrop-blur-md\">",
  "      <section className=\"w-full max-w-[420px] overflow-hidden rounded-[1.6rem] border border-[#E5E7EB] bg-white text-[#111827] shadow-md\">",
  "        <div className=\"border-b border-[#E5E7EB] bg-[#FFF1F2] px-5 pb-4 pt-5\">",
  "          <p className=\"text-[10px] font-black uppercase tracking-[0.18em] text-accent\">Nova entrega</p>",
  "        </div>",
  "        <div className=\"max-h-[72dvh] space-y-4 overflow-y-auto p-5\">",
  "          <p>O endereço exato do cliente é liberado somente após o aceite.</p>",
  "          <div className=\"grid grid-cols-[0.82fr_1.18fr] gap-3 pt-1\">",
  "            <button onClick={() => void respond(\"reject\")}>Recusar</button>",
  "            <button onClick={() => void respond(\"accept\")}>Aceitar</button>",
  "          </div>",
  "        </div>",
  "      </section>",
  "    </div>",
  "  );",
  "}",
  "stopAlert();",
].join("\n");

const write = (base, relative, value) => {
  const path = join(base, relative);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, value);
};
const read = (base, relative) => readFileSync(join(base, relative), "utf8");

test("CV-009..012: visual overlay keeps contract, is idempotent, and fails closed on drift", () => {
  const temp = mkdtempSync(join(tmpdir(), "apois-cv02-"));
  const workspace = join(temp, ".work/partner-entregador");
  const run = () => spawnSync(process.execPath, [script], {
    cwd: temp, encoding: "utf8",
    env: { ...process.env, APOIS_ENTREGAS_WORKSPACE: workspace },
  });
  try {
    write(workspace, activePath, activeFixture);
    write(workspace, offerPath, offerFixture);
    let result = run();
    assert.equal(result.status, 0, result.stderr);
    const active = read(workspace, activePath);
    const offer = read(workspace, offerPath);
    assert.match(active, /Confirmar retirada/);
    assert.doesNotMatch(active, /PEDIDO RETIRADO/);
    assert.match(active, /onTransition\("picked_up"\)/);
    assert.match(active, /onClick=\{\(\) => void onReport\(\)\}/);
    assert.match(active, /onClick=\{\(\) => setShowDetails/);
    assert.equal((active.match(/min-h-11 items-center/g) || []).length, 2);
    assert.match(active, /flex-wrap/);
    assert.match(offer, /role="dialog" aria-modal="true"/);
    assert.match(offer, /aria-labelledby="apois-courier-offer-title"/);
    assert.match(offer, /offerDialogRef.current\?\.focus/);
    assert.match(offer, /previous\?\.isConnected/);
    assert.match(offer, /max-h-full/);
    assert.match(offer, /min-h-0 flex-1 space-y-4 overflow-y-auto/);
    assert.match(offer, /sticky bottom-0/);
    assert.match(offer, /respond\("accept"\)/);
    assert.match(offer, /respond\("reject"\)/);
    assert.match(offer, /O endereço exato do cliente é liberado somente após o aceite/);

    result = run();
    assert.equal(result.status, 0, result.stderr);
    assert.equal(read(workspace, activePath), active, "idempotent ActiveDelivery");
    assert.equal(read(workspace, offerPath), offer, "idempotent offer overlay");

    write(workspace, activePath, activeFixture.replace("          PEDIDO RETIRADO", "          TEXTO ALTERADO"));
    result = run();
    assert.notEqual(result.status, 0, "unexpected source must fail instead of silently rewriting");
    assert.equal(read(workspace, activePath), activeFixture.replace("          PEDIDO RETIRADO", "          TEXTO ALTERADO"));
  } finally {
    rmSync(temp, { recursive: true, force: true });
  }
});
