// APOIS_DRIVER_OFFER_POLL_V1: fallback Realtime indisponível/push sem Firebase.
// Mantém a autenticação, RLS, aceite RPC e controles atuais; consulta apenas ofertas do usuário logado.
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
const target = resolve(process.env.APOIS_MOTORISTA_WORKSPACE || '.work/partner-motorista','src/routes/motorista.app.tsx');
const before = readFileSync(target,'utf8');
let source = before;
if (!source.includes('APOIS_DRIVER_OFFER_POLL_V1')) {
  const anchor = '    return () => {\n      supabase.removeChannel(ch);';
  if(source.split(anchor).length!==2) throw new Error('[FAIL] fallback motorista: cleanup do realtime mudou');
  const addition = [
    '    // APOIS_DRIVER_OFFER_POLL_V1: reconsulta ofertas quando Realtime/push falham.',
    '    const offerPoll = window.setInterval(() => {',
    '      if (!navigator.onLine) return;',
    '      if (incomingRef.current || activeRef.current || queuedRideRef.current) return;',
    '      void resyncDriverRides().catch(() => undefined);',
    '    }, 12_000);',
    '',
  ].join('\n');
  source=source.replace(anchor,addition+anchor);
  source=source.replace('      window.clearInterval(poll);','      window.clearInterval(poll);\n      window.clearInterval(offerPoll);');
  writeFileSync(target,source,'utf8');
}
for(const marker of ['APOIS_DRIVER_OFFER_POLL_V1','resyncDriverRides().catch','window.clearInterval(offerPoll)']) {
  if(!source.includes(marker)) throw new Error('[FAIL] fallback motorista incompleto: '+marker);
}
console.log('[OK] Motorista: ofertas reconsultadas a cada 12 segundos enquanto a tela está aberta');
