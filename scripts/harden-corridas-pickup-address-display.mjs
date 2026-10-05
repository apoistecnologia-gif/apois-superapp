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

const newBlock = `      const { data: reverse, error: reverseError } = await supabase.functions.invoke(
        \"google-maps-address\",
        {
          body: {
            action: \"reverse_geocode\",
            lat: location.latitude,
            lng: location.longitude,
          },
        },
      );
      if (reverseError) throw reverseError;

      const firstResult =
        reverse && typeof reverse === \"object\" && Array.isArray((reverse as { results?: unknown[] }).results)
          ? (reverse as { results: Array<{ formatted_address?: unknown; address_components?: Array<{ long_name?: unknown; types?: unknown[] }> }> }).results[0]
          : undefined;

      const exactAddress =
        typeof firstResult?.formatted_address === \"string\"
          ? firstResult.formatted_address.trim()
          : \"\";

      if (!exactAddress) throw new Error(\"Endereço atual não identificado\");

      const routeComponent = firstResult?.address_components?.find(
        (component) => Array.isArray(component.types) && component.types.includes(\"route\"),
      );
      const numberComponent = firstResult?.address_components?.find(
        (component) => Array.isArray(component.types) && component.types.includes(\"street_number\"),
      );
      const routeName = typeof routeComponent?.long_name === \"string\" ? routeComponent.long_name.trim() : \"\";
      const number = typeof numberComponent?.long_name === \"string\" ? numberComponent.long_name.trim() : \"\";
      const exactShortLabel = routeName
        ? routeName + (number ? \", \" + number : \"\")
        : exactAddress.split(\",\")[0]?.trim() || exactAddress;

      if (import.meta.env.DEV) {
        console.log(\"[usePickupAddress] Reverse geocoding success\", exactAddress);
      }

      setAddress(exactAddress);
      setPickupShortLabel(exactShortLabel);
      setPickupLabel(exactAddress);
      setStatus(\"success\");`;

if (!hook.includes(oldBlock) && !hook.includes('const exactAddress = (resolved.address || resolved.label || "").trim();')) {
  throw new Error('[FAIL] Corridas pickup: bloco legado de reverse geocoding não encontrado');
}
if (hook.includes(oldBlock)) hook = hook.replace(oldBlock, newBlock);

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

const oldCurrent = `  const currentAddressText = addressStatus === "identifying" || isGeocoding
    ? "Buscando localização..." 
    : address || "Sua localização atual";`;

const newCurrent = `  const currentAddressText =
    addressStatus === "identifying" || isGeocoding
      ? "Identificando seu endereço..."
      : address || pickupLabel || pickupShortLabel || (pickupAddressError ? "Toque para tentar identificar o endereço" : "Identificando seu endereço...");`;

if (!home.includes(oldCurrent) && !home.includes('pickupAddressError ? "Toque para tentar identificar o endereço"')) {
  throw new Error('[FAIL] Corridas pickup: fallback visual legado não encontrado');
}
if (home.includes(oldCurrent)) home = home.replace(oldCurrent, newCurrent);

home = home.replace(
  'onClick={() => refreshLocation()}',
  'onClick={() => { refreshLocation(); void refreshAddress(); }}',
);

write(homePath, home);

for (const marker of [
  '"google-maps-address"',
  'action: "reverse_geocode"',
  'setPickupShortLabel(exactShortLabel)',
]) {
  if (!read(hookPath).includes(marker)) throw new Error(`[FAIL] Corridas pickup: marcador ausente no hook (${marker})`);
}
for (const marker of [
  'address || pickupLabel || pickupShortLabel',
  'Identificando seu endereço...',
  'Toque para tentar identificar o endereço',
]) {
  if (!read(homePath).includes(marker)) throw new Error(`[FAIL] Corridas pickup: marcador ausente na Home (${marker})`);
}
if (read(homePath).includes('address || "Sua localização atual"')) {
  throw new Error('[FAIL] Corridas pickup: Home ainda usa fallback genérico "Sua localização atual"');
}

console.log('[OK] Corridas: Local de partida exibe endereço reverso real da posição GPS, sem fallback genérico');
