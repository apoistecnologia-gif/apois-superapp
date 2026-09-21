import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
const workspace = process.env.APOIS_CORRIDAS_WORKSPACE || '.work/corridas';
const full = (p) => resolve(root, workspace, p);
const read = (p) => readFileSync(full(p), 'utf8');
const write = (p, s) => writeFileSync(full(p), s, 'utf8');

function replaceRequired(source, search, replacement, label) {
  if (source.includes(replacement)) return source;
  if (!source.includes(search)) throw new Error('[FAIL] ' + label + ': padrão não encontrado');
  return source.replace(search, replacement);
}

{
  const p = 'src/services/payments/payment-service.ts';
  let s = read(p);
  s = replaceRequired(
    s,
    '      const isActive = method.is_active === true;\n      const isDirectToDriver = code === "cash" || code === "credit";\n      if (!isActive || !isDirectToDriver) return [];',
    '      const isActive = method.is_active === true;\n      const safe2PayPixEnabled = import.meta.env["VITE_APOIS_SAFE2PAY_PIX_ENABLED"] === "1";\n      const isDirectToDriver = code === "cash" || code === "credit";\n      const isSafe2PayPix = code === "pix" && safe2PayPixEnabled;\n      if (!isActive || (!isDirectToDriver && !isSafe2PayPix)) return [];',
    'Corridas payment methods',
  );
  s = s.replace(
    '      const description =\n        code === "cash"\n          ? "Pague diretamente ao motorista em dinheiro ao final da corrida."\n          : "Pague diretamente ao motorista no cartão de crédito, usando o meio aceito pelo próprio motorista.";',
    '      const description =\n        code === "cash"\n          ? "Pague diretamente ao motorista em dinheiro ao final da corrida."\n          : code === "credit"\n            ? "Pague diretamente ao motorista no cartão de crédito, usando o meio aceito pelo próprio motorista."\n            : "PIX processado pela Safe2Pay após um motorista aceitar a corrida.";',
  );
  write(p, s);
}

{
  const p = 'src/hooks/rides/use-ride-request.tsx';
  let s = read(p);
  if (!s.includes('import { usePaymentMethods } from "@/hooks/use-payment-methods";')) {
    s = s.replace(
      'import { useRoute } from "@/hooks/use-route";',
      'import { useRoute } from "@/hooks/use-route";\nimport { usePaymentMethods } from "@/hooks/use-payment-methods";',
    );
  }
  if (!s.includes('const { selectedMethod } = usePaymentMethods();')) {
    s = s.replace(
      '  const { route } = useRoute();',
      '  const { route } = useRoute();\n  const { selectedMethod } = usePaymentMethods();',
    );
  }
  s = s.replace(
    '        duration_min: route.durationSeconds / 60,\n        service_details: {},',
    '        duration_min: route.durationSeconds / 60,\n        payment_method: selectedMethod,\n        service_details: selectedMethod === "pix" ? { payment_flow: "safe2pay_marketplace" } : {},',
  );
  s = s.replace(
    '  }, [user, selectedCategory, route, request.requestKey]);',
    '  }, [user, selectedCategory, route, request.requestKey, selectedMethod]);',
  );
  if (!s.includes('payment_method: selectedMethod')) throw new Error('[FAIL] Corridas: payment method não persistido');
  write(p, s);
}

{
  const p = 'src/types/rides/active-ride.ts';
  let s = read(p);
  if (!s.includes('| "aguardando_pagamento"')) {
    s = s.replace('  | "procurar_motorista"', '  | "procurar_motorista"\n  | "aguardando_pagamento"');
  }
  if (!s.includes('payment_status?: string;')) {
    s = s.replace('  payment_method: string;', '  payment_method: string;\n  payment_status?: string;\n  payment_provider?: string;');
  }
  write(p, s);
}

{
  const p = 'src/services/rides/active-ride-service.ts';
  let s = read(p);
  s = s.replace(
    '  "procurar_motorista",\n  "motorista_a_caminho",',
    '  "procurar_motorista",\n  "aguardando_pagamento",\n  "motorista_a_caminho",',
  );
  s = s.replace(
    '  procurar_motorista: 1,\n  motorista_a_caminho: 2,\n  motorista_chegou: 3,\n  em_viagem: 4,\n  finalizada: 5,\n  cancelada_passageiro: 5,\n  cancelada_motorista: 5,',
    '  procurar_motorista: 1,\n  aguardando_pagamento: 2,\n  motorista_a_caminho: 3,\n  motorista_chegou: 4,\n  em_viagem: 5,\n  finalizada: 6,\n  cancelada_passageiro: 6,\n  cancelada_motorista: 6,',
  );
  s = s.replace(
    '      payment_method: readRequiredString(data, "payment_method"),',
    '      payment_method: readRequiredString(data, "payment_method"),\n      payment_status: readOptionalString(data, "payment_status"),\n      payment_provider: readOptionalString(data, "payment_provider"),',
  );
  s = s.replace(
    '      canCancel: ["procurar_motorista", "motorista_a_caminho"].includes(status),',
    '      canCancel: ["procurar_motorista", "aguardando_pagamento", "motorista_a_caminho"].includes(status),',
  );
  write(p, s);
}

{
  const p = 'src/components/rides/active/RideStatusHeader.tsx';
  let s = read(p);
  if (!s.includes('case "aguardando_pagamento":')) {
    s = s.replace(
      '      case "motorista_a_caminho":',
      '      case "aguardando_pagamento":\n        return {\n          title: "Motorista reservado",\n          subtitle: "Conclua o PIX Safe2Pay para liberar o deslocamento",\n          icon: <Search className="animate-pulse text-apois-yellow" size={20} />,\n          color: "bg-apois-yellow/10 border-apois-yellow/20",\n        };\n      case "motorista_a_caminho":',
    );
  }
  write(p, s);
}

{
  const p = 'src/components/payments/Safe2PayRidePixCard.tsx';
  const s = [
    'import React, { useCallback, useEffect, useRef, useState } from "react";',
    'import { supabase } from "@/integrations/supabase/client";',
    'import { Button } from "@/components/ui/button";',
    'import { Check, Copy, Loader2, QrCode } from "lucide-react";',
    '',
    'type Props = { rideId: string; amount: number; onPaid: () => void };',
    '',
    'export function Safe2PayRidePixCard({ rideId, amount, onPaid }: Props) {',
    '  const [busy, setBusy] = useState(false);',
    '  const [transactionId, setTransactionId] = useState<number | null>(null);',
    '  const [copyPaste, setCopyPaste] = useState<string | null>(null);',
    '  const [qrCodeBase64, setQrCodeBase64] = useState<string | null>(null);',
    '  const [status, setStatus] = useState<string>("pending");',
    '  const [error, setError] = useState<string | null>(null);',
    '  const paidRef = useRef(false);',
    '',
    '  const check = useCallback(async () => {',
    '    const result = await supabase.functions.invoke("safe2pay-payment-status", {',
    '      body: { resource_type: "ride", resource_id: rideId },',
    '    });',
    '    if (result.error) return;',
    '    const next = String(result.data?.transaction?.status ?? "pending");',
    '    setStatus(next);',
    '    if (next === "authorized" && !paidRef.current) { paidRef.current = true; onPaid(); }',
    '  }, [onPaid, rideId]);',
    '',
    '  useEffect(() => {',
    '    if (!transactionId || paidRef.current) return;',
    '    const timer = window.setInterval(() => void check(), 4000);',
    '    void check();',
    '    return () => window.clearInterval(timer);',
    '  }, [check, transactionId]);',
    '',
    '  const generate = async () => {',
    '    if (busy) return;',
    '    setBusy(true); setError(null);',
    '    try {',
    '      const result = await supabase.functions.invoke("safe2pay-create-ride-pix", { body: { ride_id: rideId } });',
    '      if (result.error) throw result.error;',
    '      const id = Number(result.data?.transactionId);',
    '      if (Number.isInteger(id) && id > 0) setTransactionId(id);',
    '      const code = typeof result.data?.pix?.copyPaste === "string" ? result.data.pix.copyPaste : null;',
    '      const image = typeof result.data?.pix?.qrCodeBase64 === "string" ? result.data.pix.qrCodeBase64 : null;',
    '      if (!code) throw new Error("pix_unavailable");',
    '      setCopyPaste(code); setQrCodeBase64(image); setStatus(String(result.data?.status ?? "pending"));',
    '      if (String(result.data?.status) === "authorized") onPaid();',
    '    } catch { setError("Não foi possível gerar o PIX agora. Tente novamente."); }',
    '    finally { setBusy(false); }',
    '  };',
    '',
    '  const copy = async () => { if (copyPaste) await navigator.clipboard.writeText(copyPaste); };',
    '  const imageSrc = qrCodeBase64 ? (qrCodeBase64.startsWith("data:") ? qrCodeBase64 : "data:image/png;base64," + qrCodeBase64) : null;',
    '',
    '  return (',
    '    <div className="space-y-3 rounded-2xl border border-apois-yellow/20 bg-apois-yellow/5 p-4">',
    '      <div className="flex items-center gap-3"><div className="flex h-10 w-10 items-center justify-center rounded-xl bg-apois-yellow/15 text-apois-yellow"><QrCode size={20} /></div><div><p className="text-sm font-black text-white">PIX Safe2Pay</p><p className="text-[11px] text-zinc-400">R$ {amount.toFixed(2).replace(".", ",")} • motorista reservado</p></div></div>',
    '      {!copyPaste ? <Button onClick={() => void generate()} disabled={busy} className="h-12 w-full rounded-xl bg-apois-yellow font-black text-black">{busy ? <Loader2 className="mr-2 animate-spin" size={18} /> : null}Gerar PIX</Button> : <>',
    '        {imageSrc ? <img alt="QR Code PIX" className="mx-auto h-44 w-44 rounded-xl bg-white p-2" src={imageSrc} /> : null}',
    '        <button type="button" onClick={() => void copy()} className="flex w-full items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 p-3 text-xs font-bold text-white"><Copy size={16} /> Copiar código PIX</button>',
    '        <p className="text-center text-[11px] text-zinc-400">{status === "authorized" ? <span className="inline-flex items-center gap-1 text-green-400"><Check size={14}/> Pagamento confirmado</span> : "Aguardando confirmação da Safe2Pay..."}</p>',
    '      </>}',
    '      {error ? <p className="text-center text-xs font-bold text-red-400">{error}</p> : null}',
    '    </div>',
    '  );',
    '}',
    '',
  ].join('\n');
  write(p, s);
}

{
  const p = 'src/routes/_authenticated.corrida.$rideId.tsx';
  let s = read(p);
  if (!s.includes('Safe2PayRidePixCard')) {
    s = s.replace(
      'import { Button } from "@/components/ui/button";',
      'import { Button } from "@/components/ui/button";\nimport { Safe2PayRidePixCard } from "@/components/payments/Safe2PayRidePixCard";',
    );
    s = s.replace(
      '{status === "procurar_motorista" && (',
      '{status === "aguardando_pagamento" && ride.payment_method === "pix" && (\n              <Safe2PayRidePixCard rideId={ride.id} amount={ride.final_price ?? ride.estimated_price} onPaid={() => void refreshRide()} />\n            )}\n\n            {status === "procurar_motorista" && (',
    );
  }
  write(p, s);
}


{
  const p = 'supabase/functions/request-ride/index.ts';
  let source = read(p);
  const marker = '    const body = (await req.json()) as RequestBody;';
  const hardened = '    const body = (await req.json()) as RequestBody;\n    const paymentMethod = String(body.payment_method ?? "").trim().toLowerCase();\n    if (!["cash", "credit", "pix"].includes(paymentMethod)) {\n      return json({ error: "invalid_payment_method" }, 422, req);\n    }\n    if (paymentMethod === "pix") {\n      const { data: electronicSetting, error: electronicSettingError } = await admin\n        .from("app_settings")\n        .select("value")\n        .eq("key", "finance.ride_electronic_payments_enabled")\n        .maybeSingle();\n      if (electronicSettingError) return json({ error: "payment_setting_failed" }, 500, req);\n      const electronicEnabled = electronicSetting?.value === true || String(electronicSetting?.value).toLowerCase() === "true";\n      if (!electronicEnabled) return json({ error: "electronic_payments_disabled" }, 503, req);\n    }';
  source = replaceRequired(source, marker, hardened, 'Corridas request-ride: payment method allowlist');
  source = source.replace(
    '        payment_method: body.payment_method?.trim() || null,',
    '        payment_method: paymentMethod,',
  );
  write(p, source);
}


{
  const p = 'src/hooks/rides/use-active-ride.tsx';
  let source = read(p);
  source = source.replace(
    '  procurar_motorista: 1,\n  motorista_a_caminho: 2,\n  motorista_chegou: 3,\n  em_viagem: 4,\n  finalizada: 5,\n  cancelada_passageiro: 5,\n  cancelada_motorista: 5,',
    '  procurar_motorista: 1,\n  aguardando_pagamento: 2,\n  motorista_a_caminho: 3,\n  motorista_chegou: 4,\n  em_viagem: 5,\n  finalizada: 6,\n  cancelada_passageiro: 6,\n  cancelada_motorista: 6,',
  );
  if (!source.includes('aguardando_pagamento: 2')) {
    throw new Error('[FAIL] Corridas: use-active-ride não reconhece aguardando_pagamento');
  }
  write(p, source);
}

console.log('[OK] Corridas: Safe2Pay Pix staged behind VITE_APOIS_SAFE2PAY_PIX_ENABLED.');
