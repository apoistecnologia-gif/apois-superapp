// RV-10 / CV-029: only semantic accessibility in the Entregas product sheet.
// CV-030 / VIS-031 is not applicable to the pinned max_selections NOT NULL contract.
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const MARK = "APOIS_CV10_PRODUCT_CUSTOMIZATION_ACCESSIBILITY_V1";
const COMPONENT = "src/components/ProductCustomizationSheet.tsx";

function one(before, find, substitute, label) {
  const count = before.split(find).length - 1;
  if (count !== 1) throw new Error("[CV10] " + label + " anchor count " + count);
  return before.replace(find, substitute);
}

export function patchProductCustomization(source) {
  if (source.includes(MARK)) {
    for (const required of [
      'aria-pressed={isSelected}',
      'disabled={isDisabled}',
      'role="group"',
      'handleToggleOption(group.id, option.id, group.max_selections)',
      'h-[90dvh]',
    ]) {
      if (!source.includes(required)) throw new Error("[CV10] partially transformed product sheet: " + required);
    }
    return source;
  }
  for (const required of [
    'const handleToggleOption = (groupId: string, optionId: string, maxSelections: number | null) => {',
    'const getGroupStatus = (group: OptionGroup) => {',
    'const isGroupValid = (group: OptionGroup) => {',
    'handleToggleOption(group.id, option.id, group.max_selections)',
    'h-[90dvh]',
    'pb-[max(52px,env(safe-area-inset-bottom))]',
  ]) {
    if (!source.includes(required)) throw new Error("[CV10] source drift: " + required);
  }
  let next = source;
  next = one(next,
    '<h3 className="text-white font-bold text-sm">{group.name}</h3>',
    '<h3 id={\`apois-product-group-heading-\${group.id}\`} className="text-white font-bold text-sm">{group.name}</h3>',
    "group accessible name");
  next = one(next,
    '<p className="text-[10px] text-zinc-500 uppercase tracking-wider">',
    '<p id={\`apois-product-group-hint-\${group.id}\`} className="text-[10px] text-zinc-500 uppercase tracking-wider">',
    "group selection guidance");
  next = one(next,
    '<div className="px-4 space-y-1">\n                  {options',
    '<div role="group" aria-labelledby={\`apois-product-group-heading-\${group.id}\`} className="px-4 space-y-1">\n                  {options',
    "semantic option group");
  const opening = [
    "                        <div",
    "                          key={option.id}",
    "                          onClick={() =>",
    "                            !isDisabled &&",
    "                            handleToggleOption(group.id, option.id, group.max_selections)",
    "                          }",
    '                          className={\`flex items-center justify-between py-4 border-b border-zinc-900 last:border-0 transition-opacity \${isDisabled ? "opacity-40 cursor-not-allowed" : "cursor-pointer active:opacity-70"}\`}',
    "                        >",
  ].join("\n");
  const replacement = [
    "                        <button // " + MARK,
    '                          type="button"',
    "                          key={option.id}",
    "                          disabled={isDisabled}",
    "                          aria-pressed={isSelected}",
    "                          aria-describedby={\`apois-product-group-hint-\${group.id}\`}",
    "                          onClick={() =>",
    "                            !isDisabled &&",
    "                            handleToggleOption(group.id, option.id, group.max_selections)",
    "                          }",
    '                          className={\`flex min-h-11 w-full items-center justify-between border-b border-zinc-900 py-4 text-left transition-opacity last:border-0 focus-visible:rounded-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary \${isDisabled ? "cursor-not-allowed opacity-40" : "cursor-pointer active:opacity-70"}\`}',
    "                        >",
  ].join("\n");
  // JSX comments within opening tag must be a valid attribute position: marker is an attribute instead.
  const jsxOpening = replacement.replace("                        <button // " + MARK,
    '                        <button data-apois-cv10-option-accessibility="' + MARK + '"');
  next = one(next, opening, jsxOpening, "native button with aria pressed");
  next = one(next,
    [
      "                            {isSelected && <Check className=\"h-4 w-4 stroke-[3]\" />}",
      "                          </div>",
      "                        </div>",
      "                      );",
    ].join("\n"),
    [
      "                            {isSelected && <Check className=\"h-4 w-4 stroke-[3]\" />}",
      "                          </div>",
      "                        </button>",
      "                      );",
    ].join("\n"),
    "close the option button");
  if (!next.includes('data-apois-cv10-option-accessibility="' + MARK + '"') ||
      !next.includes('aria-pressed={isSelected}')) throw new Error("[CV10] not committed in DOM");
  return next;
}

export function applyVisual10(root = process.cwd()) {
  const workspace = resolve(root, process.env.APOIS_ENTREGAS_WORKSPACE || ".work/entregas");
  const path = resolve(workspace, COMPONENT);
  const before = readFileSync(path, "utf8");
  const after = patchProductCustomization(before);
  if (before !== after) writeFileSync(path, after, "utf8");
  return { path, changed: before !== after };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  const result = applyVisual10();
  console.log("[OK] RV-10 CV-029: product options " + (result.changed ? "semantically accessible" : "already patched"));
}
