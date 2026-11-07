import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {resolve} from "node:path";
import { APOIS_MAP_RULES, APOIS_MAP_BACKGROUND } from "../apois-map-palette.mjs";
const root=resolve(process.env.APOIS_MOTORISTA_WORKSPACE||".work/partner-motorista");
const app=readFileSync(resolve(root,"src/routes/motorista.app.tsx"),"utf8");
const nav=readFileSync(resolve(root,"src/lib/voiceNav.ts"),"utf8");
const toggle=readFileSync(resolve(root,"src/components/DriverVoiceToggle.tsx"),"utf8");
const logo=readFileSync(resolve(root,"src/components/MovviLogo.tsx"),"utf8");
const android=readFileSync("scripts/configure-partner-android.mjs","utf8");
const check=(file,marks,label)=>{for(const s of marks)assert.ok(file.includes(s),label+" missing "+s)};
check(android,['public void prime(PluginCall call)','waitForVoice(call, 0)','response.put("spoken", true)','TextToSpeech.QUEUE_ADD','TextToSpeech.LANG_MISSING_DATA'],'Native Voice');
check(nav,['APOIS_DRIVER_VOICE_RUNTIME_V9','NativeDriverVoice.prime()','state?.ready===true','answer?.spoken===true','pendingVoiceKeys.add(key)','spoken.add(key)','apois:driver-voice-unavailable','tickNavigation('],'Frontend voice');
assert.ok(nav.indexOf('spoken.add(key)')>nav.indexOf('answer?.spoken === true'),"Speech cannot be marked before native acknowledged playback queue");
check(toggle,['data-apois-driver-voice-test-v9','Testar voz','primeVoice()','setVoiceEnabled(next)','if (!queued) toast.error'],'Voice UI');
check(app,['APOIS_DRIVER_FIELD_VISUAL_V10','snaps={[42, 62, 84]} initial={42}','autoFocus={false}','Confirmar finalização antecipada','distanceToDestinationKm > 0.3','data-apois-driver-trip-top-v6'.replace('data-apois-driver-trip-top','data-apois-trip-top')],'Visual trip');
check(app,['setRouteSteps(nextSteps)','tickNavigation(', 'callStart(', 'callComplete(', 'callRoute(', 'setRatingRide(', 'onShowRoute','onRecenter','MapPin','data-apois-driver-rating-readable-v7'],'Preserve ride navigation');
check(app,['Distância prevista','Tempo previsto','bg-[#F8FAFC]'],'No false traveled statistics or transparent success');
assert.ok(!app.includes('label="Distância" value={distanceLabel}'),"Predicted kilometers mislabeled as driven");
assert.ok(!app.includes('label="Duração" value={durationLabel}'),"Predicted minutes mislabeled as measured");
check(logo,['APOIS_LOGO_DATA_URL','onError={() => setLogoFailed(true)}','logoFailed ?'],'Logo fallback');
assert.ok(app.includes('strokeWeight: 6')||app.includes('strokeWeight: 7'),"Route paint should not obscure streets");
// A igualdade da paleta e validada por conteudo, nao apenas por substring.
// O mapa nativo do Cliente e o web do Motorista vem de APOIS_MAP_RULES.
const mapSource=readFileSync(resolve(root,"src/lib/googleMaps.ts"),"utf8");
const mapComponent=readFileSync(resolve(root,"src/components/MovviMap.tsx"),"utf8");
const paletteMatch=mapSource.match(/export const APOIS_LIGHT_MAP_STYLE: google\.maps\.MapTypeStyle\[\] = (\[[\s\S]*?\n\]);/);
assert.ok(paletteMatch,"Motorista must contain the canonical light map palette");
assert.deepEqual(JSON.parse(paletteMatch[1]),APOIS_MAP_RULES,"Driver map colors differ from native customer map colors");
assert.ok(mapSource.includes(`return theme === "light" ? "${APOIS_MAP_BACKGROUND}" :`),"Driver background differs from client");
check(mapComponent,[
  'const theme: "light" | "dark" = themeOverride ?? (isDriverRole ? "light" : resolved);',
  'isDriverRole ? getMapStyleForTheme("light") : getMapStyleForTheme(theme)',
  'isDriverRole ? getMapBackgroundForTheme("light") : getMapBackgroundForTheme(theme)',
  'mapRef.current.setOptions({ styles, backgroundColor: bgColor })',
  'map.setOptions({ styles, backgroundColor: bgColor })',
],"Shared light map theme");
check(app,['themeOverride="light"'],"Driver home uses the light map");
assert.ok(!mapComponent.includes('mapId:'),"Cloud Map ID would override local client map styles");
console.log("[PASS] Motorista QA: native TTS prime/speech, visible test, photo fallback, compact map/PIN, completion confirmation and honest estimates, existing routes/ratings preserved.");
