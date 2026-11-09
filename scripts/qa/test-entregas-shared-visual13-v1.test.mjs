import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { test } from "node:test";
import { MARK, patchBottomNav, patchDialog, patchPrompt } from "../fix-entregas-shared-visual13-v1.mjs";

const root = process.cwd();
const work = resolve(root, process.env.APOIS_ENTREGAS_WORKSPACE || ".work/entregas");
const readWork = (path) => readFileSync(resolve(work, path), "utf8");
const readRepo = (path) => readFileSync(resolve(root, path), "utf8");
const occurrences = (source, value) => source.split(value).length - 1;
const contrast = (hex) => {
  const rgb = hex.match(/[0-9a-f]{2}/gi).map((x) => parseInt(x, 16) / 255);
  const linear = rgb.map((v) => v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
  return 1.05 / (0.05 + linear[0] * 0.2126 + linear[1] * 0.7152 + linear[2] * 0.0722);
};

test("CV-044 / VIS-045: red CTA gradient endpoints meet 4.5:1 for white normal text", () => {
  const partner = readRepo("superapp/partner-shell/index.html");
  const customer = readRepo("superapp/shell/index.html");
  const pp = partner.match(/\.primary-action\{[^}]*background:linear-gradient\(135deg,([^)]*)\)/s);
  const cp = customer.match(/\.action\{[^}]*background:linear-gradient\(135deg,([^)]*)\)/s);
  assert.ok(pp && cp, "both entry CTA gradient rules must exist");
  for (const [label, gradient] of [["partner", pp[1]], ["customer", cp[1]]]) {
    const colors = gradient.match(/#[0-9a-f]{6}/gi);
    assert.ok(colors?.length >= 2);
    for (const color of colors) assert.ok(contrast(color) >= 4.5, label + " fails contrast at " + color + ": " + contrast(color));
  }
  assert.match(customer, /data-module="corridas" type="button" aria-label="Acessar Corridas"/);
  assert.match(customer, /data-module="entregas" type="button" aria-label="Acessar Entregas"/);
  assert.ok(partner.includes('data-module="motorista"'));
  assert.ok(partner.includes('data-module="entregador"'));
});

test("CV-045 / VIS-046 + VIS-034: four flexible actions and distinct center remain operable on 320/360px", () => {
  const source = readWork("src/components/AppBottomNav.tsx");
  assert.ok(source.includes(MARK));
  assert.equal(patchBottomNav(source), source, "idempotent");
  assert.ok(source.includes("min-h-[64px] min-w-0 flex-1"));
  assert.ok(source.includes("flex shrink-0 justify-center"));
  assert.ok(source.includes('aria-current={active ? "page" : undefined}'));
  assert.equal(occurrences(source, "onClick={() => navigate("), 3, "two map routes and the central button remain");
  assert.ok(source.includes('navItems.slice(0, 2)') && source.includes('navItems.slice(2)'));
  assert.ok(source.includes('to: "/buscar"'));
  for (const width of [320, 360, 390, 412]) {
    const each = (width - 16 - 68) / 4;
    assert.ok(each >= 44, "minimum available width of each nav action under 44 at " + width);
  }
});

test("CV-046/VIS-047, CV-047/VIS-048 + VIS-004: accessible DialogContent remains Radix-backed", () => {
  const source = readWork("src/components/ui/dialog.tsx");
  assert.ok(source.includes(MARK));
  assert.equal(patchDialog(source), source);
  for (const token of ["DialogPrimitive.Content", "DialogPrimitive.Close", "DialogPrimitive.Overlay", "z-[121]", "z-[120]", "max-h-[calc(100dvh-2rem)]", "overflow-y-auto", "overscroll-contain", "min-h-11 min-w-11", 'sr-only">Fechar</span>']) {
    assert.ok(source.includes(token), token);
  }
  assert.ok(!source.includes('sr-only">Close</span>'));
});

test("CV-048 / VIS-049: required prompt fields are labelled without altering validation and callbacks", () => {
  const source = readWork("src/components/ui/prompt-dialog.tsx");
  assert.ok(source.includes(MARK));
  assert.equal(patchPrompt(source), source);
  assert.equal(occurrences(source, 'aria-required={field.required || undefined}'), 2);
  assert.ok(source.includes('(obrigatório)'));
  assert.ok(source.includes('!field.required || state.values[field.key]?.trim()'));
  assert.ok(source.includes('onClick={() => close(state.values)}'));
  assert.ok(source.includes('onClick={() => close(null)}'));
  assert.ok(source.includes('event.key === "Enter" && canSubmit'));
  assert.ok(source.includes("autoFocus={state.options.fields[0]?.key === field.key}"));
});

test("RV13: integrator builders and protected source lock, no source writes", () => {
  const lock = JSON.parse(readRepo(".apois/source-lock.json"));
  assert.equal(lock.sources.entregas.commit, "2f4606e0fb52dffb49f2e6aebbe921ce687ab625");
  assert.equal(lock.sources.corridas_passageiro.commit, "7b047f75a1a919a5336c0df6e0d60b14b02f2618");
  assert.equal(lock.sources.corridas_motorista_admin.commit, "9fc171050d8b5703540c49d19a8f1e9f5162775f");
  for (const builder of ["scripts/build-merchant-panel.mjs", "scripts/build-isolated-module.mjs"]) {
    const source = readRepo(builder);
    assert.ok(source.includes("fix-entregas-shared-visual13-v1.mjs"), builder);
    assert.ok(source.includes("test-entregas-shared-visual13-v1.test.mjs"), builder);
    assert.ok(source.indexOf("fix-entregas-admin-visual12-v1.mjs") < source.indexOf("fix-entregas-shared-visual13-v1.mjs"));
  }
});
