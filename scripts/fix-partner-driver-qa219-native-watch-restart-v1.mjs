// APOIS_DRIVER_QA219_NATIVE_WATCH_RESTART_V1
// Fix the online -> offline -> online race while the first native GPS watch
// is still starting. Only modifies the disposable generated Motorista route.
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const marker = "APOIS_DRIVER_QA219_NATIVE_WATCH_RESTART_V1";
export function patchNativeWatchRestart(source) {
  if (source.includes(marker)) throw new Error("[FAIL] QA219 native watch already patched");
  const stop = source.indexOf('  const stopDriverWatch = useCallback(() => {');
  const start = source.indexOf('  const startWatch = useCallback(() => {', stop);
  const end = source.indexOf('  // Primeiro', start) >= 0
    ? source.indexOf('  // Primeiro', start)
    : source.indexOf('  // Solicita', start);
  // Bound to the stop/start watcher functions instead of changing unrelated UI.
  if (stop < 0 || start <= stop) throw new Error("[FAIL] QA219 native watcher bounds changed");
  const guardStart = '  const watchStopRequestedRef = useRef(false);';
  if (source.split(guardStart).length !== 2) throw new Error("[FAIL] QA219 native watcher refs changed");
  let result = source.replace(guardStart, guardStart + '\n  // ' + marker +
    ': defer a new watch until the obsolete watch is fully closed.\n  const watchRestartRequestedRef = useRef(false);');
  const stopStart = result.indexOf('  const stopDriverWatch = useCallback(() => {');
  const startStart = result.indexOf('  const startWatch = useCallback(() => {', stopStart);
  let stopBlock = result.slice(stopStart,startStart);
  const stopAnchor = '    watchStopRequestedRef.current = true;';
  if (stopBlock.split(stopAnchor).length !== 2) throw new Error("[FAIL] QA219 watch stop anchor changed");
  stopBlock=stopBlock.replace(stopAnchor,'    watchRestartRequestedRef.current = false;\n'+stopAnchor);
  result=result.slice(0,stopStart)+stopBlock+result.slice(startStart);

  const regionStart=result.indexOf('  const startWatch = useCallback(() => {');
  const regionEnd=result.indexOf('  }, []);',regionStart);
  if(regionStart<0||regionEnd<regionStart)throw new Error("[FAIL] QA219 watch start function changed");
  let region=result.slice(regionStart,regionEnd);
  function only(before,after,label) {
    if(region.split(before).length!==2)throw new Error("[FAIL] QA219 native watch "+label);
    region=region.replace(before,after);
  }
  only(
    '    if (watchIdRef.current != null || watchStartingRef.current) return;\n    watchStopRequestedRef.current = false;',
    [
      '    if (watchIdRef.current != null) return;',
      '    if (watchStartingRef.current) {',
      '      // OFFLINE invalidated the first pending native watch; restart after it settles.',
      '      if (watchStopRequestedRef.current) watchRestartRequestedRef.current = true;',
      '      return;',
      '    }',
      '    watchStopRequestedRef.current = false;',
      '    watchRestartRequestedRef.current = false;',
    ].join('\n'),"start during pending stop"
  );
  only(
    '          void Geolocation.clearWatch({ id }).catch(() => undefined);\n          return;',
    [
      '          void Geolocation.clearWatch({ id }).catch(() => undefined).finally(() => {',
      '            if (!watchRestartRequestedRef.current) return;',
      '            watchRestartRequestedRef.current = false;',
      '            startWatch();',
      '          });',
      '          return;',
    ].join('\n'),"restart after clearing obsolete watch"
  );
  const catchAnchor = '        watchStartingRef.current = false;\n        if (import.meta.env.DEV) console.warn("[APOIS MOTORISTA] não foi possível iniciar watch GPS nativo:", error);';
  only(catchAnchor,
    catchAnchor+'\n        // If the obsolete watch failed, retry once for the new ONLINE cycle.\n        if (watchRestartRequestedRef.current) {\n          watchRestartRequestedRef.current = false;\n          startWatch();\n        }',
    "retry after obsolete start failure"
  );
  result=result.slice(0,regionStart)+region+result.slice(regionEnd);
  for(const required of [marker,"watchRestartRequestedRef.current = true","watchRestartRequestedRef.current = false","Geolocation.clearWatch({ id }).catch(() => undefined).finally", "startWatch();"])if(!result.includes(required))throw new Error("[FAIL] QA219 native watcher invariant "+required);
  return result;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const path = resolve(process.env.APOIS_MOTORISTA_WORKSPACE || ".work/partner-motorista","src/routes/motorista.app.tsx");
  const source = readFileSync(path,"utf8");
  writeFileSync(path,patchNativeWatchRestart(source),"utf8");
  console.log("[OK] QA219 Motorista: native GPS restarts after fast ONLINE/OFFLINE/ONLINE toggles");
}
