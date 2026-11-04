import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
const file = (path) => resolve(root, '.work/corridas', path);
const read = (path) => {
  const full = file(path);
  if (!existsSync(full)) throw new Error(`[FAIL] Corridas pickup: arquivo ausente ${path}`);
  return readFileSync(full, 'utf8');
};
const write = (path, content) => writeFileSync(file(path), content, 'utf8');

const hookPath = 'src/hooks/use-pickup-address.tsx';
let hook = read(hookPath);

const oldImport = 'import { getReverseGeocoding } from "@/lib/geocoding";';
const newImport = 'import { supabase } from "@/integrations/supabase/client";';
if (hook.includes(oldImport)) hook = hook.replace(oldImport, newImport);
if (!hook.includes(newImport)) throw new Error('[FAIL] Corridas pickup: cliente Supabase não foi ligado ao hook');

const oldBlock = `      const formattedAddress = await getReverseGeocoding(location);

      if (import.meta.env.DEV) {
        console.log(\`[usePickupAddress] Geocoding success\`);
      }

      setAddress(formattedAddress);

      // Basic parsing for label/short label
      const parts = formattedAddress.split(",");
      if (parts.length > 0) {
        setPickupShortLabel(parts[0]?.trim() || "Localização atual");
        setPickupLabel(parts.slice(0, 2).join(", ").trim() || "Minha Localização");
      } else {
        setPickupLabel("Minha Localização");
        setPickupShortLabel("Localização atual");
      }
      setStatus("success");`;

const newBlock = "      const { data: reverse, error: reverseError } = await supabase.functions.invoke(\n        \"google-maps-address\",\n        {\n          body: {\n            action: \"reverse_geocode\",\n            lat: location.latitude,\n            lng: location.longitude,\n          },\n        },\n      );\n      if (reverseError) throw reverseError;\n\n      const firstResult =\n        reverse && typeof reverse === \"object\" && Array.isArray((reverse as { results?: unknown[] }).results)\n          ? (reverse as { results: Array<{ formatted_address?: unknown; address_components?: Array<{ long_name?: unknown; types?: unknown[] }> }> }).results[0]\n          : undefined;\n\n      const exactAddress =\n        typeof firstResult?.formatted_address === \"string\"\n          ? firstResult.formatted_address.trim()\n          : \"\";\n\n      if (!exactAddress) throw new Error(\"Endereço atual não identificado\");\n\n      const routeComponent = firstResult?.address_components?.find(\n        (component) => Array.isArray(component.types) && component.types.includes(\"route\"),\n      );\n      const numberComponent = firstResult?.address_components?.find(\n        (component) => Array.isArray(component.types) && component.types.includes(\"street_number\"),\n      );\n      const routeName = typeof routeComponent?.long_name === \"string\" ? routeComponent.long_name.trim() : \"\";\n      const number = typeof numberComponent?.long_name === \"string\" ? numberComponent.long_name.trim() : \"\";\n      const exactShortLabel = routeName\n        ? routeName + (number ? \", \" + number : \"\")\n        : exactAddress.split(\",\")[0]?.trim() || exactAddress;\n\n      if (import.meta.env.DEV) {\n        console.log(\"[usePickupAddress] Reverse geocoding success\", exactAddress);\n      }\n\n      setAddress(exactAddress);\n      setPickupShortLabel(exactShortLabel);\n      setPickupLabel(exactAddress);\n      setStatus(\"success\");";

if (!hook.includes(oldBlock) && !hook.includes('const exactAddress = (resolved.address || resolved.label || "").trim();')) {
  throw new Error('[FAIL] Corridas pickup: bloco legado de reverse geocoding não encontrado');
}
if (hook.includes(oldBlock)) hook = hook.replace(oldBlock, newBlock);

const failingReverse = '      if (reverseError) throw reverseError;';
const reportedReverse = `      // APOIS_PICKUP_REVERSE_DIAGNOSTIC_V1: do not treat API outage as GPS failure.
      if (reverseError) {
        const status = (reverseError as { context?: { status?: number } }).context?.status;
        if (status === 429) throw new Error("Limite de consultas atingido. Aguarde um minuto.");
        if (status === 401 || status === 403) throw new Error("Não foi possível autenticar a consulta de endereço.");
        if (typeof status === "number" && status >= 500) {
          throw new Error("Serviço de endereços temporariamente indisponível.");
        }
        throw new Error("Não foi possível consultar o endereço. Verifique sua conexão.");
      }`;
if (!hook.includes(failingReverse)) throw new Error('[FAIL] Corridas pickup: HTTP error mapping drift');
hook = hook.replace(failingReverse, reportedReverse);
const errorClear = '      setAddress(null);';
if (!hook.includes(errorClear)) throw new Error('[FAIL] Corridas pickup: catch cleanup drift');
hook = hook.replace(errorClear, errorClear + '\n      setPickupLabel(null);\n      setPickupShortLabel(null);');


hook = hook
  .replace('setAddress(null); // Clear address on real error', 'setAddress(null);')
  .replace('if (!location || !location.latitude || !location.longitude) return;', 'if (!location || !Number.isFinite(location.latitude) || !Number.isFinite(location.longitude)) return;');

write(hookPath, hook);

const homePath = 'src/routes/_authenticated.inicio.tsx';
let home = read(homePath);

home = home.replace(
  'const { address, status: addressStatus, isLoading: isGeocoding } = usePickupAddress();',
  'const { address, pickupLabel, pickupShortLabel, status: addressStatus, isLoading: isGeocoding, error: pickupAddressError, refreshAddress } = usePickupAddress();',
);

const replaceCurrentAddressDeclaration = (source, replacement) => {
  const start = source.indexOf('  const currentAddressText =');
  if (start < 0) throw new Error('[FAIL] Corridas pickup: declaração currentAddressText não encontrada');

  // The pinned snapshot can contain this declaration already truncated inside
  // a quoted fallback. Locate the next real top-level statement by scanning
  // physical lines, instead of depending on ';' or on a specific function name.
  const tail = source.slice(start);
  const lines = tail.split('\n');
  let consumed = lines[0].length;
  let boundary = -1;

  for (let i = 1; i < lines.length; i += 1) {
    consumed += 1; // newline before this line
    const lineStart = start + consumed;
    const line = lines[i];
    if (/^  (?:const|let|function|return)\b/.test(line)) {
      boundary = lineStart;
      break;
    }
    consumed += line.length;
  }

  if (boundary < 0) throw new Error('[FAIL] Corridas pickup: limite estrutural após currentAddressText não encontrado');
  return source.slice(0, start) + replacement.trimEnd() + '\n' + source.slice(boundary);
};
const currentAddressLine = `  const currentAddressText =
    addressStatus === "identifying" || isGeocoding
      ? "Identificando seu endereço..."
      : address ||
        pickupLabel ||
        pickupShortLabel ||
        (pickupAddressError
          ? "Endereço indisponível"
          : "Identificando seu endereço...");
`;

home = replaceCurrentAddressDeclaration(home, currentAddressLine);

// On failure, the origin row must RETRY geocoding, not navigate to destination.
// The original source mistakenly showed "Toque..." but always opened destination.
const originalOriginClick = 'onClick={() => navigate({ to: "/buscar-destino", search: { stop: false } })}';
const homeAddressIndex = home.indexOf('{currentAddressText}');
const originClickIndex = home.lastIndexOf(originalOriginClick, homeAddressIndex);
if (homeAddressIndex < 0 || originClickIndex < 0 || homeAddressIndex-originClickIndex > 1200) {
  throw new Error('[FAIL] Corridas pickup: origin click/label structure changed');
}
const retryOriginClick = `onClick={() => {
                if (addressStatus === "error") { void refreshAddress(); return; }
                navigate({ to: "/buscar-destino", search: { stop: false } });
              }}`;
home = home.slice(0, originClickIndex) + retryOriginClick + home.slice(originClickIndex + originalOriginClick.length);
const pickupLabelNode = /(\{currentAddressText\}\s*<\/p>)/;
if (!pickupLabelNode.test(home)) throw new Error('[FAIL] Corridas pickup: label JSX node changed');
home = home.replace(pickupLabelNode, `$1
                  {addressStatus === "error" && (
                    <p data-apois-pickup-retry-v1="true" className="mt-1 text-xs font-medium text-[#586272]">
                      Toque para tentar novamente
                    </p>
                  )}`);


home = home.replace(
  'onClick={() => refreshLocation()}',
  'onClick={() => { refreshLocation(); void refreshAddress(); }}',
);

write(homePath, home);

for (const marker of [
  '"google-maps-address"',
  'action: "reverse_geocode"',
  'setPickupShortLabel(exactShortLabel)',
  'APOIS_PICKUP_REVERSE_DIAGNOSTIC_V1',
  'setPickupLabel(null)',
  'setPickupShortLabel(null)',
]) {
  if (!read(hookPath).includes(marker)) throw new Error(`[FAIL] Corridas pickup: marcador ausente no hook (${marker})`);
}
for (const marker of [
  'pickupLabel ||',
  'pickupShortLabel ||',
  'Identificando seu endereço...',
  'Endereço indisponível',
  'Toque para tentar novamente',
  'data-apois-pickup-retry-v1',
]) {
  if (!read(homePath).includes(marker)) throw new Error(`[FAIL] Corridas pickup: marcador ausente na Home (${marker})`);
}
if (read(homePath).includes('address || "Sua localização atual"')) {
  throw new Error('[FAIL] Corridas pickup: Home ainda usa fallback genérico "Sua localização atual"');
}

console.log('[OK] Corridas: Local de partida exibe endereço reverso real da posição GPS, sem fallback genérico');
