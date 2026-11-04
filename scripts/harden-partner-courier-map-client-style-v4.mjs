import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { APOIS_MAP_RULES, assertApoisMapPalette } from "./apois-map-palette.mjs";

// Scope: Courier idle map in an ephemeral build workspace. Active delivery
// routes, GPS, authentication, payments and original submodules remain intact.
const filename = resolve(process.env.APOIS_ENTREGAS_WORKSPACE || ".work/partner-entregador", "src/components/CourierRouteMap.tsx");
const original = readFileSync(filename, "utf8");
const from = original.indexOf("export function CourierLiveMap(");
const to = original.indexOf("export function CourierRouteMap(", from);
if (from < 0 || to <= from) throw Error("[FAIL] Courier map: live map boundaries changed");
let live = original.slice(from, to);

const mapIdAnchor = '  const mapId = ((import.meta as any).env.VITE_GOOGLE_MAPS_MAP_ID || "DEMO_MAP_ID") as string;';
if (!live.includes(mapIdAnchor)) throw Error("[FAIL] Courier map: expected cloud map ID not found");
live = live.replace(mapIdAnchor, "");

// Google Maps ignores local styles when a cloud mapId is supplied. Only the
// courier HOME switches to a styled classic Map; active routes stay unchanged.
const cloudProps = '              mapId={mapId}\n              colorScheme={ColorScheme.LIGHT}';
if (!live.includes(cloudProps)) throw Error("[FAIL] Courier map: live visual props changed");
live = live.replace(cloudProps, '              styles={APOIS_COURIER_MAP_STYLE}\n              backgroundColor="#EDEAE4"\n              clickableIcons={false}');

const markersStart = live.indexOf('              {nearbyMerchants.map((merchant: any) => (');
const markersEnd = live.indexOf('              <RecenterControl position=', markersStart);
if (markersStart < 0 || markersEnd <= markersStart) throw Error("[FAIL] Courier map: live markers structure changed");
live = live.slice(0, markersStart) +
  '              <CourierStyledLiveMarkers position={mapPosition} merchants={nearbyMerchants} />\n' +
  live.slice(markersEnd);

const markerComponent = `
function CourierStyledLiveMarkers({
  position,
  merchants,
}: {
  position: CourierPosition;
  merchants: Array<{ id: string; name: string; position: LatLng; hasActiveOffer: boolean }>;
}) {
  const map = useMap();
  useEffect(() => {
    if (!map || !window.google?.maps) return;
    const maps = window.google.maps;
    const svgIcon = (svg: string, size: number): google.maps.Icon => ({
      url: "data:image/svg+xml;charset=UTF-8," + encodeURIComponent(svg),
      scaledSize: new maps.Size(size, size),
      anchor: new maps.Point(size / 2, size / 2),
    });
    const locationSvg = '<svg xmlns="http://www.w3.org/2000/svg" width="44" height="44" viewBox="0 0 44 44"><circle cx="22" cy="22" r="19" fill="#E51B23" stroke="#fff" stroke-width="4"/><path d="M12 18 33 11 26 33 21 24 12 18Z" fill="#fff" stroke="#7F1017" stroke-width="1.4" stroke-linejoin="round"/></svg>';
    const merchantSvg = '<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32"><circle cx="16" cy="16" r="14" fill="#fff" stroke="#C9141B" stroke-width="2.5"/><path d="M9 14h14l-1-5H10l-1 5Zm2 2h10v8H11v-8Zm3 0v8" fill="none" stroke="#C9141B" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
    const selectedMerchantSvg = merchantSvg.replace('fill="#fff" stroke="#C9141B"', 'fill="#E51B23" stroke="#fff"').replaceAll('stroke="#C9141B"', 'stroke="#fff"');
    const markers: google.maps.Marker[] = [
      new maps.Marker({
        map, position: { lat: position.lat, lng: position.lng },
        icon: svgIcon(locationSvg, 44), title: "Sua localização", zIndex: 100,
      }),
      ...merchants.map((merchant) => new maps.Marker({
        map, position: merchant.position,
        icon: svgIcon(merchant.hasActiveOffer ? selectedMerchantSvg : merchantSvg, 32),
        title: merchant.name, zIndex: merchant.hasActiveOffer ? 90 : 10,
      })),
    ];
    return () => { markers.forEach((marker) => marker.setMap(null)); };
  }, [map, position.lat, position.lng, merchants]);
  return null;
}

`;
const typeAnchor = "type LatLng = { lat: number; lng: number };";
if (!original.includes(typeAnchor)) throw Error("[FAIL] Courier map: LatLng type missing");
const styleName = "APOIS_COURIER_MAP_STYLE";
if (original.includes(styleName)) throw Error("[FAIL] Courier map: style already applied");
assertApoisMapPalette(APOIS_MAP_RULES);
const declaration = "\n// APOIS_COURIER_CLIENT_MAP_V4: canonical Cliente/Passageiro visual palette.\n" +
  "const " + styleName + ": google.maps.MapTypeStyle[] = " + JSON.stringify(APOIS_MAP_RULES, null, 2) + ";\n";
let next = original.slice(0, from) + markerComponent + live + original.slice(to);
next = next.replace(typeAnchor, typeAnchor + declaration);
if (next === original || !next.includes("styles={APOIS_COURIER_MAP_STYLE}")) throw Error("[FAIL] Courier map: style not applied");
writeFileSync(filename, next, "utf8");
console.log("[OK] Courier home map uses official APOIS Cliente colors and smaller branded markers.");
