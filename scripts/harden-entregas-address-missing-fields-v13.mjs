// Keep the confirmed point while completing fields absent from the selected/loaded address.
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
const root = resolve(process.env.APOIS_ENTREGAS_WORKSPACE || '.work/entregas');
function replace(s, before, after, path) {
  if (s.includes(after)) return s;
  if (s.split(before).length !== 2) throw new Error(`Address missing fields V13: unexpected source ${path}`);
  return s.replace(before, after);
}
for (const [path,param,anchor] of [
  ['src/routes/enderecos/novo.tsx','address','  const [autoLocate, setAutoLocate] = useState(false);'],
  ['src/routes/enderecos/editar/$addressId.tsx','addr','  const [isSaving, setIsSaving] = useState(false);'],
]) {
  const file = resolve(root,path);
  let s = readFileSync(file,'utf8');
  if (param === 'addr') s = replace(s,'import { useEffect, useState } from "react";', 'import { useEffect, useRef, useState } from "react";',path);
  s = replace(s,anchor,anchor+'\n  const missingLocationFieldsRef = useRef(new Set<string>()); // APOIS_ADDRESS_MISSING_FIELDS_V13',path);
  s = replace(s,
    'const isCompletingMissingField = locationFields.has(name) && previousValue.length === 0;',
    'const isCompletingMissingField = locationFields.has(name) && (previousValue.length === 0 || missingLocationFieldsRef.current.has(name));',path);
  const marker = `onAddressSelected={(${param}) => {`;
  s = replace(s,marker,marker+`\n              missingLocationFieldsRef.current = new Set(\n                ["postal_code", "street", "number", "neighborhood", "city", "state"].filter(\n                  (field) => !String(${param}[field as keyof typeof ${param}] ?? "").trim(),\n                ),\n              );`,path);
  if (param === 'address') {
    s = replace(s,'        ? changedRealUf','        ? changedRealUf && !isCompletingMissingField',path);
  } else {
    s = replace(s,
      '      } else {\n        setFormData({\n          label: data.label,',
      '      } else {\n        missingLocationFieldsRef.current = new Set(\n          ["postal_code", "street", "number", "neighborhood", "city", "state"].filter(\n            (field) => !String(data[field] ?? "").trim(),\n          ),\n        );\n        setFormData({\n          label: data.label,',path);
  }
  writeFileSync(file,s);
}
console.log('[OK] Customer missing fields V13: multi-character completion preserves GPS; changing identified fields still invalidates it.');
