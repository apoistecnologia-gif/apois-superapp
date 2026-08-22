import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
const workspace = process.env.APOIS_MOTORISTA_WORKSPACE || '.work/partner-motorista';

function patch(relativePath, transform, label) {
  const path = resolve(root, workspace, relativePath);
  const before = readFileSync(path, 'utf8');
  const after = transform(before);
  if (after === before) {
    console.log(`[OK] ${label} (já aplicado/sem alteração)`);
    return;
  }
  writeFileSync(path, after, 'utf8');
  console.log(`[OK] ${label}`);
}

patch('src/routes/motorista.seguranca.tsx', (source) => {
  let next = source;
  if (!next.includes('from "@capacitor/geolocation"')) {
    next = next.replace(
      'import { createFileRoute, useNavigate } from "@tanstack/react-router";',
      'import { createFileRoute, useNavigate } from "@tanstack/react-router";\nimport { Capacitor } from "@capacitor/core";\nimport { Geolocation } from "@capacitor/geolocation";',
    );
  }

  if (!next.includes('async function getPartnerCurrentPosition')) {
    const marker = 'function DriverSecurityPage() {';
    if (!next.includes(marker)) throw new Error('[FAIL] motorista.seguranca.tsx: DriverSecurityPage não encontrado');
    const helper = `async function getPartnerCurrentPosition(timeout = 8000): Promise<{ latitude: number; longitude: number }> {\n  if (Capacitor.isNativePlatform()) {\n    const current = await Geolocation.checkPermissions();\n    let location = current.location;\n    if (location !== \"granted\") {\n      const requested = await Geolocation.requestPermissions({ permissions: [\"location\", \"coarseLocation\"] });\n      location = requested.location;\n    }\n    if (location !== \"granted\") throw new Error(\"location_permission_denied\");\n    const position = await Geolocation.getCurrentPosition({ enableHighAccuracy: true, timeout, maximumAge: 15000 });\n    return { latitude: position.coords.latitude, longitude: position.coords.longitude };\n  }\n  if (!navigator.geolocation) throw new Error(\"geolocation_unavailable\");\n  const position = await new Promise<GeolocationPosition>((resolve, reject) => {\n    navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: true, timeout, maximumAge: 15000 });\n  });\n  return { latitude: position.coords.latitude, longitude: position.coords.longitude };\n}\n\n`;
    next = next.replace(marker, helper + marker);
  }

  const oldSos = `      const pos = await new Promise<GeolocationPosition | null>((resolve) => {\n        if (!navigator.geolocation) return resolve(null);\n        navigator.geolocation.getCurrentPosition(\n          (value) => resolve(value),\n          () => resolve(null),\n          { enableHighAccuracy: true, timeout: 5000, maximumAge: 15_000 },\n        );\n      });\n\n      const lat = pos?.coords.latitude;\n      const lng = pos?.coords.longitude;`;
  const newSos = `      const coords = await getPartnerCurrentPosition(5000).catch(() => null);\n      const lat = coords?.latitude;\n      const lng = coords?.longitude;`;
  if (next.includes(oldSos)) next = next.replace(oldSos, newSos);

  const oldShare = `    if (!navigator.geolocation) {\n      toast.error(\"Localização indisponível neste dispositivo.\");\n      return;\n    }\n\n    setSharingLocation(true);\n    try {\n      const position = await new Promise<GeolocationPosition>((resolve, reject) => {\n        navigator.geolocation.getCurrentPosition(resolve, reject, {\n          enableHighAccuracy: true,\n          timeout: 8000,\n          maximumAge: 15_000,\n        });\n      });\n      const { latitude, longitude } = position.coords;`;
  const newShare = `    setSharingLocation(true);\n    try {\n      const { latitude, longitude } = await getPartnerCurrentPosition(8000);`;
  if (next.includes(oldShare)) next = next.replace(oldShare, newShare);

  if (!next.includes('Geolocation.getCurrentPosition({')) throw new Error('[FAIL] motorista.seguranca.tsx: GPS nativo não aplicado');
  if (next.includes('const pos = await new Promise<GeolocationPosition | null>')) throw new Error('[FAIL] motorista.seguranca.tsx: SOS ainda depende apenas do navigator.geolocation');
  return next;
}, 'motorista: SOS e compartilhamento usam GPS nativo no Android');

patch('src/routes/motorista.configuracoes.tsx', (source) => {
  let next = source;
  if (!next.includes('from "@capacitor/geolocation"')) {
    next = next.replace(
      'import { createFileRoute, useNavigate } from "@tanstack/react-router";',
      'import { createFileRoute, useNavigate } from "@tanstack/react-router";\nimport { Geolocation } from "@capacitor/geolocation";',
    );
  }

  const start = next.indexOf('  function handleTestLocation() {');
  const end = next.indexOf('  function handleClearCache() {', start);
  if (start < 0 || end < 0) {
    if (!next.includes('async function handleTestLocation()')) throw new Error('[FAIL] motorista.configuracoes.tsx: teste de localização não encontrado');
  } else {
    const replacement = `  async function handleTestLocation() {\n    if (testingLocation) return;\n    setTestingLocation(true);\n    try {\n      let lat: number;\n      let lng: number;\n      if (isNative()) {\n        const current = await Geolocation.checkPermissions();\n        let location = current.location;\n        if (location !== \"granted\") {\n          const requested = await Geolocation.requestPermissions({ permissions: [\"location\", \"coarseLocation\"] });\n          location = requested.location;\n        }\n        if (location !== \"granted\") {\n          setLocState(\"denied\");\n          throw new Error(\"location_permission_denied\");\n        }\n        const position = await Geolocation.getCurrentPosition({ enableHighAccuracy: true, timeout: 10000, maximumAge: 0 });\n        lat = position.coords.latitude;\n        lng = position.coords.longitude;\n      } else {\n        if (typeof navigator === \"undefined\" || !navigator.geolocation) {\n          setLocState(\"unsupported\");\n          throw new Error(\"geolocation_unavailable\");\n        }\n        const position = await new Promise<GeolocationPosition>((resolve, reject) => {\n          navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 });\n        });\n        lat = position.coords.latitude;\n        lng = position.coords.longitude;\n      }\n      if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) {\n        throw new Error(\"invalid_location\");\n      }\n      setLocState(\"granted\");\n      toast.success(\"Localização disponível.\");\n    } catch (error) {\n      const denied = error instanceof Error && error.message === \"location_permission_denied\";\n      if (denied) setLocState(\"denied\");\n      toast.error(denied ? \"Permissão de localização negada.\" : \"Não foi possível obter sua localização agora.\");\n    } finally {\n      setTestingLocation(false);\n    }\n  }\n\n`;
    next = next.slice(0, start) + replacement + next.slice(end);
  }

  if (!next.includes('Geolocation.getCurrentPosition({')) throw new Error('[FAIL] motorista.configuracoes.tsx: teste nativo não aplicado');
  return next;
}, 'motorista: diagnóstico de localização usa plugin nativo no Android');

console.log(`[OK] utilidades nativas do Motorista endurecidas em ${workspace}`);
