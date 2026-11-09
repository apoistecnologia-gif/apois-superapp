import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
import { patchProductCustomization, MARK } from "../fix-entregas-product-customization-visual10-v1.mjs";

const root=resolve(fileURLToPath(new URL("../..", import.meta.url)));
const read=path=>readFileSync(resolve(root,path),"utf8");
const target="src/components/ProductCustomizationSheet.tsx";

// Mirror only the layout transforms from the current image-fallback and overlay scripts.
function fixture() {
  let s=read("sources/apois-entregas/"+target);
  assert.match(s,/const handleToggleOption = /);
  s=s.replace(
    'className="absolute bottom-0 left-0 right-0 bg-zinc-950 border-t border-zinc-900 p-4 pt-6 flex flex-row items-center gap-4 sm:justify-between"',
    'className="absolute bottom-0 left-0 right-0 bg-zinc-950 border-t border-zinc-900 px-4 pt-6 pb-[max(env(safe-area-inset-bottom),1.25rem)] flex flex-row items-center gap-4 sm:justify-between"');
  s=s.replace(
    'className="h-[90vh] bg-zinc-950 border-zinc-800 p-0 rounded-t-[32px] overflow-hidden flex flex-col focus:outline-none"',
    'className="flex h-[90dvh] max-h-[calc(100dvh-max(env(safe-area-inset-top),12px))] flex-col overflow-hidden rounded-t-[32px] border-zinc-800 bg-zinc-950 p-0 focus:outline-none"');
  s=s.replace('pb-[max(env(safe-area-inset-bottom),1.25rem)]',
    'pb-[max(52px,env(safe-area-inset-bottom))]');
  assert.match(s,/h-\[90dvh\]/);
  assert.match(s,/pb-\[max\(52px,env\(safe-area-inset-bottom\)\)\]/);
  return s;
}
function slice(source,start,end) {
  const a=source.indexOf(start),b=source.indexOf(end,a+start.length);
  assert.ok(a>=0&&b>a,"missing protected "+start);
  return source.slice(a,b);
}
function toggleHarness(source) {
  const block=slice(source,
    "  const handleToggleOption = (groupId: string, optionId: string, maxSelections: number | null) => {",
    "\n\n  const getGroupStatus =");
  const js=block.replace("(groupId: string, optionId: string, maxSelections: number | null)",
    "(groupId, optionId, maxSelections)");
  let selections={};
  const setSelections=updater=>{selections=updater(selections);};
  const toggle=new Function("setSelections",js+"\nreturn handleToggleOption;")(setSelections);
  return {toggle, get:()=>selections};
}

test("CV-029 accessible native buttons report selected/disabled and group instructions",()=>{
  const before=fixture(),after=patchProductCustomization(before);
  assert.equal(patchProductCustomization(after),after);
  assert.ok(after.includes(MARK));
  for(const token of [
    'data-apois-cv10-option-accessibility="'+MARK+'"',
    'type="button"','disabled={isDisabled}','aria-pressed={isSelected}',
    'aria-describedby={','apois-product-group-hint-',
    'role="group"','aria-labelledby={','apois-product-group-heading-',
    'focus-visible:outline-primary','min-h-11 w-full',
    '<Check className="h-4 w-4 stroke-[3]" />',
  ]) assert.ok(after.includes(token),"missing "+token);
  assert.equal((after.match(/handleToggleOption\(group.id, option.id, group.max_selections\)/g)||[]).length,1);
  assert.ok(after.includes('                        </button>\n                      );'));
});

test("CV-029 exact handler, validation, total/extra price and confirmation unchanged",()=>{
  const before=fixture(),after=patchProductCustomization(before);
  for(const [start,end] of [
    ["  const handleToggleOption = ","\n\n  const getGroupStatus ="],
    ["  const getGroupStatus = ","\n\n  const isGroupValid ="],
    ["  const isGroupValid = ","\n\n  const isAllValid ="],
    ["  const totalPrice = useMemo(","\n\n  const handleConfirm ="],
    ["  const handleConfirm = ","\n\n  return ("],
  ]) assert.equal(slice(after,start,end),slice(before,start,end),start);
  assert.ok(after.includes("onConfirm(formattedOptions)"));
  assert.ok(after.includes("disabled={!isAllValid}"));
  assert.ok(after.includes("Number(opt.price_delta)"));
});

test("CV-029 unique choice replacement and multiple choice cap / deselect remain",()=>{
  const source=patchProductCustomization(fixture());
  const single=toggleHarness(source);
  single.toggle("g","one",1);
  assert.deepEqual(single.get().g,["one"]);
  single.toggle("g","two",1);
  assert.deepEqual(single.get().g,["two"]);
  single.toggle("g","two",1);
  assert.deepEqual(single.get().g,[]);
  const multiple=toggleHarness(source);
  multiple.toggle("g","one",2);
  multiple.toggle("g","two",2);
  multiple.toggle("g","three",2);
  assert.deepEqual(multiple.get().g,["one","two"]);
  multiple.toggle("g","one",2);
  assert.deepEqual(multiple.get().g,["two"]);
});

test("CV-030 pinned database contract cannot store a null maximum; no status rewrite",()=>{
  const sql=read("sources/apois-entregas/supabase/migrations/20260807231500_create_product_options.sql");
  const types=read("sources/apois-entregas/src/integrations/supabase/types.ts");
  const editor=read("sources/apois-entregas/src/components/MerchantProductEditor.tsx");
  assert.match(sql,/min_selections integer NOT NULL DEFAULT 0/);
  assert.match(sql,/max_selections integer NOT NULL DEFAULT 1/);
  assert.match(sql,/product_option_groups_selection_logic_check CHECK \(max_selections >= min_selections\)/);
  assert.match(types,/max_selections: number;/);
  assert.match(editor,/!Number\.isInteger\(min\) \|\| !Number\.isInteger\(max\)/);
  assert.match(editor,/min > max/);
  const before=fixture(),after=patchProductCustomization(before);
  assert.equal(slice(after,"  const getGroupStatus = ","\n\n  const isGroupValid ="),
    slice(before,"  const getGroupStatus = ","\n\n  const isGroupValid ="));
  // No claims about the live production schema or current catalog are made here.
});

test("RV-10 overlay guarded, idempotent, ordered in both customer and merchant builds",()=>{
  assert.throws(()=>patchProductCustomization("unknown version"),/source drift/);
  assert.throws(()=>patchProductCustomization(MARK),/partially transformed/);
  assert.throws(()=>patchProductCustomization(fixture().replace(
    "handleToggleOption(group.id, option.id, group.max_selections)","changed handler"
  )),/source drift/);
  const customer=read("scripts/build-isolated-module.mjs");
  const merchant=read("scripts/build-merchant-panel.mjs");
  const patch="fix-entregas-product-customization-visual10-v1.mjs";
  assert.ok(customer.indexOf("fix-entregas-order-timeline-visual05-v1.mjs")<customer.indexOf(patch));
  assert.ok(customer.indexOf(patch)<customer.indexOf("['run', 'typecheck']"));
  assert.ok(merchant.indexOf("'harden-entregas-overlay-layering.mjs'")<merchant.indexOf(patch));
  assert.ok(merchant.indexOf(patch)<merchant.indexOf("['run', 'typecheck']"));
  assert.equal(JSON.parse(read(".apois/source-lock.json")).sources.entregas.commit,
    "2f4606e0fb52dffb49f2e6aebbe921ce687ab625");
});
