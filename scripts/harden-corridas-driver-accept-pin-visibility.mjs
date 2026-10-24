// APOIS_PIN_AFTER_ACCEPT_V1 — Cliente. PIN apenas via RPC autenticada, nao public.rides.
import {readFileSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
const root=resolve(process.env.APOIS_CORRIDAS_WORKSPACE||'.work/corridas');
function patch(file,fn){const full=resolve(root,file);const before=readFileSync(full,'utf8');const after=fn(before);if(after!==before)writeFileSync(full,after,'utf8');console.log('[OK] PIN '+file);}
function replace(src,oldStr,newStr,label){if(src.includes(newStr))return src;if(src.split(oldStr).length!==2)throw Error('[FAIL] PIN: '+label);return src.replace(oldStr,newStr);}
patch('src/hooks/rides/use-active-ride.tsx',src=>replace(src,
  '  const { user } = useAuth();\n  const userId = user?.id ?? null;',
  '  // APOIS_ACTIVE_RIDE_DOMAIN_USER_V1: rides.passenger_id é public.users.id\n  const { profile } = useAuth();\n  const userId = profile?.id ?? null;',
  'identidade domain user'));
patch('src/routes/_authenticated.corrida.$rideId.tsx',src=>{
  if(src.includes('APOIS_PIN_AFTER_ACCEPT_V1'))return src;
  src=replace(src,
    'import { SecurityCodeCard } from "@/components/rides/active/SecurityCodeCard";',
    'import { SecurityCodeCard } from "@/components/rides/active/SecurityCodeCard";\nimport { supabase } from "@/integrations/supabase/client";',
    'import RPC');
  const anchor='  const [isCancelDialogOpen, setIsCancelDialogOpen] = useState(false);';
  const hook=[
    '  // APOIS_PIN_AFTER_ACCEPT_V1: so o passageiro ve o PIN; o motorista deve solicita-lo pessoalmente.',
    '  const [passengerPin,setPassengerPin]=useState<string|null>(null);',
    '  const [pinPending,setPinPending]=useState(false);',
    '  useEffect(()=>{',
    '    let cancelled=false;',
    '    let timer:number|undefined;',
    '    setPassengerPin(null);',
    '    const eligible=status==="motorista_a_caminho"||status==="motorista_chegou";',
    '    if(!rideId||!eligible)return ()=>{cancelled=true;};',
    '    setPinPending(true);',
    '    const retrieve=async()=>{',
    '      try{',
    '        // O snapshot usa tipos gerados anteriores à RPC; autorização fica no SQL de produção.',
    '        const {data,error}=await supabase.rpc("get_passenger_ride_security_code" as never,{_ride_id:rideId} as never);',
    '        if(cancelled)return;',
    '        const payload:unknown=data;',
    '        if(error)throw Error("pin_rpc_failed");',
    '        if(payload&&typeof payload==="object"&&"ok" in payload&&(payload as {ok?:unknown}).ok===true&&"security_code" in payload){',
    '          const candidate=(payload as {security_code:unknown}).security_code;',
    '          if(typeof candidate==="string"&&/^\\d{4}$/.test(candidate)){',
    '            setPassengerPin(candidate);',
    '            setPinPending(false);',
    '            return;',
    '          }',
    '        }',
    '      }catch{ /* jamais inventar PIN ou expor segredo nos logs */ }',
    '      if(!cancelled)timer=window.setTimeout(()=>void retrieve(),7000);',
    '    };',
    '    void retrieve();',
    '    return ()=>{cancelled=true;if(timer!==undefined)window.clearTimeout(timer);};',
    '  },[rideId,status]);',
  ].join('\n');
  src=replace(src,anchor,anchor+'\n'+hook,'hook de seguranca');
  const oldCard='                {["motorista_a_caminho", "motorista_chegou"].includes(status) && (\n                  <SecurityCodeCard code={ride.security_code} />\n                )}';
  if(src.split(oldCard).length!==2)throw Error('[FAIL] PIN: antigo card ausente');
  src=src.replace(oldCard,'');
  const section='            {status !== "procurar_motorista" && status !== "agendada" && (';
  const card=[
    '            {(status === "motorista_a_caminho" || status === "motorista_chegou") && (',
    '              <div className="space-y-2">',
    '                {passengerPin ? <SecurityCodeCard code={passengerPin} /> :',
    '                  <div role="status" className="rounded-2xl border border-[#F1D2D5] bg-white p-4 text-center text-sm font-bold text-[#B91C1C]">',
    '                    {pinPending ? "Preparando seu PIN de segurança..." : "Aguardando a liberação do PIN de segurança."}',
    '                  </div>}',
    '                <p className="text-center text-xs font-semibold text-[#626B78]">Informe o PIN somente quando encontrar o motorista no embarque.</p>',
    '              </div>',
    '            )}',
  ].join('\n');
  src=replace(src,section,card+'\n'+section,'posicao visivel do PIN');
  if(src.includes('<SecurityCodeCard code={ride.security_code}'))throw Error('[FAIL] PIN exposto por public.rides');
  for(const mark of ['APOIS_PIN_AFTER_ACCEPT_V1','get_passenger_ride_security_code','setPassengerPin(candidate)','code={passengerPin}','status === "motorista_chegou"'])if(!src.includes(mark))throw Error('[FAIL] PIN: '+mark);
  return src;
});
console.log('[OK] Cliente: aceita corrida -> consulta PIN protegido -> mostra antes da chegada.');
