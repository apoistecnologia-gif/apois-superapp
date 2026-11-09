// RV-13: targeted, reversible presentation-only patches on .work/entregas.
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const MARK = "APOIS_CV13_SHARED_COMPONENTS_V1";
const workspace = () => resolve(process.env.APOIS_ENTREGAS_WORKSPACE || ".work/entregas");
function once(source, before, after, where) {
  const count = source.split(before).length - 1;
  if (count !== 1) throw Error("[RV13] " + where + " anchor count=" + count);
  return source.replace(before, after);
}
function completed(source, requirements, name) {
  for (const required of requirements) {
    if (!source.includes(required)) throw Error("[RV13] incomplete " + name + ": " + required);
  }
  return source;
}
export function patchBottomNav(source) {
  const requirements = ['aria-current={active ? "page" : undefined}', "min-w-0 flex-1 sm:min-w-[72px]", "flex shrink-0 justify-center", 'data-apois-entregas-customer-nav-v5'];
  if (source.includes(MARK)) return completed(source, requirements, "AppBottomNav");
  completed(source, ['data-apois-entregas-customer-nav-v5', 'min-w-[72px]', 'h-[68px] w-[68px]'], "AppBottomNav source");
  let next = once(source,
    'className="flex min-h-[64px] min-w-[72px] flex-col items-center justify-center gap-1 px-1 transition-all active:scale-95"',
    'className="flex min-h-[64px] min-w-0 flex-1 flex-col items-center justify-center gap-1 px-1 transition-all active:scale-95 sm:min-w-[72px]"',
    "four flex nav buttons");
  next = once(next, 'className="-mt-6 flex justify-center pb-1"', 'className="-mt-6 flex shrink-0 justify-center pb-1"', "center action");
  next = once(next, 'onClick={onClick}\n      className="flex min-h-[64px]', 'onClick={onClick}\n      aria-current={active ? "page" : undefined}\n      className="flex min-h-[64px]', "active page semantic");
  return completed('// ' + MARK + '\n' + next, requirements, "AppBottomNav result");
}
export function patchDialog(source) {
  const requirements = ["max-h-[calc(100dvh-2rem)]", "overflow-y-auto", "overscroll-contain", 'sr-only">Fechar</span>', "min-h-11 min-w-11"];
  if (source.includes(MARK)) return completed(source, requirements, "DialogContent");
  completed(source, ["DialogPrimitive.Content", "z-[121]", 'sr-only">Close</span>'], "DialogContent source");
  let next = once(source,
    "gap-4 border bg-background p-6 shadow-lg duration-200",
    "gap-4 max-h-[calc(100dvh-2rem)] overflow-y-auto overscroll-contain border bg-background p-6 shadow-lg duration-200",
    "dialog scroll and height");
  next = once(next,
    'className="absolute right-4 top-4 rounded-sm opacity-70',
    'className="absolute right-2 top-2 flex min-h-11 min-w-11 items-center justify-center rounded-sm opacity-70',
    "close touch target");
  next = once(next, '<span className="sr-only">Close</span>', '<span className="sr-only">Fechar</span>', "portuguese close");
  return completed('// ' + MARK + '\n' + next, requirements, "DialogContent result");
}
export function patchPrompt(source) {
  const requirements = ['aria-required={field.required || undefined}', '(obrigatório)', "field.required && !/obrigat"];
  if (source.includes(MARK)) return completed(source, requirements, "PromptDialog");
  completed(source, ["const canSubmit = state", "field.required", "autoFocus=", 'htmlFor={`prompt-${field.key}`}'], "PromptDialog source");
  let next = once(source,
    '                {field.label}\n              </label>',
    '                {field.label}\n                {field.required && !/obrigat[oó]ri[oa]|\\*/i.test(field.label) ? (\n                  <span className="ml-1 text-xs text-muted-foreground">(obrigatório)</span>\n                ) : null}\n              </label>',
    "visible required indicator");
  const anchor = 'id={`prompt-${field.key}`}';
  if (next.split(anchor).length - 1 !== 2) throw Error("[RV13] expected two prompt input IDs");
  next = next.replaceAll(anchor, anchor + '\n                  aria-required={field.required || undefined}');
  return completed('// ' + MARK + '\n' + next, requirements, "PromptDialog result");
}

export function applyVisual13Shared(root = workspace()) {
  const patches = [
    ["src/components/AppBottomNav.tsx", patchBottomNav],
    ["src/components/ui/dialog.tsx", patchDialog],
    ["src/components/ui/prompt-dialog.tsx", patchPrompt],
  ];
  // Plan all transforms before any file write: drift is a hard failure.
  const plans = patches.map(([relative, patch]) => {
    const path = resolve(root, relative);
    const before = readFileSync(path, "utf8");
    const after = patch(before);
    if (patch(after) !== after) throw Error("[RV13] non-idempotent: " + relative);
    return { relative, path, before, after };
  });
  for (const plan of plans) if (plan.before !== plan.after) writeFileSync(plan.path, plan.after, "utf8");
  return plans.map(({ relative, before, after }) => ({ file: relative, changed: before !== after }));
}
if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  console.log("[OK] RV13 shared components", JSON.stringify(applyVisual13Shared()));
}
