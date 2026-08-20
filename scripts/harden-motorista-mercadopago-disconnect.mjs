import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
const workspace = process.env.APOIS_MOTORISTA_WORKSPACE || '.work/partner-motorista';
const path = resolve(root, workspace, 'src/components/payments/MercadoPagoSellerCard.tsx');
let source = readFileSync(path, 'utf8');

if (!source.includes('async function disconnect()')) {
  source = source.replace(
    '  const [connecting, setConnecting] = useState(false);',
    '  const [connecting, setConnecting] = useState(false);\n  const [disconnecting, setDisconnecting] = useState(false);',
  );

  source = source.replace(
    '  const connected = status?.connected === true; const connectedAt = dateLabel(status?.connectedAt);',
    `  async function disconnect() {\n    if (disconnecting) return;\n    const confirmed = window.confirm("Desconectar esta conta Mercado Pago da APOIS? Você poderá conectar outra conta em seguida.");\n    if (!confirmed) return;\n    setDisconnecting(true);\n    try {\n      const { error } = await supabase.rpc("disconnect_my_mercadopago_driver");\n      if (error) throw error;\n      toast.success("Conta Mercado Pago desconectada.");\n      await refresh();\n    } catch (error) {\n      console.error("[MercadoPagoSellerCard] disconnect failed", error);\n      toast.error("Não foi possível desconectar a conta Mercado Pago agora.");\n    } finally {\n      setDisconnecting(false);\n    }\n  }\n  const connected = status?.connected === true; const connectedAt = dateLabel(status?.connectedAt);`,
  );

  source = source.replace(
    '    <button type="button" onClick={() => void refresh()} disabled={loading} className="mt-2 flex min-h-10 w-full items-center justify-center gap-2 rounded-xl border border-white/8 bg-white/[0.02] text-[11px] font-black text-zinc-400 disabled:opacity-50"><RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} /> Atualizar status</button>',
    '    {connected ? <button type="button" onClick={() => void disconnect()} disabled={disconnecting} className="mt-2 flex min-h-10 w-full items-center justify-center gap-2 rounded-xl border border-red-400/20 bg-red-400/[0.06] text-[11px] font-black text-red-300 disabled:opacity-50">{disconnecting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}{disconnecting ? "Desconectando…" : "Desconectar Mercado Pago"}</button> : null}\n    <button type="button" onClick={() => void refresh()} disabled={loading} className="mt-2 flex min-h-10 w-full items-center justify-center gap-2 rounded-xl border border-white/8 bg-white/[0.02] text-[11px] font-black text-zinc-400 disabled:opacity-50"><RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} /> Atualizar status</button>',
  );
}

writeFileSync(path, source, 'utf8');
console.log('[OK] motorista: botão seguro para desconectar Mercado Pago adicionado');
