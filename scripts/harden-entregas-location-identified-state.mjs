import {readFileSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
const f=resolve(process.env.APOIS_ENTREGAS_WORKSPACE||'.work/entregas','src/routes/enderecos/novo.tsx');
let s=readFileSync(f,'utf8');
function swap(a,b,what){if(s.includes(b))return;const count=s.split(a).length-1;if(count!==1)throw Error('[FAIL] Entregas location '+what);s=s.replace(a,b)}
if(!s.includes('APOIS_ENTREGAS_LOCATION_FORM_STATUS_V2')){
 swap('  const hasPreciseLocation = formData.latitude !== null && formData.longitude !== null;',
 '  // APOIS_ENTREGAS_LOCATION_FORM_STATUS_V2: GPS coordenadas != endereco identificado.\n  const hasPreciseLocation = formData.latitude !== null && formData.longitude !== null;\n  const hasIdentifiedAddress = Boolean(formData.street.trim() && formData.neighborhood.trim() && formData.city.trim() && formData.state.trim());\n  const addressStatus = hasPreciseLocation ? (hasIdentifiedAddress ? "address" : "coordinates") : "missing";','separacao de estados');
 swap('hasPreciseLocation ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-300" : "border-amber-500/20 bg-amber-500/10 text-amber-200"',
 'addressStatus === "address" ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-700" : "border-amber-500/30 bg-amber-500/10 text-amber-800"','cores');
 swap('            {hasPreciseLocation ? (','            {addressStatus === "address" ? (','icone');
 swap('{hasPreciseLocation ? "Localização encontrada" : "Preencha pelo GPS"}',
 '{addressStatus === "address" ? "Endereço identificado" : addressStatus === "coordinates" ? "GPS localizado; endereço não identificado" : "Localize seu endereço"}','titulo');
 swap('{hasPreciseLocation\n                  ? "Os dados encontrados aparecem abaixo. Complete somente o que estiver vazio."\n                  : "Toque em usar minha localização para preencher automaticamente rua, bairro, cidade, UF, CEP e número quando disponível."}',
 '{addressStatus === "address"\n                  ? "Confira rua, bairro, cidade e UF preenchidos; complete número e CEP se estiverem vazios."\n                  : addressStatus === "coordinates"\n                  ? "O aparelho encontrou sua posição, mas não identificou seu endereço. Pesquise pelo endereço ou CEP e preencha os campos obrigatórios."\n                  : "Use sua localização para tentar preencher o endereço, ou pesquise pelo CEP."}','mensagem');
}
for(const v of ['APOIS_ENTREGAS_LOCATION_FORM_STATUS_V2','GPS localizado; endereço não identificado','hasIdentifiedAddress','CustomerLocationAddressSelector'])if(!s.includes(v))throw Error('[FAIL] '+v);
writeFileSync(f,s,'utf8');
console.log('[OK] Entregas: GPS e endereco identificados independentemente; sem falso aviso verde.');
