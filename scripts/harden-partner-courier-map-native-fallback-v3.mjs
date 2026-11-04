import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
const path = resolve(process.env.APOIS_ENTREGAS_WORKSPACE || ".work/partner-entregador", "src/components/CourierRouteMap.tsx");
let source = readFileSync(path, "utf8");
const importAnchor = 'import { useEffect, useMemo, useRef, useState } from "react";';
if (!source.includes(importAnchor)) throw Error("[FAIL] imports CourierRouteMap alterados");
source = source.replace(importAnchor, importAnchor + '\nimport { Capacitor } from "@capacitor/core";\nimport { Geolocation } from "@capacitor/geolocation";');
const start = source.indexOf("export function CourierLiveMap(");
const end = source.indexOf("export function CourierRouteMap(", start);
if (start < 0 || end < 0) throw Error("[FAIL] CourierLiveMap nao localizado");
let section = source.slice(start, end);
const hook = '  const activeOfferSet = useMemo(() => new Set(activeOfferMerchantIds), [activeOfferMerchantIds]);';
if (!section.includes(hook)) throw Error("[FAIL] hook do mapa alterado");
const code = [
'  // APOIS_COURIER_MAP_OFFLINE_NATIVE_FALLBACK_V3: GPS somente local para exibir mapa.',
'  const [offlineMapPosition, setOfflineMapPosition] = useState<CourierPosition | null>(null);',
'  const [offlineMapError, setOfflineMapError] = useState("");',
'  useEffect(() => {',
'    if (currentPosition) return;',
'    let active = true;',
'    const locate = async () => {',
'      if (!Capacitor.isNativePlatform() || Capacitor.getPlatform() !== "android") return;',
'      try {',
'        let permission = await Geolocation.checkPermissions();',
'        if (permission.location !== "granted") permission = await Geolocation.requestPermissions({ permissions: ["location", "coarseLocation"] });',
'        if (permission.location !== "granted") throw new Error("Autorize o GPS para visualizar o mapa.");',
'        const result = await Geolocation.getCurrentPosition({ enableHighAccuracy: true, timeout: 20000, maximumAge: 30000 });',
'        if (!active) return;',
'        const coords = result.coords;',
'        setOfflineMapPosition({ lat: coords.latitude, lng: coords.longitude, accuracy: coords.accuracy, heading: coords.heading, speed: coords.speed, recordedAt: Date.now() });',
'        setOfflineMapError("");',
'      } catch (error) {',
'        if (active) setOfflineMapError(error instanceof Error ? error.message : "Falha na leitura do GPS.");',
'      }',
'    };',
'    void locate();',
'    return () => { active = false; };',
'  }, [currentPosition]);',
'  const mapPosition = currentPosition ?? offlineMapPosition;',
].join("\n") + "\n";
section = section.replace(hook, code + hook);
section = section.replaceAll("if (!currentPosition) return [];", "if (!mapPosition) return [];");
section = section.replaceAll("currentPosition.lat", "mapPosition.lat").replaceAll("currentPosition.lng", "mapPosition.lng");
section = section.replaceAll("browserKey && currentPosition", "browserKey && mapPosition");
section = section.replaceAll("{currentPosition\n", "{mapPosition\n");
section = section.replaceAll("}, [activeOfferSet, currentPosition, merchants]);", "}, [activeOfferSet, mapPosition, merchants]);");
section = section.replaceAll('"Aguardando o GPS retornar sua posição atual."', 'offlineMapError || "Aguardando o GPS retornar sua posição atual."');
source = source.slice(0, start) + section + source.slice(end);
if (!source.includes("APOIS_COURIER_MAP_OFFLINE_NATIVE_FALLBACK_V3")) throw Error("[FAIL] fallback nativo ausente");
writeFileSync(path, source, "utf8");
console.log("[OK] Entregador: mapa busca GPS nativo local e exibe erro de permissao.");
