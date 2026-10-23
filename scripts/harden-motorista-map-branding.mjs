import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { APOIS_MAP_BACKGROUND, mapStyleDeclaration } from './apois-map-palette.mjs';

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

// APOIS Maps V3: mesma paleta do mapa nativo do passageiro, com agua
// azul-marinho, quadras neutras, ruas em camadas e vias arteriais distintas.
patch('src/lib/googleMaps.ts', (source) => {
  const start = source.indexOf('export const APOIS_LIGHT_MAP_STYLE: google.maps.MapTypeStyle[] = [');
  if (start < 0) throw new Error('[FAIL] Motorista: declaracao do mapa claro nao encontrada');
  const endStart = source.indexOf(String.fromCharCode(10) + '];', start);
  if (endStart < 0) throw new Error('[FAIL] Motorista: fim da paleta nao encontrado');
  const end = endStart + 3;
  const styled = mapStyleDeclaration('APOIS_LIGHT_MAP_STYLE', 'google.maps.MapTypeStyle[]')
    .replace('const APOIS_LIGHT_MAP_STYLE', 'export const APOIS_LIGHT_MAP_STYLE');
  let next = source.slice(0, start) + styled + source.slice(end);
  next = next.replace(
    'return theme === "light" ? "#f8f9fa" : "#111d31";',
    'return theme === "light" ? "' + APOIS_MAP_BACKGROUND + '" : "#111d31";',
  );
  for (const required of ['APOIS_LIGHT_MAP_STYLE', '"#0B2944"', 'return theme === "light" ? "' + APOIS_MAP_BACKGROUND]) {
    if (!next.includes(required)) throw new Error('[FAIL] Motorista: mapa oficial incompleto (' + required + ')');
  }
  return next;
}, 'motorista: paleta do mapa unificada com Passageiro APOIS');

patch('src/components/mapMarkers.tsx', (source) => {
  let next = source;

  // Substitui somente a apresentacao do localizador; GPS e heading permanecem intactos.

  const oldReturn = `  if (!validPosition(position) || !validPosition(display)) return null;\n  return <>\n    <Marker position={display} clickable={false} zIndex={9997} icon={{ path: safeSymbol("CIRCLE"), scale: 15, fillColor: safeDriverColor, fillOpacity: 0.1, strokeColor: safeDriverColor, strokeOpacity: 0.28, strokeWeight: 1.2 }} />\n    <CarShape position={display} heading={displayHeading} scale={safeDriverScale} bodyColor={safeDriverColor} outlineColor="#090A0B" zBase={10000} />\n  </>;`;

  const brandedReturn = "  if (!validPosition(position) || !validPosition(display)) return null;\n  // APOIS_DRIVER_LOCATION_V2: localizacao centralizada, halo leve e seta orientada pelo GPS.\n  const visualScale = Math.max(0.9, Math.min(1.15, safeDriverScale / 1.7));\n  return <>\n    <Marker position={display} clickable={false} zIndex={9997} icon={{ path: safeSymbol(\"CIRCLE\"), scale: 18 * visualScale, fillColor: safeDriverColor, fillOpacity: 0.09, strokeColor: safeDriverColor, strokeOpacity: 0.22, strokeWeight: 1 }} />\n    <Marker position={display} clickable={false} zIndex={9998} icon={{ path: safeSymbol(\"CIRCLE\"), scale: 11 * visualScale, fillColor: \"#FFFFFF\", fillOpacity: 1, strokeColor: \"#FFFFFF\", strokeOpacity: 1, strokeWeight: 2.5 }} />\n    <Marker position={display} clickable={false} title=\"APOIS • localização do motorista\" zIndex={10000}\n      icon={{ path: \"M0 -8 L5.5 6 L0 3 L-5.5 6 Z\", fillColor: safeDriverColor, fillOpacity: 1, strokeColor: \"#FFFFFF\", strokeOpacity: 1, strokeWeight: 1.25, scale: visualScale, rotation: displayHeading, anchor: safePoint(0, 0) }}\n    />\n  </>";

  if (!next.includes(brandedReturn)) {
    if (!next.includes(oldReturn)) throw new Error('mapMarkers.tsx: retorno do InterpolatedDriverMarker não encontrado');
    next = next.replace(oldReturn, brandedReturn);
  }

  return next;
}, 'motorista: marcador de localizacao APOIS refinado e orientado pelo GPS');

patch('src/routes/motorista.app.tsx', (source) => {
  const darkOverride = 'themeOverride="dark"';
  const lightOverride = 'themeOverride="light"';
  if (source.includes(darkOverride)) {
    const next = source.replace(darkOverride, lightOverride);
    if (next.includes(darkOverride)) throw new Error('[FAIL] Motorista: mapa escuro ainda forcado na home');
    return next;
  }
  if (!source.includes(lightOverride)) throw new Error('[FAIL] Motorista: tema claro de mapa ausente na home');
  return source;
}, 'motorista: mapa inicial harmonizado com o tema claro APOIS');

console.log(`[OK] branding de mapa do Motorista concluído em ${workspace}`);
