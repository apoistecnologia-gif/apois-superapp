// Corridas Partner: update NEW advertised driver fee only in ephemeral .work.
// Keep each already-contracted driver's original monthly amount on screen.
// No source submodule, gateway, Supabase table or historic payment is changed.
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root=resolve(process.env.APOIS_MOTORISTA_WORKSPACE || '.work/partner-motorista');
const typesPath=resolve(root,'src/lib/payments/types.ts');
const pagePath=resolve(root,'src/routes/motorista.assinatura.tsx');
const marker='APOIS_DRIVER_NEW_MONTHLY_FEE_5990_V1';

function mustReplace(source,before,after,label){
 if(source.includes(after))return source;
 if(!source.includes(before))throw Error('[FAIL] Driver price source drift: '+label);
 return source.replace(before,after);
}

let types=readFileSync(typesPath,'utf8');
types=mustReplace(types,
 'export const APOIS_MONTHLY_FEE_BRL = 49.9;',
 'export const APOIS_MONTHLY_FEE_BRL = 59.9; // New subscriptions only; existing membership is read from DB.',
 'commercial fee constant in protected snapshot');
if(!types.includes('export const APOIS_MONTHLY_FEE_BRL = 59.9;'))throw Error('[FAIL] Driver new price not updated');

let page=readFileSync(pagePath,'utf8');
if(!page.includes(marker)){
 page=mustReplace(page,
   'type DriverInfo = {\n  approval_status: string;',
   'type DriverInfo = {\n  id: string;\n  approval_status: string;',
   'driver identity for own membership');
 page=mustReplace(page,
   '  const [driver, setDriver] = useState<DriverInfo | null>(null);',
   '  const [driver, setDriver] = useState<DriverInfo | null>(null);\n  const [contractMonthlyFee, setContractMonthlyFee] = useState<number | null>(null); // '+marker,
   'price state');
 page=mustReplace(page,
   '    setLoading(true);\n    setError(null);',
   '    setLoading(true);\n    setError(null);\n    setContractMonthlyFee(null);',
   'reset stale price on reload');
 page=mustReplace(page,
   '.select("approval_status,subscription_status")',
   '.select("id,approval_status,subscription_status")',
   'read own driver id');
 page=mustReplace(page,
   '      setDriver(data);\n    } catch (caughtError)',
   [
    '      // Own-membership SELECT uses existing driver_memberships_read_own RLS.',
    '      // New driver has no membership and sees the 59.90 commercial offer.',
    '      // Existing driver sees the fee actually recorded for their contract.',
    '      const { data: membership, error: contractError } = await supabase',
    '        .from("driver_memberships")',
    '        .select("monthly_fee_cents")',
    '        .eq("driver_id", data.id)',
    '        .maybeSingle();',
    '      if (requestId !== refreshRequestRef.current) return;',
    '      if (contractError) throw new Error("membership_price_unavailable");',
    '      const cents = membership ? Number(membership.monthly_fee_cents) : 5990;',
    '      if (!Number.isInteger(cents) || ![4990, 5990].includes(cents)) throw new Error("unknown_contract_price");',
    '      setContractMonthlyFee(cents / 100);',
    '      setDriver(data);',
    '    } catch (caughtError)',
   ].join('\n'),
   'load membership price via RLS');
 page=mustReplace(page,
   '{formatCurrency(APOIS_MONTHLY_FEE_BRL)}',
   '{contractMonthlyFee === null ? "Valor indisponível" : formatCurrency(contractMonthlyFee)}',
   'show actual contract without guessing');
}
for(const s of [marker,'.from("driver_memberships")','.eq("driver_id", data.id)',"contractMonthlyFee === null",'[4990, 5990]','export']){if(s==='export')continue;if(!page.includes(s))throw Error('[FAIL] Driver price UI marker missing: '+s);}
if(page.includes('{formatCurrency(APOIS_MONTHLY_FEE_BRL)}'))throw Error('[FAIL] Driver price UI still shows unverified global fee');
writeFileSync(typesPath,types,'utf8');
writeFileSync(pagePath,page,'utf8');
console.log('[OK] Motorista: new monthly fee 59.90; existing membership 49.90/59.90 via own-RLS, errors hide unverified amount.');
