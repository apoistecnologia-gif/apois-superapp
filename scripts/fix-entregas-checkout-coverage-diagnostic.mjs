import {existsSync,readFileSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
function patch(path,transform,verify,label){
 const full=resolve('.work/entregas',path);
 if(!existsSync(full)) throw new Error('[FAIL] '+label+': arquivo ausente');
 const before=readFileSync(full,'utf8');
 const after=transform(before);
 if(!verify(after)) throw new Error('[FAIL] '+label+': alteração não aplicada');
 if(before!==after) writeFileSync(full,after,'utf8');
 console.log('[OK] '+label);
}
patch('src/routes/checkout.tsx', (source) => {
  let next = source;
  const before = '      if (fulfillmentType === "delivery" && deliveryQuoteLoading)\n        throw new Error("Aguarde a validação da área de entrega.");\n      if (fulfillmentType === "delivery" && deliveryQuote?.eligible !== true)\n        throw new Error("Este endereço está fora da área de entrega disponível.");';
  const after = '      // Revalida com o servidor no instante do pedido; a prévia pode estar desatualizada.\n      if (fulfillmentType === "delivery" && merchant?.id && address) {\n        const { data: freshQuoteData, error: freshQuoteError } = await (supabase.rpc as any)("preview_delivery_quote", {\n          p_merchant_id: merchant.id,\n          p_delivery_address: address,\n        });\n        if (freshQuoteError) throw new Error("Não foi possível validar a entrega agora. Tente novamente.");\n        const freshQuote = Array.isArray(freshQuoteData) ? freshQuoteData[0] : null;\n        if (!freshQuote) throw new Error("A validação de entrega não retornou um resultado. Tente novamente.");\n        setDeliveryQuote(freshQuote as DeliveryQuote);\n        if (freshQuote.eligible !== true) {\n          const reason = String(freshQuote.reason || "unknown");\n          if (reason === "outside_served_city") throw new Error("O endereço está cadastrado em uma cidade não atendida por esta loja.");\n          if (reason === "outside_default_radius" || reason === "outside_delivery_zone") throw new Error("Cobertura recusada pelo servidor (" + reason + ", distância " + String(freshQuote.distance_km ?? "?") + " km).");\n          if (reason === "coordinates_required") throw new Error("Confirme o ponto exato do endereço no mapa para continuar.");\n          if (reason === "merchant_unavailable") throw new Error("Esta loja não está disponível para esta conta neste momento.");\n          throw new Error("Não foi possível liberar a entrega. Motivo: " + reason);\n        }\n      }';
  if (next.includes(before)) next = next.replace(before, after);
  // Diagnóstico restrito à loja fictícia, sem dados pessoais ou segredos.
  const qaLine = '                      ? "Este endereço está fora da área de entrega disponível."';
  const qaReplacement = '                      ? (merchant?.id === "62f314cd-e792-45bc-8363-bf2b60f2ee58" ? "Teste APOIS: " + String(deliveryQuote.reason) + " · " + String(deliveryQuote.distance_km ?? "?") + " km" : "Este endereço está fora da área de entrega disponível.")';
  if (next.includes(qaLine)) next = next.replace(qaLine, qaReplacement);
  return next;
}, (source) =>
  source.includes('const { data: freshQuoteData, error: freshQuoteError }') &&
  source.includes('setDeliveryQuote(freshQuote as DeliveryQuote)') &&
  !source.includes('if (fulfillmentType === "delivery" && deliveryQuoteLoading)\n        throw new Error("Aguarde a validação da área de entrega.");'),
'Entregas: confirma cobertura novamente no servidor antes do pedido e informa razão real do bloqueio');

