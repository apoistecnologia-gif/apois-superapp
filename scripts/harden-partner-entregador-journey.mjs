import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
const workspace = process.env.APOIS_ENTREGAS_WORKSPACE || '.work/partner-entregador';
const path = resolve(root, workspace, 'src/routes/courier.tsx');
let source = readFileSync(path, 'utf8');

if (!source.includes('import { Geolocation } from "@capacitor/geolocation";')) {
  const anchor = 'import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";';
  if (!source.includes(anchor)) throw new Error('Entregador Parceiro: import principal de courier.tsx não encontrado.');
  source = source.replace(anchor, `${anchor}\nimport { Geolocation } from "@capacitor/geolocation";`);
}

const oldBlock = `        if (!navigator.geolocation) {
          throw new Error(
            "Este dispositivo não disponibiliza localização. Ative o GPS para ficar online.",
          );
        }

        const position = await new Promise<GeolocationPosition>((resolve, reject) =>
          navigator.geolocation.getCurrentPosition(resolve, reject, {
            enableHighAccuracy: true,
            timeout: 15000,
            maximumAge: 0,
          }),
        );

        const initialPosition: CourierPosition = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          accuracy: Number.isFinite(position.coords.accuracy) ? position.coords.accuracy : null,
          heading:
            position.coords.heading !== null && Number.isFinite(position.coords.heading)
              ? position.coords.heading
              : null,
          speed:
            position.coords.speed !== null && Number.isFinite(position.coords.speed)
              ? position.coords.speed
              : null,
          recordedAt: Date.now(),
        };`;

const newBlock = `        let coords: {
          latitude: number;
          longitude: number;
          accuracy: number;
          heading?: number | null;
          speed?: number | null;
        };

        if (isNativeCourierAndroid()) {
          let permission = await Geolocation.checkPermissions();
          if (permission.location !== "granted") {
            permission = await Geolocation.requestPermissions({
              permissions: ["location", "coarseLocation"],
            });
          }
          if (permission.location !== "granted") {
            throw new Error("Permita a localização para ficar online e receber entregas próximas.");
          }
          const nativePosition = await Geolocation.getCurrentPosition({
            enableHighAccuracy: true,
            timeout: 20_000,
            maximumAge: 0,
          });
          coords = nativePosition.coords;
        } else {
          if (!navigator.geolocation) {
            throw new Error(
              "Este dispositivo não disponibiliza localização. Ative o GPS para ficar online.",
            );
          }
          const webPosition = await new Promise<GeolocationPosition>((resolve, reject) =>
            navigator.geolocation.getCurrentPosition(resolve, reject, {
              enableHighAccuracy: true,
              timeout: 20_000,
              maximumAge: 0,
            }),
          );
          coords = webPosition.coords;
        }

        const initialPosition: CourierPosition = {
          lat: coords.latitude,
          lng: coords.longitude,
          accuracy: Number.isFinite(coords.accuracy) ? coords.accuracy : null,
          heading:
            coords.heading !== null && coords.heading !== undefined && Number.isFinite(coords.heading)
              ? coords.heading
              : null,
          speed:
            coords.speed !== null && coords.speed !== undefined && Number.isFinite(coords.speed)
              ? coords.speed
              : null,
          recordedAt: Date.now(),
        };`;

if (source.includes(oldBlock)) source = source.replace(oldBlock, newBlock);

for (const marker of [
  'import { Geolocation } from "@capacitor/geolocation";',
  'Geolocation.checkPermissions()',
  'Geolocation.requestPermissions({',
  'Geolocation.getCurrentPosition({',
  'coords = nativePosition.coords;',
  'coords = webPosition.coords;',
]) {
  if (!source.includes(marker)) throw new Error(`Entregador Parceiro: hardening da jornada incompleto (${marker}).`);
}

if (source.includes('const position = await new Promise<GeolocationPosition>')) {
  throw new Error('Entregador Parceiro: toggle online ainda depende exclusivamente da geolocalização WebView.');
}

writeFileSync(path, source, 'utf8');
console.log('[OK] Entregador Parceiro: ficar online usa permissão/GPS nativos no Android e fallback web somente fora do app.');
