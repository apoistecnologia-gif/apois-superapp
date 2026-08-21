import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
const workspace = process.env.APOIS_MOTORISTA_WORKSPACE || '.work/partner-motorista';
const path = resolve(root, workspace, 'src/routes/motorista.app.tsx');
let source = readFileSync(path, 'utf8');

source = source.replace(
  '  const watchIdRef = useRef<number | null>(null);\n  const initialCenteredRef = useRef(false);',
  '  const watchIdRef = useRef<number | string | null>(null);\n  const watchStartingRef = useRef(false);\n  const watchStopRequestedRef = useRef(false);\n  const initialCenteredRef = useRef(false);',
);

const oldWatch = `  // ===== GPS =====
  const startWatch = useCallback(() => {
    if (watchIdRef.current != null) return;
    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        const lat = pos.coords.latitude, lng = pos.coords.longitude;
        if (!isBrazilCoordinate(lat, lng)) return;
        const heading = Number.isFinite(pos.coords.heading as number) ? (pos.coords.heading as number) : null;
        const speed = Number.isFinite(pos.coords.speed as number) ? (pos.coords.speed as number) : null;
        setPosition((prev) => {
          if (!prev || Math.abs(prev.lat - lat) > 0.0001 || Math.abs(prev.lng - lng) > 0.0001) {
            if (import.meta.env.DEV) console.log("[APOIS MOTORISTA] localização:", { lat, lng, heading, speed, accuracy: pos.coords.accuracy });
          }
          return { lat, lng, heading, speed };
        });
      },
      (err) => { if (import.meta.env.DEV) console.warn("[APOIS MOTORISTA] watch GPS:", err.message); },
      { enableHighAccuracy: true, maximumAge: 4000, timeout: 15000 },
    );
  }, []);`;

const newWatch = `  // ===== GPS =====
  const stopDriverWatch = useCallback(() => {
    watchStopRequestedRef.current = true;
    const id = watchIdRef.current;
    watchIdRef.current = null;
    if (id == null) return;
    if (typeof id === "string") {
      void Geolocation.clearWatch({ id }).catch((error) => {
        if (import.meta.env.DEV) console.warn("[APOIS MOTORISTA] falha ao encerrar watch GPS nativo:", error);
      });
      return;
    }
    if ("geolocation" in navigator) navigator.geolocation.clearWatch(id);
  }, []);

  const startWatch = useCallback(() => {
    if (watchIdRef.current != null || watchStartingRef.current) return;
    watchStopRequestedRef.current = false;

    const applyCoords = (coords: {
      latitude: number;
      longitude: number;
      heading?: number | null;
      speed?: number | null;
      accuracy?: number | null;
    }) => {
      const lat = coords.latitude, lng = coords.longitude;
      if (!isBrazilCoordinate(lat, lng)) return;
      const heading = Number.isFinite(coords.heading as number) ? (coords.heading as number) : null;
      const speed = Number.isFinite(coords.speed as number) ? (coords.speed as number) : null;
      setPosition((prev) => {
        if (!prev || Math.abs(prev.lat - lat) > 0.0001 || Math.abs(prev.lng - lng) > 0.0001) {
          if (import.meta.env.DEV) console.log("[APOIS MOTORISTA] localização:", { lat, lng, heading, speed, accuracy: coords.accuracy });
        }
        return { lat, lng, heading, speed };
      });
    };

    if (isNativeDriverAndroid()) {
      watchStartingRef.current = true;
      void Geolocation.watchPosition(
        { enableHighAccuracy: true, maximumAge: 4000, timeout: 15000 },
        (nativePosition, error) => {
          if (error) {
            if (import.meta.env.DEV) console.warn("[APOIS MOTORISTA] watch GPS nativo:", error);
            return;
          }
          if (nativePosition?.coords) applyCoords(nativePosition.coords);
        },
      ).then((id) => {
        watchStartingRef.current = false;
        if (watchStopRequestedRef.current) {
          void Geolocation.clearWatch({ id }).catch(() => undefined);
          return;
        }
        watchIdRef.current = id;
      }).catch((error) => {
        watchStartingRef.current = false;
        if (import.meta.env.DEV) console.warn("[APOIS MOTORISTA] não foi possível iniciar watch GPS nativo:", error);
      });
      return;
    }

    watchIdRef.current = navigator.geolocation.watchPosition(
      (webPosition) => applyCoords(webPosition.coords),
      (error) => { if (import.meta.env.DEV) console.warn("[APOIS MOTORISTA] watch GPS web:", error.message); },
      { enableHighAccuracy: true, maximumAge: 4000, timeout: 15000 },
    );
  }, []);`;

if (!source.includes('const stopDriverWatch = useCallback')) {
  if (!source.includes(oldWatch)) throw new Error('[FAIL] Motorista Parceiro: watcher GPS web esperado não encontrado.');
  source = source.replace(oldWatch, newWatch);
}

source = source.replace(
  `    return () => {
      if (watchIdRef.current != null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
    };
  }, []);`,
  `    return () => {
      stopDriverWatch();
    };
  }, [stopDriverWatch]);`,
);

source = source.replace(
  `      if (watchIdRef.current != null && "geolocation" in navigator) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
      setDesiredOnline(false);`,
  `      stopDriverWatch();
      setDesiredOnline(false);`,
);

source = source.replace(
  '  }, [online, statusBlock, activateOnlineWithCoords]);',
  '  }, [online, statusBlock, activateOnlineWithCoords, stopDriverWatch]);',
);

for (const marker of [
  'useRef<number | string | null>(null)',
  'watchStartingRef',
  'watchStopRequestedRef',
  'Geolocation.watchPosition(',
  'Geolocation.clearWatch({ id })',
  'const stopDriverWatch = useCallback',
  'stopDriverWatch();\n      setDesiredOnline(false);',
]) {
  if (!source.includes(marker)) throw new Error(`[FAIL] Motorista Parceiro: watcher GPS nativo incompleto (${marker}).`);
}

writeFileSync(path, source, 'utf8');
console.log('[OK] Motorista Parceiro: acompanhamento contínuo usa Geolocation nativo no Android e encerra o watcher ao ficar offline.');
