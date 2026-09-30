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
    let out = source;

    // Leitura direta por id: hidrata o PIN protegido quando aplicável.
    out = out.replace(
      /return\s+this\.normalizeRide\(data\);/g,
      'return this.hydratePassengerSecurityCode(this.normalizeRide(data));',
    );

    // Leitura da corrida ativa: aceita tanto o snapshot original quanto o
    // snapshot já endurecido pelo adapt-corridas-current.
    out = out.replace(
      /return\s+data\s*\?\s*this\.normalizeRide\(data\)\s*:\s*null;/g,
      'return data ? this.hydratePassengerSecurityCode(this.normalizeRide(data)) : null;',
    );

    if (!out.includes('private async hydratePassengerSecurityCode')) {
      const subscribeMarker = '\n  public subscribeToRide(';
      if (!out.includes(subscribeMarker)) {
        throw new Error('[FAIL] active-ride-service: ponto de inserção do PIN não encontrado');
      }
      const helper = `

  private async hydratePassengerSecurityCode(ride: ActiveRide): Promise<ActiveRide> {
    if (!["motorista_a_caminho", "motorista_chegou"].includes(ride.status)) return ride;
    try {
      const { data, error } = await (supabase.rpc as any)("get_passenger_ride_security_code", { _ride_id: ride.id });
      if (error) throw error;
      const payload = data && typeof data === "object" ? data as Record<string, unknown> : null;
      const code = typeof payload?.security_code === "string" ? payload.security_code.trim() : "";
      return code ? { ...ride, security_code: code } : ride;
    } catch (error) {
      console.warn("[ActiveRide] PIN protegido indisponível temporariamente", error);
      return ride;
    }
  }
`;
      out = out.replace(subscribeMarker, helper + subscribeMarker);
    }

    // Realtime: o payload também precisa passar pela hidratação protegida.
    out = out.replace(
      /(\n\s*)\(payload\)\s*=>\s*\{(\n\s*)try\s*\{(\n\s*)const updatedRide = this\.normalizeRide\(payload\.new\);/,
      '$1async (payload) => {$2try {$3const updatedRide = await this.hydratePassengerSecurityCode(this.normalizeRide(payload.new));',
    );

    return out;
  },
  (source) =>
    source.includes('private async hydratePassengerSecurityCode') &&
    source.includes('get_passenger_ride_security_code') &&
    source.includes('this.hydratePassengerSecurityCode(this.normalizeRide(data))') &&
    source.includes('await this.hydratePassengerSecurityCode(this.normalizeRide(payload.new))'),
  'corridas passageiro: carrega PIN protegido em leitura, polling e Realtime',
);

patch(
  '.work/corridas/src/components/rides/active/DriverCard.tsx',
  (source) => {
    let out = source;
    out = out.replace(
      'import React from "react";',
      'import React, { useEffect, useState } from "react";\nimport { supabase } from "@/integrations/supabase/client";',
    );

    out = out.replace(
      'export const DriverCard: React.FC<DriverCardProps> = ({ ride }) => {\n  if (!ride.driver_id && !ride.driver_name) return null;',
      `export const DriverCard: React.FC<DriverCardProps> = ({ ride }) => {
  const [driverPhotoUrl, setDriverPhotoUrl] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const raw = String(ride.driver_photo ?? "").trim();
    if (!raw) {
      setDriverPhotoUrl(null);
      return () => { cancelled = true; };
    }
    if (/^https?:\\/\\//i.test(raw)) {
      setDriverPhotoUrl(raw);
      return () => { cancelled = true; };
    }
    void supabase.storage.from("profile-photos").createSignedUrl(raw, 60 * 60).then(({ data, error }) => {
      if (cancelled) return;
      setDriverPhotoUrl(error || !data?.signedUrl ? null : data.signedUrl);
    });
    return () => { cancelled = true; };
  }, [ride.driver_photo]);

  if (!ride.driver_id && !ride.driver_name) return null;`,
    );

    out = out.replace(
      '{ride.driver_photo ? (\n          <img\n            src={ride.driver_photo}',
      '{driverPhotoUrl ? (\n          <img\n            src={driverPhotoUrl}\n            onError={() => setDriverPhotoUrl(null)}',
    );

    return out;
  },
  (source) =>
    source.includes('driverPhotoUrl') &&
    source.includes('createSignedUrl(raw, 60 * 60)') &&
    source.includes('onError={() => setDriverPhotoUrl(null)}'),
  'corridas passageiro: foto privada do motorista cai para fallback quando inválida',
);

console.log('[OK] corridas passageiro: foto do motorista, PIN protegido e branding corrigidos em .work');
