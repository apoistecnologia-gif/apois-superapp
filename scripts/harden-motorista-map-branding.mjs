import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
const workspace = process.env.APOIS_MOTORISTA_WORKSPACE || '.work/motorista-test';

function patch(relativePath, transform, label) {
  const path = resolve(root, workspace, relativePath);
  const before = readFileSync(path, 'utf8');
  const after = transform(before);
  if (after === before) {
    console.log(`[OK] ${label} (já aplicado/sem alteração)`);
    return;
  }
  writeFileSync(path, after, 'utf8');
  console.log(`[OK] ${label}`);
}

patch('src/components/mapMarkers.tsx', (source) => {
  let next = source;

  if (!next.includes('APOIS_DRIVER_LOCATION_A_PATH')) {
    const marker = 'const PIN_PATH = "M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5a2.5 2.5 0 1 1 0-5 2.5 2.5 0 0 1 0 5z";';
    if (!next.includes(marker)) throw new Error('mapMarkers.tsx: PIN_PATH não encontrado');
    next = next.replace(
      marker,
      `${marker}\n// Identidade da localização ativa: pin APOIS com base preta e acento vermelho no centro.\nconst APOIS_DRIVER_LOCATION_A_PATH = "M7.6 14.4 L11.05 5.7 C11.4 4.8 12.6 4.8 12.95 5.7 L16.4 14.4 M9.15 10.9 H14.85";`,
    );
  }

  const oldReturn = `  if (!validPosition(position) || !validPosition(display)) return null;\n  return <>\n    <Marker position={display} clickable={false} zIndex={9997} icon={{ path: safeSymbol("CIRCLE"), scale: 15, fillColor: safeDriverColor, fillOpacity: 0.1, strokeColor: safeDriverColor, strokeOpacity: 0.28, strokeWeight: 1.2 }} />\n    <CarShape position={display} heading={displayHeading} scale={safeDriverScale} bodyColor={safeDriverColor} outlineColor="#090A0B" zBase={10000} />\n  </>;`;

  const brandedReturn = `  if (!validPosition(position) || !validPosition(display)) return null;\n  const brandedScale = Math.max(1.45, Math.min(2.15, safeDriverScale));\n  return <>\n    <Marker position={display} clickable={false} zIndex={9997} icon={{ path: safeSymbol("CIRCLE"), scale: 10 * brandedScale, fillColor: safeDriverColor, fillOpacity: 0.08, strokeColor: safeDriverColor, strokeOpacity: 0.26, strokeWeight: 1.2 }} />\n    <Marker\n      position={display}\n      clickable={false}\n      title="APOIS • localização do motorista"\n      zIndex={10000}\n      icon={{ path: PIN_PATH, fillColor: "#111111", fillOpacity: 1, strokeColor: safeDriverColor, strokeOpacity: 1, strokeWeight: 2.2, scale: brandedScale, anchor: safePoint(12, 22) }}\n    />\n    <Marker\n      position={display}\n      clickable={false}\n      zIndex={10001}\n      icon={{ path: APOIS_DRIVER_LOCATION_A_PATH, fillOpacity: 0, strokeColor: safeDriverColor, strokeOpacity: 1, strokeWeight: 2.35, scale: brandedScale, anchor: safePoint(12, 22) }}\n    />\n  </>;`;

  if (!next.includes(brandedReturn)) {
    if (!next.includes(oldReturn)) throw new Error('mapMarkers.tsx: retorno do InterpolatedDriverMarker não encontrado');
    next = next.replace(oldReturn, brandedReturn);
  }

  return next;
}, 'motorista: marcador de localização APOIS com acento vermelho');

console.log(`[OK] branding de mapa do Motorista concluído em ${workspace}`);
