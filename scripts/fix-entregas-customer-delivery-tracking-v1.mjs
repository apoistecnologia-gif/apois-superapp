import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

// Target only the customer module in a future, authorized build.
// Preserve courier confirmation, order/payment backend and other modules.
function edit(relative, transform, markers) {
  const path = resolve('.work/entregas', relative);
  if (!existsSync(path)) throw new Error('[FAIL] Customer source absent: ' + relative);
  const before = readFileSync(path, 'utf8');
  const after = transform(before);
  for (const marker of markers) {
    if (!after.includes(marker)) throw new Error('[FAIL] Tracking verification: ' + marker);
  }
  if (after !== before) writeFileSync(path, after, 'utf8');
  console.log('[OK] Customer tracking patch: ' + relative);
}
function once(source, before, after, label) {
  if (source.includes(after)) return source;
  if (!source.includes(before)) throw new Error('[FAIL] Source changed: ' + label);
  return source.replace(before, after);
}
edit('src/routes/pedido/$orderId/index.tsx', (input) => {
  let source = input;
  source = once(source,
    'import { useCallback, useEffect, useMemo, useState } from "react";',
    'import { useCallback, useEffect, useMemo, useRef, useState } from "react";',
    'useRef for delivered toast');
  source = once(source,
    '  const [loading, setLoading] = useState(true);',
    '  const [loading, setLoading] = useState(true);\n  const lastSeenOrderStatus = useRef<string | null>(null);',
    'track delivered status transition');
  const poll = [
    '  // APOIS_CUSTOMER_ORDER_REFRESH_V1',
    '  // Realtime can miss an update; the order in Supabase is authoritative.',
    '  useEffect(() => {',
    '    if (["delivered", "cancelled", "refunded"].includes(order?.status ?? "")) return;',
    '    let inFlight = false;',
    '    const refreshVisible = () => {',
    '      if (document.visibilityState === "hidden" || inFlight) return;',
    '      inFlight = true;',
    '      void fetchOrder().finally(() => { inFlight = false; });',
    '    };',
    '    const onVisibility = () => {',
    '      if (document.visibilityState === "visible") refreshVisible();',
    '    };',
    '    const timer = window.setInterval(refreshVisible, 12000);',
    '    document.addEventListener("visibilitychange", onVisibility);',
    '    window.addEventListener("focus", refreshVisible);',
    '    return () => {',
    '      window.clearInterval(timer);',
    '      document.removeEventListener("visibilitychange", onVisibility);',
    '      window.removeEventListener("focus", refreshVisible);',
    '    };',
    '  }, [fetchOrder, order?.status]);',
    ''
  ].join('\n');
  if (!source.includes('APOIS_CUSTOMER_ORDER_REFRESH_V1')) {
    source = once(source, '  const cancelOrder = async () => {', poll + '\n  const cancelOrder = async () => {', 'refresh order');
  }
  const notifyDelivered = [
    '  // APOIS_CUSTOMER_DELIVERED_FEEDBACK_V1',
    '  useEffect(() => {',
    '    const status = order?.status ?? null;',
    '    if (status === "delivered" && lastSeenOrderStatus.current && lastSeenOrderStatus.current !== "delivered") {',
    '      toast.success("Pedido entregue! A entrega foi concluída.");',
    '    }',
    '    lastSeenOrderStatus.current = status;',
    '  }, [order?.status]);',
    ''
  ].join('\\n');
  if (!source.includes('APOIS_CUSTOMER_DELIVERED_FEEDBACK_V1')) {
    source = once(source, '  const cancelOrder = async () => {',
      notifyDelivered + '\\n  const cancelOrder = async () => {',
      'show delivered confirmation toast');
  }
  const oldMap = [
    '        {!isPickup && !isCancelled && !isRefunded ? (',
    '          <CustomerDeliveryMap job={deliveryJob} />',
    '        ) : null}'
  ].join('\n');
  const newMap = [
    '        {order.status === "delivered" ? (',
    '          <section role="status" aria-live="polite" className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-5">',
    '            <div className="flex items-center gap-3">',
    '              <CheckCircle2 className="h-8 w-8 shrink-0 text-emerald-500" />',
    '              <div>',
    '                <p className="text-lg font-black text-emerald-700">Entrega concluída!</p>',
    '                <p className="text-sm text-zinc-600">Seu pedido foi entregue com sucesso.</p>',
    '              </div>',
    '            </div>',
    '          </section>',
    '        ) : null}',
    '',
    '        {!isPickup && !isCancelled && !isRefunded && order.status !== "delivered" ? (',
    '          <CustomerDeliveryMap job={deliveryJob} />',
    '        ) : null}'
  ].join('\n');
  source = once(source,oldMap,newMap,'delivery completed banner');
  source = once(
    source,
    '        {!isPickup && deliveryJob?.status === "arrived_destination" ? (',
    '        {!isPickup && order.status !== "delivered" && deliveryJob?.status === "arrived_destination" ? (',
    'hide confirmation PIN after delivery'
  );
  return source;
}, ['APOIS_CUSTOMER_ORDER_REFRESH_V1','APOIS_CUSTOMER_DELIVERED_FEEDBACK_V1','Entrega concluída!', 'order.status !== "delivered"']);

edit('src/components/CustomerDeliveryMap.tsx', (input) => {
  let source = input;
  const before = [
    '    void loadLocation();',
    '',
    '    const channel = supabase'
  ].join('\n');
  const after = [
    '    void loadLocation();',
    '',
    '    // APOIS_CUSTOMER_COURIER_POLL_V1: Realtime is optional; do not freeze the map.',
    '    const onResume = () => {',
    '      if (document.visibilityState === "visible") void loadLocation();',
    '    };',
    '    const timer = window.setInterval(onResume, 15000);',
    '    document.addEventListener("visibilitychange", onResume);',
    '    window.addEventListener("focus", onResume);',
    '',
    '    const channel = supabase'
  ].join('\n');
  source = once(source,before,after,'poll courier location');
  const cleanupBefore = [
    '    return () => {',
    '      disposed = true;',
    '      void supabase.removeChannel(channel);',
    '    };',
    '  }, [job?.courier_id, job?.status]);'
  ].join('\n');
  const cleanupAfter = [
    '    return () => {',
    '      disposed = true;',
    '      window.clearInterval(timer);',
    '      document.removeEventListener("visibilitychange", onResume);',
    '      window.removeEventListener("focus", onResume);',
    '      void supabase.removeChannel(channel);',
    '    };',
    '  }, [job?.courier_id, job?.status]);'
  ].join('\n');
  source = once(source,cleanupBefore,cleanupAfter,'cleanup tracking timers');
  source = once(source,
    '"O mapa de acompanhamento está indisponível neste ambiente."',
    '"Mapa temporariamente indisponível. O status da entrega continua sendo atualizado."',
    'truthful map availability');
  return source;
}, ['APOIS_CUSTOMER_COURIER_POLL_V1','Mapa temporariamente indisponível.']);
