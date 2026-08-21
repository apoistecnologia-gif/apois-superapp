import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const path = resolve('.work/corridas/src/components/map/ActiveRideMap.tsx');
let source = readFileSync(path, 'utf8');

function replaceRequired(search, replacement, label) {
  if (source.includes(replacement)) {
    console.log(`[OK] ${label} (já aplicado)`);
    return;
  }
  if (!source.includes(search)) {
    throw new Error(`[FAIL] ${label}: padrão não encontrado em ActiveRideMap.tsx`);
  }
  source = source.replace(search, replacement);
  console.log(`[OK] ${label}`);
}

replaceRequired(
  `    if (!bounds.isEmpty()) {\n      mapRef.current.fitBounds(bounds, {\n        top: 132,\n        right: 36,\n        bottom: 265,\n        left: 36,\n      });\n    }`,
  `    if (!bounds.isEmpty()) {\n      if ((isApproach || isTrip) && driverLocation) {\n        if (isTrip) {\n          // Durante a viagem o passageiro acompanha o carro, e não o planeta\n          // inteiro. A rota continua desenhada até o destino, mas a câmera\n          // permanece numa escala de navegação útil ao redor do motorista.\n          mapRef.current.setCenter(driverLocation);\n          const currentZoom = mapRef.current.getZoom?.();\n          if (typeof currentZoom !== "number" || currentZoom < 13 || currentZoom > 17) {\n            mapRef.current.setZoom(14);\n          }\n        } else {\n          const liveBounds = new maps.LatLngBounds();\n          liveBounds.extend(driverLocation);\n          liveBounds.extend(origin);\n          mapRef.current.fitBounds(liveBounds, {\n            top: 76,\n            right: 24,\n            bottom: 92,\n            left: 24,\n          });\n          maps.event.addListenerOnce(mapRef.current, "idle", () => {\n            const zoom = mapRef.current?.getZoom?.();\n            if (typeof zoom !== "number") return;\n            if (zoom < 8) mapRef.current.setZoom(8);\n            if (zoom > 17) mapRef.current.setZoom(17);\n          });\n        }\n      } else {\n        mapRef.current.fitBounds(bounds, {\n          top: 64,\n          right: 24,\n          bottom: 84,\n          left: 24,\n        });\n        maps.event.addListenerOnce(mapRef.current, "idle", () => {\n          const zoom = mapRef.current?.getZoom?.();\n          if (typeof zoom === "number" && zoom < 6) mapRef.current.setZoom(6);\n        });\n      }\n    }`,
  'passageiro: fitBounds deixa de usar padding que causava zoom mundial',
);

replaceRequired(
  `  }, [destination, isApproach, orderedStops, origin, routePoints, status]);`,
  `  }, [destination, driverLocation, isApproach, isTrip, orderedStops, origin, routePoints, status]);`,
  'passageiro: câmera reage corretamente à fase e à posição real do motorista',
);

replaceRequired(
  `        geodesic: true,`,
  `        geodesic: false,`,
  'passageiro: linha da rota segue geometria viária em vez de arco geodésico',
);

replaceRequired(
  `    // Apenas na primeira coordenada real: se o motorista estiver fora da área\n    // atualmente visível, enquadra embarque + motorista uma única vez. Depois\n    // disso o mapa nunca é recentralizado por updates de GPS.\n    if (!firstDriverViewportRef.current) {\n      firstDriverViewportRef.current = true;\n      const currentBounds = mapRef.current.getBounds?.();\n      if (currentBounds && !currentBounds.contains(driverLocation)) {\n        const approachBounds = new maps.LatLngBounds();\n        approachBounds.extend(origin);\n        approachBounds.extend(driverLocation);\n        mapRef.current.fitBounds(approachBounds, {\n          top: 132,\n          right: 36,\n          bottom: 265,\n          left: 36,\n        });\n      }\n    }`,
  `    // Câmera viva por fase. Durante a viagem acompanha suavemente o motorista;\n    // durante a aproximação enquadra motorista + embarque sem abrir o mapa\n    // para uma escala continental.\n    if (isTrip) {\n      firstDriverViewportRef.current = true;\n      mapRef.current.panTo(driverLocation);\n      const zoom = mapRef.current.getZoom?.();\n      if (typeof zoom !== "number" || zoom < 13 || zoom > 17) mapRef.current.setZoom(14);\n    } else if (isApproach && !firstDriverViewportRef.current) {\n      firstDriverViewportRef.current = true;\n      const approachBounds = new maps.LatLngBounds();\n      approachBounds.extend(origin);\n      approachBounds.extend(driverLocation);\n      mapRef.current.fitBounds(approachBounds, {\n        top: 76,\n        right: 24,\n        bottom: 92,\n        left: 24,\n      });\n      maps.event.addListenerOnce(mapRef.current, "idle", () => {\n        const nextZoom = mapRef.current?.getZoom?.();\n        if (typeof nextZoom !== "number") return;\n        if (nextZoom < 8) mapRef.current.setZoom(8);\n        if (nextZoom > 17) mapRef.current.setZoom(17);\n      });\n    }`,
  'passageiro: câmera acompanha motorista durante a viagem e enquadra a coleta na aproximação',
);

replaceRequired(
  `  }, [driverLocation, origin, ride.driver_heading, status]);`,
  `  }, [driverLocation, isApproach, isTrip, origin, ride.driver_heading, status]);`,
  'passageiro: tracking da câmera depende da fase viva da corrida',
);

for (const required of [
  'mapRef.current.panTo(driverLocation)',
  'mapRef.current.setZoom(14)',
  'top: 76',
  'bottom: 92',
  'geodesic: false',
  'if (isTrip)',
]) {
  if (!source.includes(required)) throw new Error(`[FAIL] viewport vivo incompleto: ${required}`);
}

writeFileSync(path, source, 'utf8');
console.log('[OK] Passageiro: mapa vivo sem zoom mundial, seguindo o motorista e mantendo a rota dourada até o destino.');
