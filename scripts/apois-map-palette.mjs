// APOIS Maps V3 - paleta unica para Passageiro (nativo/web) e Motorista (web).
// A renderizacao real 3D depende de dados/capacidade do Google Maps local;
// essas regras personalizam SOMENTE o mapa base e nao afetam GPS, rotas ou faturamento.
export const APOIS_MAP_BACKGROUND = '#EDEAE4';
export const APOIS_MAP_WATER = '#0B2944';
export const APOIS_MAP_ROUTE = '#E51B23';
export const APOIS_MAP_RULES = Object.freeze([
  { elementType: 'geometry', stylers: [{ color: '#E8E5DE' }] },
  { elementType: 'labels', stylers: [{ visibility: 'on' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#374151' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#F9F8F5' }, { weight: 2 }] },
  { featureType: 'administrative', elementType: 'geometry', stylers: [{ visibility: 'off' }] },
  { featureType: 'administrative.locality', elementType: 'labels.text.fill', stylers: [{ color: '#1F2937' }] },
  { featureType: 'administrative.neighborhood', elementType: 'labels.text.fill', stylers: [{ color: '#4B5563' }] },
  { featureType: 'landscape', elementType: 'geometry', stylers: [{ color: '#E6E2DA' }] },
  { featureType: 'landscape.man_made', elementType: 'geometry', stylers: [{ color: '#DCD7CE' }] },
  { featureType: 'poi', elementType: 'geometry', stylers: [{ color: '#DDD9D1' }] },
  { featureType: 'poi', elementType: 'labels', stylers: [{ visibility: 'simplified' }] },
  { featureType: 'poi', elementType: 'labels.text.fill', stylers: [{ color: '#555D66' }] },
  { featureType: 'poi.business', elementType: 'labels.icon', stylers: [{ saturation: -40 }] },
  { featureType: 'poi.park', elementType: 'geometry', stylers: [{ color: '#BFCFB8' }] },
  { featureType: 'poi.park', elementType: 'labels.text.fill', stylers: [{ color: '#365B3C' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#FDFCF9' }] },
  { featureType: 'road', elementType: 'geometry.stroke', stylers: [{ color: '#B5B2AB' }, { weight: 1.3 }] },
  { featureType: 'road', elementType: 'labels.text.fill', stylers: [{ color: '#303846' }] },
  { featureType: 'road.local', elementType: 'geometry', stylers: [{ color: '#FBFAF6' }] },
  { featureType: 'road.local', elementType: 'geometry.stroke', stylers: [{ color: '#C0BCB4' }, { weight: 1.1 }] },
  { featureType: 'road.arterial', elementType: 'geometry', stylers: [{ color: '#F3EEE6' }] },
  { featureType: 'road.arterial', elementType: 'geometry.stroke', stylers: [{ color: '#A8A39C' }, { weight: 1.5 }] },
  { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#E4C4B4' }] },
  { featureType: 'road.highway', elementType: 'geometry.stroke', stylers: [{ color: '#A97870' }, { weight: 1.7 }] },
  { featureType: 'road.highway.controlled_access', elementType: 'geometry', stylers: [{ color: '#D9B4A6' }] },
  { featureType: 'transit', elementType: 'geometry', stylers: [{ visibility: 'simplified' }] },
  { featureType: 'transit.station', elementType: 'labels', stylers: [{ visibility: 'simplified' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: APOIS_MAP_WATER }] },
  { featureType: 'water', elementType: 'labels.text.fill', stylers: [{ color: '#D3E6F2' }] },
  { featureType: 'water', elementType: 'labels.text.stroke', stylers: [{ color: '#0B2944' }] },
]);

// Mantem os mesmos valores e a mesma ordem em SDK Android e JavaScript.
export function mapStyleDeclaration(name, type = '') {
  if (!/^[A-Z][A-Z0-9_]*$/.test(name)) throw new Error('Nome de estilo invalido');
  const tsType = type ? ': ' + type : '';
  return 'const ' + name + tsType + ' = ' + JSON.stringify(APOIS_MAP_RULES, null, 2) + ';';
}

export function assertApoisMapPalette(style) {
  for (const [feature, color] of [
    ['water', APOIS_MAP_WATER],
    ['road.local', '#FBFAF6'],
    ['road.highway', '#E4C4B4'],
  ]) {
    if (!style.some((rule) => rule.featureType === feature && rule.elementType === 'geometry' && rule.stylers.some((st) => st.color === color))) {
      throw new Error('APOIS Maps: paleta incompleta (' + feature + ')');
    }
  }
}
assertApoisMapPalette(APOIS_MAP_RULES);
