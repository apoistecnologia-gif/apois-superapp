import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
const workspace = process.env.APOIS_PASSAGEIRO_WORKSPACE || '.work/corridas';

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

patch('src/components/map/ActiveRideMap.tsx', (source) => {
  let next = source;

  // Água precisa permanecer visível e elegante no mapa noturno.
  next = next
    .replace('{ featureType: "water", elementType: "geometry", stylers: [{ color: "#0d2532" }] },', '{ featureType: "water", elementType: "geometry", stylers: [{ color: "#082b3a" }] },')
    .replace('{ featureType: "water", elementType: "labels.text.fill", stylers: [{ color: "#67808c" }] },', '{ featureType: "water", elementType: "labels.text.fill", stylers: [{ color: "#7ca0af" }] },');

  // Padroniza rota e destino no dourado oficial APOIS.
  next = next.replaceAll('"#FFB800"', '"#F6BE1C"');
  next = next.replace('strokeWeight: 5,', 'strokeWeight: 6,');

  if (!next.includes('function buildApoisDriverLocationIcon')) {
    const marker = `const validCoordinate = (coordinate: Coordinate): boolean =>\n  Number.isFinite(coordinate.lat) &&\n  Number.isFinite(coordinate.lng) &&\n  coordinate.lat >= -90 &&\n  coordinate.lat <= 90 &&\n  coordinate.lng >= -180 &&\n  coordinate.lng <= 180;`;
    if (!next.includes(marker)) throw new Error('ActiveRideMap.tsx: validCoordinate não encontrado');
    const helper = `${marker}\n\nfunction buildApoisDriverLocationIcon(maps: any) {\n  const svg = \\`<svg xmlns="http://www.w3.org/2000/svg" width="54" height="64" viewBox="0 0 54 64" aria-hidden="true"><g id="APOIS_DRIVER_LOCATION_A"><path d="M27 2C14.3 2 4 12.3 4 25c0 17.1 23 37 23 37s23-19.9 23-37C50 12.3 39.7 2 27 2Z" fill="#080B11" stroke="#F6BE1C" stroke-width="3"/><circle cx="27" cy="25" r="14" fill="#F6BE1C"/><text x="27" y="32" text-anchor="middle" font-family="Arial,sans-serif" font-size="22" font-weight="900" fill="#080B11">A</text></g></svg>\\`;\n  return {\n    url: \\`data:image/svg+xml;charset=UTF-8,\${encodeURIComponent(svg)}\\`,\n    scaledSize: new maps.Size(54, 64),\n    anchor: new maps.Point(27, 62),\n  };\n}`;
    next = next.replace(marker, helper);
  }

  const oldIcon = `    const icon = {\n      path: maps.SymbolPath.FORWARD_CLOSED_ARROW,\n      scale: 6,\n      rotation:\n        typeof ride.driver_heading === "number" && Number.isFinite(ride.driver_heading)\n          ? ride.driver_heading\n          : 0,\n      fillColor: "#2563EB",\n      fillOpacity: 1,\n      strokeColor: "#FFFFFF",\n      strokeWeight: 2,\n      anchor: new maps.Point(0, 2),\n    };`;
  const newIcon = `    const icon = buildApoisDriverLocationIcon(maps);`;
  if (!next.includes(newIcon)) {
    if (!next.includes(oldIcon)) throw new Error('ActiveRideMap.tsx: ícone antigo do motorista não encontrado');
    next = next.replace(oldIcon, newIcon);
  }

  next = next.replace('title: "Motorista",', 'title: "APOIS • motorista em tempo real",');

  return next;
}, 'passageiro: rota dourada, água visível e marcador APOIS em tempo real');

console.log(`[OK] branding de mapa do Passageiro concluído em ${workspace}`);
