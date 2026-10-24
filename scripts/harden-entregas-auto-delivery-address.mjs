import {readFileSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
// APOIS_ENTREGAS_AUTO_ADDRESS_V1: respect saved address, first-use GPS, no loop.
const p=resolve('.work/entregas/src/routes/inicio.tsx');
let s=readFileSync(p,'utf8');
const formPath=resolve('.work/entregas/src/routes/enderecos/novo.tsx');
let form=readFileSync(formPath,'utf8');
// O snapshot do formulario pode ter sido normalizado por outro hardener.
// Restabelece somente a sinalizacao GPS, preservando campos/validacoes.
if(!form.includes('apois_auto_locate_new_address')){
  const state='  const [autoLocate, setAutoLocate] = useState(false);';
  if(!form.includes(state)||!form.includes('setAutoLocate(true)')||!form.includes('useEffect(')){
    throw Error('[FAIL] Entregas: formulario nao suporta restauracao segura do gatilho GPS');
  }
  const effect=[
    '  // APOIS_ENTREGAS_AUTO_ADDRESS_V1: abre confirmacao GPS somente na primeira visita.',
    '  useEffect(() => {',
    '    if (sessionStorage.getItem("apois_auto_locate_new_address") === "1") {',
    '      sessionStorage.removeItem("apois_auto_locate_new_address");',
    '      setAutoLocate(true);',
    '    }',
    '  }, []);',
  ].join('\\n');
  form=form.replace(state,state+'\\n'+effect);
  writeFileSync(formPath,form,'utf8');
}
if(!s.includes('APOIS_ENTREGAS_AUTO_ADDRESS_V1')){
  const needle='      setDefaultAddress(addrData);';
  if(s.split(needle).length!==2)throw Error('[FAIL] Home Entregas: setDefaultAddress changed');
  const added=[
    '      setDefaultAddress(addrData);',
    '      // APOIS_ENTREGAS_AUTO_ADDRESS_V1: nunca sobrepor enderecos existentes.',
    '      if (!addrData && sessionStorage.getItem("apois_delivery_auto_address_prompted_v1") !== "1") {',
    '        const { count, error: countError } = await supabase.from("customer_addresses")',
    '          .select("id", { count: "exact", head: true }).eq("user_id", user.id);',
    '        if (!countError && count === 0) {',
    '          sessionStorage.setItem("apois_delivery_auto_address_prompted_v1", "1");',
    '          sessionStorage.setItem("apois_auto_locate_new_address", "1");',
    '          void navigate({ to: "/enderecos/novo", replace: true });',
    '          return;',
    '        }',
    '      }',
  ].join('\n');
  s=s.replace(needle,added);
  const at=s.indexOf('const fetchData = useCallback(');
  const end=s.indexOf('  }, []);',at);
  if(at<0||end<0)throw Error('[FAIL] Entregas: fetchData useCallback signature missing');
  s=s.slice(0,end)+s.slice(end).replace('  }, []);','  }, [navigate]);');
  const target='onClick={() => navigate({ to: "/enderecos" })}';
  if(!s.includes(target))throw Error('[FAIL] Entregas: address edit action missing');
  s=s.replace(target,target+' aria-label="Ver ou alterar endereço de entrega"');
}
for(const k of ['APOIS_ENTREGAS_AUTO_ADDRESS_V1','apois_delivery_auto_address_prompted_v1','apois_auto_locate_new_address','onClick={() => navigate({ to: "/enderecos" })}'])
  if(!s.includes(k))throw Error('[FAIL] Entregas auto-endereco '+k);
for(const k of ['apois_auto_locate_new_address','setAutoLocate(true)','handleCEPBlur','https://viacep.com.br/ws/','CustomerLocationAddressSelector'])
  if(!form.includes(k))throw Error('[FAIL] Entregas CEP/GPS: '+k);
writeFileSync(p,s,'utf8');
console.log('[OK] Entregas: GPS no primeiro uso, endereco salvo preservado, clique para mudar e CEP no formulario');