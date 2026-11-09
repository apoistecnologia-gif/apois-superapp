// APOIS REPORT12 / INV-065 — corrections only in isolated Passenger Corridas workspace.
// Reuse the already integrated PassengerMap and reverse-geocoder; never place
// a fake pin or a success toast without a coordinate + a saved destination.
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const work = resolve(process.env.APOIS_CORRIDAS_WORKSPACE || ".work/corridas");
const files = new Map();
function edit(path, modify) {
  const file = resolve(work, path);
  const original = readFileSync(file, "utf8");
  const changed = modify(original);
  if (changed === original) throw Error("[FAIL] REPORT12 patch left " + path + " unchanged");
  files.set(file, changed);
}
function once(source, from, to, label) {
  const n = source.split(from).length - 1;
  if (n !== 1) throw Error("[FAIL] REPORT12 " + label + " anchor count " + n);
  return source.replace(from, to);
}

// Existing native Google Map adapter + existing JS Google Map. No second map API.
edit("src/components/map/PassengerMap.tsx", (original) => {
  let s = original;
  if (s.includes("APOIS_REPORT12_MAP_CAMERA_V1")) throw Error("[FAIL] report12 map already applied");
  if (!s.includes("APOIS_NATIVE_MAP_FALLBACK_V3") ||
      !s.includes("APOIS_PASSENGER_LIVE_FOCUS_V2")) {
    throw Error("[FAIL] report12 requires approved native/live camera hardeners");
  }
  s = once(s, "  focusPickup?: boolean;",
    "  focusPickup?: boolean;\n  selectionMode?: boolean;\n  onSelectionCenterChange?: (point: { lat: number; lng: number } | null) => void;",
    "map prop interface");
  s = once(s, "  focusPickup = false,",
    "  focusPickup = false,\n  selectionMode = false,\n  onSelectionCenterChange,",
    "map prop destructuring");
  s = once(s,
    '  const nativeMapIdRef = useRef("apois-passenger-native-map");',
    '  const nativeMapIdRef = useRef(selectionMode ? "apois-passenger-selection-map" : "apois-passenger-native-map");',
    "separate map instance IDs to avoid races with Home unmount");
  s = once(s,
    '  const [reloadKey, setReloadKey] = useState(0);',
    [
      '  const [reloadKey, setReloadKey] = useState(0);',
      '  // APOIS_REPORT12_MAP_CAMERA_V1: camera settled -> pin location; moving -> unready.',
      '  const selectionCallbackRef = useRef(onSelectionCenterChange);',
      '  const selectionMovedByGestureRef = useRef(false);',
      '  useEffect(() => { selectionCallbackRef.current = onSelectionCenterChange; }, [onSelectionCenterChange]);',
      '  const notifySelectionCenter = useCallback((point: Coordinate | null) => {',
      '    if (point && (!Number.isFinite(point.lat) || !Number.isFinite(point.lng) ||',
      '        Math.abs(point.lat) > 90 || Math.abs(point.lng) > 180)) {',
      '      selectionCallbackRef.current?.(null); return;',
      '    }',
      '    selectionCallbackRef.current?.(point);',
      '  }, []);',
    ].join("\n"),
    "current camera callback");
  s = once(s,
    '        await mapService.createMap(mapElementRef.current, nativeApiKey, origin ?? DEFAULT_CENTER, origin ? 16 : 5);',
    [
      '        const nativeMap = await mapService.createMap(mapElementRef.current, nativeApiKey, origin ?? DEFAULT_CENTER, origin ? 16 : 5);',
      '        if (selectionMode) {',
      '          await nativeMap.setOnCameraMoveStartedListener(({ isGesture }) => {',
      '            if (isGesture) selectionMovedByGestureRef.current = true;',
      '            notifySelectionCenter(null);',
      '          });',
      '          await nativeMap.setOnCameraIdleListener(({ latitude, longitude }) => {',
      '            if (selectionMovedByGestureRef.current || origin) notifySelectionCenter({ lat: latitude, lng: longitude });',
      '          });',
      '          // A freshly created map may be idle before the listener is installed.',
      '          if (origin) {',
      '            try {',
      '              const bounds = await nativeMap.getMapBounds();',
      '              if (bounds?.center) notifySelectionCenter(bounds.center);',
      '            } catch { /* Camera idle callback remains authoritative. */ }',
      '          }',
      '        }',
    ].join("\n"),
    "native camera observation");
  s = once(s,
    '      cameraInitializedRef.current = false;\n      driverPositionRef.current = null;',
    [
      '      if (selectionMode) {',
      '        const pickerMap = mapRef.current;',
      '        pickerMap.addListener("dragstart", () => {',
      '          selectionMovedByGestureRef.current = true;',
      '          notifySelectionCenter(null);',
      '        });',
      '        pickerMap.addListener("zoom_changed", () => notifySelectionCenter(null));',
      '        pickerMap.addListener("idle", () => {',
      '          if (!selectionMovedByGestureRef.current && !origin) return;',
      '          const center = pickerMap.getCenter?.();',
      '          if (center) notifySelectionCenter({ lat: center.lat(), lng: center.lng() });',
      '        });',
      '      }',
      '      cameraInitializedRef.current = false;',
      '      driverPositionRef.current = null;',
    ].join("\n"),
    "JS map camera observation");
  s = once(s,
    '    if (!nativeModeRef.current || status !== "ready") return;',
    '    if (selectionMode || !nativeModeRef.current || status !== "ready") return;',
    "skip automatic native fit during selection");
  s = once(s,
    '    if (!maps) return;\n\n    for (const marker of staticMarkersRef.current)',
    '    if (!maps || selectionMode) return;\n\n    for (const marker of staticMarkersRef.current)',
    "skip automatic JS fit during selection");
  for (const required of [
    "APOIS_REPORT12_MAP_CAMERA_V1",
    "setOnCameraIdleListener",
    "setOnCameraMoveStartedListener",
    'pickerMap.addListener("idle"',
    "selectionMode || !nativeModeRef.current",
    "onSelectionCenterChange?:",
  ]) if (!s.includes(required)) throw Error("[FAIL] report12 map missing " + required);
  return s;
});

// Represent pin selection as its own source, not a fabricated Google place ID.
edit("src/types/places.ts", (source) =>
  once(source, 'source: "google_places";', 'source: "google_places" | "map_selection";', "destination source union"));
edit("src/types/rides/stops.ts", (source) =>
  once(source, 'source: "google_places" | "favorites" | "recent";',
    'source: "google_places" | "favorites" | "recent" | "map_selection";',
    "stop source union"));

edit("src/routes/_authenticated.buscar-destino.tsx", (original) => {
  let s = original;
  if (s.includes("APOIS_REPORT12_MAP_SELECTION_V1")) throw Error("[FAIL] report12 route already applied");
  if (!s.includes("APOIS_CLIENTE_DESTINATION_FEEDBACK_V2") ||
      !s.includes("APOIS_FAVORITES_IN_DESTINATION_SEARCH_V1")) {
    throw Error("[FAIL] report12 requires already-integrated suggestions and favorites");
  }
  s = once(s,
    'import { useEffect, useRef, useState } from "react";',
    'import { useCallback, useEffect, useRef, useState } from "react";',
    "callback import");
  s = once(s,
    'import { placesService } from "@/services/places/places-service";',
    [
      'import { placesService } from "@/services/places/places-service";',
      'import PassengerMap from "@/components/map/PassengerMap";',
      'import { geocodingService } from "@/services/geocoding/geocoding-service";',
    ].join("\n"),
    "reuse map and reverse geocoder");
  s = once(s,
    '  const [isPickingOnMap, setIsPickingOnMap] = useState(false);',
    [
      '  const [isPickingOnMap, setIsPickingOnMap] = useState(false);',
      '  // APOIS_REPORT12_MAP_SELECTION_V1: camera position from the *live* map only.',
      '  const [mapSelectionCenter, setMapSelectionCenter] = useState<{ lat: number; lng: number } | null>(null);',
      '  const [isResolvingMapSelection, setIsResolvingMapSelection] = useState(false);',
      '  const selectionCenterRef = useRef<{ lat: number; lng: number } | null>(null);',
      '  const mapRequestSequenceRef = useRef(0);',
      '  const mapConfirmBusyRef = useRef(false);',
      '  useEffect(() => () => { mapRequestSequenceRef.current += 1; }, []);',
      '  const onMapSelectionCameraIdle = useCallback((point: { lat: number; lng: number } | null) => {',
      '    selectionCenterRef.current = point;',
      '    setMapSelectionCenter(point);',
      '  }, []);',
    ].join("\n"),
    "map selection state");
  s = once(s,
    'source: details.source === "google_places" ? "google_places" : "recent",',
    'source: details.source === "google_places" ? "google_places" : details.source === "map_selection" ? "map_selection" : "recent",',
    "preserve stop source");
  const handlerStart = s.indexOf("  const handleConfirmMapSelection = async () => {");
  const handlerEnd = s.indexOf("\n\n  const getFavoriteIcon", handlerStart);
  if (handlerStart < 0 || handlerEnd < 0 || handlerEnd-handlerStart > 1500) throw Error("[FAIL] report12 original map confirmation handler changed");
  const handler = [
    '  const handleConfirmMapSelection = async () => {',
    '    if (isSelecting || isResolvingMapSelection || mapConfirmBusyRef.current) return;',
    '    const point = selectionCenterRef.current;',
    '    if (!point || !Number.isFinite(point.lat) || !Number.isFinite(point.lng) ||',
    '        Math.abs(point.lat) > 90 || Math.abs(point.lng) > 180) {',
    '      toast.error("Mova o mapa e aguarde o pin parar em uma posição válida.");',
    '      return;',
    '    }',
    '    const requestId = ++mapRequestSequenceRef.current;',
    '    mapConfirmBusyRef.current = true;',
    '    setIsResolvingMapSelection(true);',
    '    try {',
    '      // Reuse the existing authenticated reverse-geocoding service; no new provider.',
    '      const address = await geocodingService.resolvePickupAddress(point);',
    '      const stillCurrent = selectionCenterRef.current;',
    '      if (requestId !== mapRequestSequenceRef.current || !stillCurrent ||',
    '          stillCurrent.lat !== point.lat || stillCurrent.lng !== point.lng) {',
    '        toast.error("A posição do mapa mudou. Aguarde e confirme novamente.");',
    '        return;',
    '      }',
    '      const formattedAddress = String(address.address || address.label || "").trim();',
    '      if (!formattedAddress || formattedAddress === "Endereço não identificado") {',
    '        throw new Error("Não foi possível identificar o endereço do pin. Mova o mapa e tente novamente.");',
    '      }',
    '      const details: DestinationAddress = {',
    '        placeId: "map:" + point.lat.toFixed(6) + "," + point.lng.toFixed(6),',
    '        latitude: point.lat, longitude: point.lng,',
    '        label: address.label || formattedAddress,',
    '        ...(address.subLabel ? { subLabel: address.subLabel } : {}),',
    '        formattedAddress, name: address.label || formattedAddress,',
    '        components: address.components ?? {},',
    '        types: [], selectedAt: new Date().toISOString(),',
    '        source: "map_selection",',
    '      };',
    '      if (saveTarget) {',
    '        saveAddress(details, saveTarget);',
    '        setIsPickingOnMap(false);',
    '        setIsBottomSheetOpen(true);',
    '        return;',
    '      }',
    '      addToHistory(details);',
    '      handleFinalSelection(details);',
    '      toast.success(isStopSelection ? "Parada selecionada no mapa." : "Destino selecionado no mapa.");',
    '    } catch (error) {',
    '      toast.error(error instanceof Error ? error.message : "Não foi possível confirmar o ponto escolhido.");',
    '    } finally {',
    '      mapConfirmBusyRef.current = false;',
    '      setIsResolvingMapSelection(false);',
    '    }',
    '  };',
  ].join("\n");
  s = s.slice(0,handlerStart)+handler+s.slice(handlerEnd);

  // Keep every entry into the map picker (history, empty suggestions and failures).
  const startAnchor = 'setIsBottomSheetOpen(false); setIsPickingOnMap(true);';
  if (s.split(startAnchor).length-1 !== 2) throw Error("[FAIL] report12 expected exactly two suggestion map entry points");
  s = s.replaceAll(startAnchor,
    'selectionCenterRef.current = null; setMapSelectionCenter(null); setIsBottomSheetOpen(false); setIsPickingOnMap(true);');
  const mainAnchor = [
    '                      setIsBottomSheetOpen(false);',
    '                      setIsPickingOnMap(true);',
  ].join("\n");
  s = once(s,mainAnchor,[
    '                      selectionCenterRef.current = null;',
    '                      setMapSelectionCenter(null);',
    '                      setIsBottomSheetOpen(false);',
    '                      setIsPickingOnMap(true);',
  ].join("\n"),"history map entry point");

  s = once(s,
    '      {/* PIN central fixo quando escolhendo no mapa */}',
    [
      '      {/* Existing PassengerMap reused behind the central pin, also on native Android. */}',
      '      {isPickingOnMap && (',
      '        <div data-apois-report12-selection-map="true" className="absolute inset-0 z-[1] min-h-0">',
      '          <PassengerMap origin={undefined} destination={undefined} encodedPolyline={undefined}',
      '            driverLocation={undefined} isStatic={false} selectionMode',
      '            onSelectionCenterChange={onMapSelectionCameraIdle} />',
      '        </div>',
      '      )}',
      '      {/* PIN central fixo quando escolhendo no mapa */}',
    ].join("\n"),
    "mount live PassengerMap");
  s = once(s,
    '            onClick={handleConfirmMapSelection}',
    '            onClick={() => void handleConfirmMapSelection()}\n            disabled={!mapSelectionCenter || isResolvingMapSelection}',
    "prevent confirmation without settled camera");
  s = once(s,
    '            Confirmar destino\n',
    '            {isResolvingMapSelection ? "Identificando endereço..." : isStopSelection ? "Confirmar parada" : "Confirmar destino"}\n',
    "accurate action and processing feedback");
  for (const token of [
    "APOIS_REPORT12_MAP_SELECTION_V1",
    'selectionMode',
    'onSelectionCenterChange={onMapSelectionCameraIdle}',
    'geocodingService.resolvePickupAddress(point)',
    'handleFinalSelection(details)',
    'source: "map_selection"',
    'isStopSelection ? "Confirmar parada"',
    'data-apois-favorite-save-mode="true"',
    'placesService.selectPrediction(suggestion)',
  ]) if (!s.includes(token)) throw Error("[FAIL] report12 route missing " + token);
  return s;
});

// No partial files if anchors/contract diverged: only write after all transforms.
for (const [file, content] of files) writeFileSync(file, content, "utf8");
console.log("[OK] REPORT12: real native/JS map center, reverse address, stop/favorite/history flow; no false success.");
