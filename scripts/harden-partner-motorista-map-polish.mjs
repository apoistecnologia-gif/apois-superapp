import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const path = resolve(process.env.APOIS_MOTORISTA_WORKSPACE || '.work/partner-motorista', 'src/components/MovviMap.tsx');
let source = readFileSync(path, 'utf8');

const old = '  const styles = useMemo(() => getMapStyleForTheme(theme), [theme]);';
const replacement = `  const styles = useMemo(() => {
    if (!isDriverRole) return getMapStyleForTheme(theme);
    return [
      { elementType: "geometry", stylers: [{ color: "#101722" }] },
      { elementType: "labels.text.fill", stylers: [{ color: "#d7dee9" }] },
      { elementType: "labels.text.stroke", stylers: [{ color: "#101722" }, { weight: 3 }] },
      { featureType: "administrative", elementType: "geometry", stylers: [{ visibility: "off" }] },
      { featureType: "poi", elementType: "labels", stylers: [{ visibility: "off" }] },
      { featureType: "transit", elementType: "labels", stylers: [{ visibility: "off" }] },
      { featureType: "road", elementType: "geometry", stylers: [{ color: "#293548" }] },
      { featureType: "road", elementType: "geometry.stroke", stylers: [{ color: "#172131" }] },
      { featureType: "road", elementType: "labels.text.fill", stylers: [{ color: "#cbd5e1" }] },
      { featureType: "road.local", elementType: "geometry", stylers: [{ color: "#243044" }] },
      { featureType: "road.arterial", elementType: "geometry", stylers: [{ color: "#34445d" }] },
      { featureType: "road.highway", elementType: "geometry", stylers: [{ color: "#495c79" }] },
      { featureType: "water", elementType: "geometry", stylers: [{ color: "#07111e" }] },
      { featureType: "landscape", elementType: "geometry", stylers: [{ color: "#101722" }] },
    ] as google.maps.MapTypeStyle[];
  }, [theme, isDriverRole]);`;

if (!source.includes(old)) throw new Error('[FAIL] MovviMap: bloco de estilo não encontrado');
source = source.replace(old, replacement);

source = source.replace(
  '          clickableIcons: false,\n          backgroundColor: bgColor,',
  '          clickableIcons: false,\n          backgroundColor: isDriverRole ? "#101722" : bgColor,\n          mapTypeControl: false,\n          streetViewControl: false,\n          fullscreenControl: false,\n          rotateControl: false,'
);

if (!source.includes('featureType: "poi"') || !source.includes('isDriverRole ? "#101722" : bgColor')) {
  throw new Error('[FAIL] MovviMap: visual de navegação não aplicado');
}

writeFileSync(path, source, 'utf8');
console.log('[OK] Motorista: mapa de navegação simplificado, com menos poluição visual e vias mais legíveis.');
