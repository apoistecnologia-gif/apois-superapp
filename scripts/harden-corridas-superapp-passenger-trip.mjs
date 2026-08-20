import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

function patch(path, apply, verify, label) {
  const full = resolve(root, path);
  const before = readFileSync(full, 'utf8');
  if (verify(before)) {
    console.log(`[OK] ${label} (já aplicado)`);
    return;
  }
  const after = apply(before);
  if (after === before || !verify(after)) {
    console.error(`[FAIL] ${label}: padrão esperado não encontrado em ${path}`);
    process.exit(1);
  }
  writeFileSync(full, after);
  console.log(`[OK] ${label}`);
}

patch(
  '.work/corridas/src/services/rides/active-ride-service.ts',
  (source) => {
    let out = source.replace(
      '    return this.normalizeRide(data);\n  }\n\n  public async getActiveRide',
      '    return this.hydratePassengerSecurityCode(this.normalizeRide(data));\n  }\n\n  public async getActiveRide',
    );
    out = out.replace(
      '    if (error) throw error;\n    return data ? this.normalizeRide(data) : null;\n  }\n\n  public subscribeToRide',
      '    if (error) throw error;\n    return data ? this.hydratePassengerSecurityCode(this.normalizeRide(data)) : null;\n  }\n\n  private async hydratePassengerSecurityCode(ride: ActiveRide): Promise<ActiveRide> {\n    if (!["motorista_a_caminho", "motorista_chegou"].includes(ride.status)) return ride;\n    try {\n      const { data, error } = await (supabase.rpc as any)("get_passenger_ride_security_code", { _ride_id: ride.id });\n      if (error) throw error;\n      const payload = data && typeof data === "object" ? data as Record<string, unknown> : null;\n      const code = typeof payload?.security_code === "string" ? payload.security_code.trim() : "";\n      return code ? { ...ride, security_code: code } : ride;\n    } catch (error) {\n      console.warn("[ActiveRide] PIN protegido indisponível temporariamente", error);\n      return ride;\n    }\n  }\n\n  public subscribeToRide',
    );
    out = out.replace(
      '        (payload) => {\n          try {\n            const updatedRide = this.normalizeRide(payload.new);',
      '        async (payload) => {\n          try {\n            const updatedRide = await this.hydratePassengerSecurityCode(this.normalizeRide(payload.new));',
    );
    return out;
  },
  (source) => source.includes('hydratePassengerSecurityCode') && source.includes('get_passenger_ride_security_code') && source.includes('await this.hydratePassengerSecurityCode(this.normalizeRide(payload.new))'),
  'corridas passageiro: carrega PIN protegido em leitura, polling e Realtime',
);

patch(
  '.work/corridas/src/components/rides/active/ActiveJourneyScreen.tsx',
  (source) => {
    let out = source.replace(
      'import { useMemo } from "react";',
      'import { useEffect, useMemo, useState } from "react";\nimport { supabase } from "@/integrations/supabase/client";',
    );
    out = out.replace(
      '  const copy = statusCopy(status);\n  const showPin = ["motorista_a_caminho", "motorista_chegou"].includes(status) && Boolean(ride.security_code);',
      '  const copy = statusCopy(status);\n  const showPin = ["motorista_a_caminho", "motorista_chegou"].includes(status) && Boolean(ride.security_code);\n  const [driverPhotoUrl, setDriverPhotoUrl] = useState<string | null>(null);\n\n  useEffect(() => {\n    let cancelled = false;\n    const raw = String(ride.driver_photo ?? "").trim();\n    if (!raw) { setDriverPhotoUrl(null); return () => { cancelled = true; }; }\n    if (/^https?:\\/\\//i.test(raw)) { setDriverPhotoUrl(raw); return () => { cancelled = true; }; }\n    void supabase.storage.from("profile-photos").createSignedUrl(raw, 60 * 60).then(({ data, error }) => {\n      if (cancelled) return;\n      if (error || !data?.signedUrl) {\n        console.warn("[ActiveRide] foto do motorista indisponível", error);\n        setDriverPhotoUrl(null);\n        return;\n      }\n      setDriverPhotoUrl(data.signedUrl);\n    });\n    return () => { cancelled = true; };\n  }, [ride.driver_photo]);',
    );
    out = out.replace(
      '{ride.driver_photo ? (\n                <img src={ride.driver_photo} alt="Foto do motorista" className="h-full w-full object-cover" />',
      '{driverPhotoUrl ? (\n                <img src={driverPhotoUrl} onError={() => setDriverPhotoUrl(null)} alt="Foto do motorista" className="h-full w-full object-cover" />',
    );
    out = out.replace('src="/favicon.png"', 'src="./favicon.png"');
    return out;
  },
  (source) => source.includes('driverPhotoUrl') && source.includes('createSignedUrl(raw, 60 * 60)') && source.includes('src="./favicon.png"'),
  'corridas passageiro: resolve foto privada e branding relativo na corrida ativa',
);

console.log('[OK] corridas passageiro: foto do motorista, PIN protegido e branding corrigidos em .work');
