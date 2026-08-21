import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
const workspace = process.env.APOIS_ENTREGAS_WORKSPACE || '.work/partner-entregador';

function patch(relativePath, transform, verify, label) {
  const path = resolve(root, workspace, relativePath);
  const before = readFileSync(path, 'utf8');
  const after = transform(before);
  if (!verify(after)) throw new Error(`[FAIL] ${label}: contrato esperado não encontrado em ${relativePath}`);
  if (after !== before) writeFileSync(path, after, 'utf8');
  console.log(`[OK] ${label}${after === before ? ' (já aplicado)' : ''}`);
}

patch(
  'src/components/CourierPremiumViews.tsx',
  (source) => {
    let next = source.replace(
      'import { useState } from "react";',
      'import { useEffect, useRef, useState } from "react";',
    );

    const functionAnchor = `export function CourierOfferCard({ offer, busy, onAccept, onReject }: any) {
  const job = offer.delivery_jobs ?? offer;`;
    const enhancedFunction = `export function CourierOfferCard({ offer, busy, onAccept, onReject, onExpire }: any) {
  const job = offer.delivery_jobs ?? offer;
  const [nowMs, setNowMs] = useState(() => Date.now());
  const expiryNotifiedRef = useRef(false);
  const expiresAtMs = offer.expires_at ? new Date(offer.expires_at).getTime() : Number.NaN;
  const remainingSeconds = Number.isFinite(expiresAtMs)
    ? Math.max(0, Math.ceil((expiresAtMs - nowMs) / 1000))
    : null;
  const expired = remainingSeconds === 0;
  const countdownLabel = remainingSeconds == null
    ? "Tempo limitado"
    : expired
      ? "Expirada"
      : String(Math.floor(remainingSeconds / 60)).padStart(2, "0") + ":" + String(remainingSeconds % 60).padStart(2, "0");

  useEffect(() => {
    if (!Number.isFinite(expiresAtMs)) return;
    setNowMs(Date.now());
    const timer = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [expiresAtMs]);

  useEffect(() => {
    if (!expired || expiryNotifiedRef.current) return;
    expiryNotifiedRef.current = true;
    onExpire?.(offer.id);
  }, [expired, offer.id, onExpire]);`;
    if (!next.includes('const countdownLabel = remainingSeconds == null')) {
      if (!next.includes(functionAnchor)) throw new Error('CourierOfferCard não encontrado');
      next = next.replace(functionAnchor, enhancedFunction);
    }

    next = next.replace(
      '<Clock3 className="h-3.5 w-3.5 text-primary" /> Chegou agora',
      '<Clock3 className="h-3.5 w-3.5 text-primary" /> {expired ? "Oferta expirada" : "Expira em " + countdownLabel}',
    );
    next = next.replaceAll(
      'disabled={busy}\n            onClick={() => void onAccept(offer.id)}',
      'disabled={busy || expired}\n            onClick={() => { if (!expired) void onAccept(offer.id); }}',
    );
    next = next.replace(
      '{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Aceitar entrega"}',
      '{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : expired ? "Oferta expirada" : "Aceitar entrega"}',
    );
    next = next.replace(
      'disabled={busy}\n            onClick={() => void onReject(offer.id)}',
      'disabled={busy || expired}\n            onClick={() => { if (!expired) void onReject(offer.id); }}',
    );
    return next;
  },
  (source) =>
    source.includes('useEffect, useRef, useState') &&
    source.includes('remainingSeconds') &&
    source.includes('"Expira em " + countdownLabel') &&
    source.includes('onExpire?.(offer.id)') &&
    source.includes('busy || expired'),
  'entregador: oferta mostra contagem regressiva real e bloqueia aceite após expirar',
);

patch(
  'src/routes/courier.tsx',
  (source) => {
    const anchor = `                    onAccept={acceptOffer}
                    onReject={rejectOffer}`;
    const replacement = `                    onAccept={acceptOffer}
                    onReject={rejectOffer}
                    onExpire={() => courier?.id && void loadCourierOperations(courier.id)}`;
    if (source.includes('onExpire={() => courier?.id && void loadCourierOperations(courier.id)}')) return source;
    if (!source.includes(anchor)) throw new Error('render CourierOfferCard não encontrado');
    return source.replace(anchor, replacement);
  },
  (source) => source.includes('onExpire={() => courier?.id && void loadCourierOperations(courier.id)}'),
  'entregador: oferta expirada é removida imediatamente por nova consulta ao backend',
);

console.log(`[OK] expiração visual das ofertas do Entregador Parceiro endurecida em ${workspace}`);
