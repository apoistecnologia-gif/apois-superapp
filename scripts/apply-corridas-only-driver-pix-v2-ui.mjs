/**
 * Staged checkout UI patch for disposable .work/partner-motorista only.
 * Activation requires TWO distinct backend-authorized gates:
 *   VITE_APOIS_MEMBERSHIP_PIX_V2_UI=true in homologated rebuild, and
 *   bank config / verified ledger in the server (never controlled by client).
 * This script MUST run after the R$99.90 plan display patch.
 */
import {readFileSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
const file=resolve('.work/partner-motorista/src/routes/motorista.assinatura.tsx');
let ui=readFileSync(file,'utf8');
const marker='APOIS_DRIVER_PIX_V2_UI_STAGED';
if(ui.includes(marker))throw Error('[FAIL] Staged Pix UI unexpectedly applied twice');
if(!ui.includes('// APOIS_CORRIDAS_ONLY_MEMBERSHIP_9990_DISPLAY_V2') ||
   !ui.includes('Nenhum gateway de cobrança está ativo'))
  throw Error('[FAIL] Must first stage official price and disabled legacy gateway');
for(const forbidden of ['asaas-create-driver-membership','mercadopago-create-driver-membership','generateMembershipPix'])
  if(ui.includes(forbidden))throw Error('[FAIL] Legacy checkout must stay disabled');
const first='import { useEffect, useRef, useState } from "react";';
if(ui.split(first).length!==2)throw Error('[FAIL] Driver React imports changed');
const start='<DSCard className="min-w-0 border-[#F6BE1C]/20 bg-[#0D0F11] p-5" role="status">';
const a=ui.indexOf(start);
const b=ui.indexOf('</DSCard>',a);
if(a<0||b<a||ui.indexOf(start,a+1)>=0)throw Error('[FAIL] Disabled gateway card changed');
const card=ui.slice(a,b+'</DSCard>'.length);
if(!card.includes('Pagamento eletrônico temporariamente indisponível') ||
   !card.includes('Nenhum gateway de cobrança está ativo'))throw Error('[FAIL] Disabled CTA drift');
ui=ui.slice(0,a)+
  '{APOIS_PIX_V2_UI_ENABLED ? <DriverMembershipPixV2 /> : ('+card+')}' +
  ui.slice(b+'</DSCard>'.length);
ui=ui.replace('export const Route = createFileRoute(" /','export const Route = createFileRoute(" /'); // no-op: never alter route registration
const label='// '+marker+'\n';
const constant="const APOIS_PIX_V2_UI_ENABLED = import.meta.env.VITE_APOIS_MEMBERSHIP_PIX_V2_UI === 'true';\n";
ui=label+constant+ui;
const component=String.raw`
type DriverPixV2Charge = {
  id: string; provider: string; amountCents: number; status: string;
  pixPayload: string | null; pixQrCodeBase64: string | null;
  pixExpirationAt: string | null; dueDate: string | null; paidAt: string | null;
};
type DriverPixV2Status = {
  ok: boolean; approved: boolean; futureFeeCents: number | null;
  pixEnabled: boolean; operationalByVerifiedMembership: boolean;
  membership: null | {
    contractualFeeCents: number; paidThrough: string | null;
    status: string; nextDueDate: string | null;
  }; charges: DriverPixV2Charge[];
};
type DriverPixV2Checkout = {
  ok: boolean; chargeId?: string; provider?: string; amountCents?: number;
  pixPayload?: string | null; pixQrCodeBase64?: string | null;
  pendingGeneration?: boolean; bankConfirmationAwaitingSettlement?: boolean;
  pixExpirationAt?: string | null;
};
const apoisPixV2Date = (value: string | null | undefined) => {
  if (!value) return null;
  const dt = new Date(value);
  return Number.isFinite(dt.getTime()) ? dt.toLocaleDateString("pt-BR") : null;
};

function DriverMembershipPixV2() {
  const [data,setData]=useState<DriverPixV2Status | null>(null);
  const [checkout,setCheckout]=useState<DriverPixV2Checkout | null>(null);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState<string | null>(null);

  async function refresh() {
    try {
      const result = await supabase.functions.invoke<DriverPixV2Status>(
        "apois-driver-membership-status-v2",{method:"GET"}
      );
      if (result.error || !result.data?.ok) throw new Error("status_unavailable");
      setData(result.data);
      setError(null);
    } catch {
      setError("Não foi possível confirmar a assinatura com o servidor.");
    }
  }
  useEffect(()=>{
    void refresh();
    // No constant polling when app is backgrounded. Entitlement remains server-only.
    const timer=window.setInterval(()=>{
      if (document.visibilityState==="visible") void refresh();
    },30000);
    const onResume=()=>{if(document.visibilityState==="visible")void refresh();};
    document.addEventListener("visibilitychange",onResume);
    return ()=>{window.clearInterval(timer);document.removeEventListener("visibilitychange",onResume);};
  },[]);

  const offeredFee=data?.futureFeeCents;
  const oldContract=!!data?.membership &&
    data.membership.contractualFeeCents!==9990;
  const mayCreate=!!data?.ok && data.approved && data.pixEnabled &&
    offeredFee===9990 && !oldContract && !busy;
  const paid=data?.operationalByVerifiedMembership===true;
  const history=data?.charges??[];
  const open=history.find(c=>["pending","confirmed"].includes(c.status))??null;
  const pixCode=checkout?.pixPayload??open?.pixPayload??"";
  const qrCode=checkout?.pixQrCodeBase64??open?.pixQrCodeBase64??null;
  const awaitingBank=checkout?.bankConfirmationAwaitingSettlement===true;

  async function requestPix() {
    if(!mayCreate) return;
    setBusy(true);setError(null);
    try {
      const result = await supabase.functions.invoke<DriverPixV2Checkout>(
        "apois-driver-membership-checkout-v2",{body:{}}
      );
      if(result.error||!result.data?.ok)throw Error("checkout_unavailable");
      if(result.data.amountCents!==9990 &&
         result.data.amountCents!==4990 && result.data.amountCents!==5990)
        throw Error("bank_amount_inconsistent");
      setCheckout(result.data);
      await refresh();
    } catch {
      setError("A cobrança não foi confirmada no servidor. Não tente pagar outro Pix até consultar o status.");
    } finally {
      setBusy(false);
    }
  }

  async function copyPix() {
    if(!pixCode)return;
    try {
      await navigator.clipboard.writeText(pixCode);
    } catch {
      setError("Não foi possível copiar. Selecione o código Pix manualmente.");
    }
  }
  return (
    <DSCard className="min-w-0 rounded-2xl border border-[#E51B23]/25 bg-[#0D0F11] p-5" role="region">
      <p className="text-xs font-black uppercase tracking-widest text-[#F87171]">
        PLANO MOTORISTA APOIS
      </p>
      <h2 className="mt-2 text-2xl font-black text-white">
        {data?.membership && paid
          ? formatCurrency(data.membership.contractualFeeCents/100)
          : "R$ 99,90"} <span className="text-sm font-semibold">/ mês</span>
      </h2>
      <p className="mt-2 text-sm text-zinc-300">100% do valor das corridas para você.</p>
      {error ? <p role="alert" className="mt-3 text-xs font-bold text-red-300">{error}</p> : null}
      {!data ? <p role="status" className="mt-4 text-xs text-zinc-400">Consultando assinatura no servidor...</p> : (
        <div className="mt-4 space-y-3">
          <p role="status" className="text-sm font-bold text-white">
            {paid ? "Mensalidade ativa" :
             oldContract ? "Contrato anterior: consulte o suporte para renovação" :
             !data.approved ? "Cadastro em análise" :
             !data.pixEnabled ? "Pix indisponível até a homologação" :
             "Pagamento pendente"}
          </p>
          {data.membership?.paidThrough ?
            <p className="text-xs text-zinc-300">Válida até {apoisPixV2Date(data.membership.paidThrough)}</p> : null}
          {!paid && !oldContract ? (
            <DSButton className="min-h-12 w-full bg-[#E51B23] text-white"
              disabled={!mayCreate} onClick={()=>void requestPix()}>
              {busy ? "Consultando cobrança..." : open ? "Consultar Pix existente" : "Gerar Pix de R$ 99,90"}
            </DSButton>
          ) : null}
          {awaitingBank ? <p className="text-xs text-amber-200">
            O banco informou pagamento, aguardando validação e ativação do servidor.
          </p> : null}
          {pixCode && !paid ? (
            <div className="space-y-3">
              <p className="text-xs font-semibold text-zinc-300">Aguardando confirmação bancária.</p>
              {qrCode ? <div className="mx-auto w-fit rounded-xl bg-white p-2">
                <img alt="QR Code Pix da mensalidade APOIS" className="h-44 w-44"
                  src={"data:image/png;base64,"+qrCode}/>
              </div> : null}
              <p className="break-all select-text text-xs text-zinc-300">{pixCode}</p>
              <DSButton variant="outline" className="min-h-11 w-full"
                onClick={()=>void copyPix()}>Copiar Pix</DSButton>
            </div>
          ) : null}
          {history.length ? (
            <div className="space-y-2 border-t border-white/10 pt-3">
              <p className="text-xs font-black text-zinc-200">Histórico de mensalidades</p>
              {history.slice(0,5).map(c=>(
                <p className="text-xs text-zinc-400" key={c.id}>
                  {apoisPixV2Date(c.paidAt??c.dueDate)} · {formatCurrency(c.amountCents/100)} · {c.status}
                </p>
              ))}
            </div>
          ) : null}
        </div>
      )}
      <p className="mt-4 text-xs text-zinc-500">
        A liberação para receber novas corridas depende de confirmação no backend.
      </p>
    </DSCard>
  );
}
`;
writeFileSync(file,ui+component,'utf8');
console.log('[OK] Staged Motorista Pix V2 UI present; build flag false by default, no bank operation');
