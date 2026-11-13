import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  marker, owner,
  patchRecovery, patchMainMapOwner, patchCompactHud, patchHudCss
} from "../fix-partner-driver-qa221-map-owner-compact-hud-v1.mjs";

const recoveryFixture = [
  'type ApoisMapWindow = Window & { __apoisMovviMap?: google.maps.Map | null };',
  'export function DriverActiveRideRecovery() {',
  '  const routeKeyRef = useRef("");',
  '  const clearLines = () => {};',
  '  useEffect(() => {',
  '    if (!ride || !position || !destination || ride.status === "motorista_chegou") {',
  '      return;',
  '    }',
  '    void (async () => {',
  '      const result = await computeDriverRoute({ data: { origin: position, destination } });',
  '        if (cancelled) return;',
  '        const points = decodePolyline(result.encodedPolyline);',
  '        const map = (window as ApoisMapWindow).__apoisMovviMap;',
  '        map.fitBounds(bounds, { top: 105, right: 38, bottom: 180, left: 38 });',
  '    })();',
  '  }, [ride, position, destination]);',
  '  if (!ride || ride.status === "motorista_chegou") return null;',
  '  const tags = ["driver-active-route-recovery-rides-", "driver-active-route-recovery-presence-", "driver_get_profile"];',
  '}'
].join("\n");

const mainFixture = [
  '// APOIS_DRIVER_QA220_STABLE_ANDROID_MAP_PIN_V1',
  '// APOIS_DRIVER_QA219_STALE_TERMINAL_EVENT_GUARD_V1',
  'applyNavigationCamera(map);',
  'autoFollowRef.current = true;',
  'onClick={onShowRoute}',
  'onClick={onRecenter}',
  'onStart(pinCode)',
  '<div className="relative h-[100dvh] w-screen overflow-hidden bg-background text-foreground">'
].join("\n");

const pickupFixture = [
  'function PickupNavOverlay() {',
  '  const [cancelBusy, setCancelBusy] = useState(false);',
  '  const minutes=1,legKm=2,arrivalTime="12:00";',
  '  const handleCancel = () => {};',
  '  const handleArrive = () => {};',
  '  const onOpenProfile = () => {};',
  '  // passenger?.phone',
  '  return (',
  '    <>',
  '      <div data-apois-pickup-top-v4="true">',
  '        <div>old pickup HUD</div>',
  '      </div>',
  '      <div data-apois-pickup-bottom-v4="true">',
  '        <button onClick={handleArrive}>Confirmar chegada</button>',
  '        <button onClick={onOpenProfile}>Perfil</button>',
  '      </div>',
  '    </>',
  '  );',
  '}',
  'function CircleAction() {}'
].join("\n");

const tripFixture = [
  'function ActiveTripNavOverlay() {',
  '  const minutes=1,legKm=2,arrivalTime="12:00";',
  '  return (',
  '    <>',
  '      {/* Top overlay — ETA */}',
  '      <div>',
  '        <div data-apois-trip-top-v6="true">',
  '          <div data-apois-trip-one-metrics-v1="true">old huge stats row</div>',
  '          <button onClick={onShowRoute}>Ver rota</button>',
  '          <button onClick={onRecenter}>Seguir</button>',
  '        </div>',
  '      </div>',
  '      {/* Bottom compact bar — important customer actions */}',
  '      <div data-apois-trip-bottom-v6="true">',
  '        <button onClick={onOpenProfile}>Perfil</button>',
  '        <button onClick={handleComplete}>Finalizar corrida</button>',
  '      </div>',
  '    </>',
  '  );',
  '}'
].join("\n");

test("secondary recovery cannot request or modify main Driver map, even if a route returns later", () => {
  const s=patchRecovery(recoveryFixture);
  assert.ok(s.includes(marker));
  assert.ok(s.includes('document.querySelector('));
  assert.ok(s.includes("data-apois-driver-main-map-owner"), "selector survives TS escaped quotes");
  assert.ok(s.includes('if (mainDriverOwnsMap()) {'));
  assert.ok(s.includes('if (cancelled || mainDriverOwnsMap()) return;'));
  assert.ok(s.includes('if (mainDriverOwnsMap()) return null;'));
  assert.ok(s.includes('map.fitBounds(bounds,'),"fallback outside primary screen preserved");
  assert.ok(s.includes("driver_get_profile"),"existing recovery kept");
  assert.throws(() => patchRecovery(s),/duplicate/);
  assert.throws(() => patchRecovery(recoveryFixture.replace('map.fitBounds(bounds,', 'map.panTo(bounds,')),/prerequisite/);
});

test("main Motorista root is the single documented route owner", () => {
  const s=patchMainMapOwner(mainFixture);
  assert.ok(s.includes(owner));
  assert.equal(s.split(owner).length-1,1);
  assert.ok(s.includes("applyNavigationCamera("));
  assert.ok(s.includes("onStart(pinCode)"));
  assert.throws(() => patchMainMapOwner(s),/duplicate/);
});

test("navigation overlays have exactly one compact HUD and preserve active ride controls", () => {
  const s=patchCompactHud(pickupFixture + "\n" + tripFixture);
  assert.ok(s.includes(marker));
  assert.ok(s.includes('data-apois-qa221-pickup-hud="true"'));
  assert.ok(s.includes('data-apois-qa221-trip-hud="true"'));
  assert.equal((s.match(/data-apois-trip-one-metrics-v1/g)||[]).length,1);
  assert.ok(!s.includes('old huge stats row'));
  assert.ok(!s.includes('old pickup HUD'));
  for(const preserved of [
    "onClick={handleCancel}", "onClick={handleArrive}", "onClick={onOpenProfile}",
    "onClick={onShowRoute}", "onClick={onRecenter}", "onClick={handleComplete}",
    'data-apois-trip-bottom-v6', 'data-apois-pickup-bottom-v4',
    "Ver rota", "Seguir", "Finalizar corrida", "Confirmar chegada"
  ]) assert.ok(s.includes(preserved),"lost "+preserved);
  assert.throws(() => patchCompactHud(s),/duplicate/);
});

test("QA195 nested visual card rules are explicitly neutralized only inside compact HUDs", () => {
  const css=patchHudCss("/* existing css */");
  assert.ok(css.includes(marker));
  assert.ok(css.includes('[data-apois-qa221-trip-hud] [data-apois-trip-top-v6] > div'));
  assert.ok(css.includes('background: transparent !important'));
  assert.throws(() => patchHudCss(css),/duplicate/);
});

test("real generated QA221 Motorista workspace has no competing camera owner", () => {
  const root=resolve(process.env.APOIS_MOTORISTA_WORKSPACE || ".work/partner-motorista");
  const paths=["src/routes/motorista.app.tsx", "src/components/DriverActiveRideRecovery.tsx", "src/styles.css"].map(p=>resolve(root,p));
  if(paths.every(p=>!existsSync(p))) return; // isolated unit tests before disposable build
  for(const p of paths) assert.ok(existsSync(p),"missing generated file "+p);
  const [main,recovery,css]=paths.map(p=>readFileSync(p,"utf8"));
  assert.ok(main.includes(owner));
  assert.ok(main.includes('data-apois-qa221-trip-hud="true"'));
  assert.ok(main.includes('data-apois-qa221-pickup-hud="true"'));
  assert.equal((main.match(/data-apois-trip-one-metrics-v1/g)||[]).length,1);
  assert.ok(recovery.includes(marker));
  assert.ok(recovery.includes("if (cancelled || mainDriverOwnsMap()) return;"));
  assert.ok(recovery.includes("if (mainDriverOwnsMap()) return null;"));
  assert.ok(css.includes(marker));
  for(const feature of ["onStart(pinCode)", "onClick={handleComplete}", "onClick={onShowRoute}", "onClick={onRecenter}", "APOIS_DRIVER_QA220_STABLE_ANDROID_MAP_PIN_V1"]) assert.ok(main.includes(feature),feature);
  assert.ok(main.includes('data-apois-qa220-pin-digit-v1="true"'));
});
