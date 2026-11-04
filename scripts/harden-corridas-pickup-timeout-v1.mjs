import {readFileSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
const hookFile=resolve('.work/corridas/src/hooks/use-pickup-address.tsx');
let s=readFileSync(hookFile,'utf8');
const marker='APOIS_PICKUP_TIMEOUT_DEDUP_V1';
if(s.includes(marker)){console.log('[OK] pickup anti-travamento já instalado');process.exit(0);}
if(!s.includes('useRef'))throw Error('[FAIL] useRef requerido pelo hardening UX');
const anchor='  const [error, setError] = useState<string | null>(null);';
if(!s.includes(anchor))throw Error('[FAIL] estado de geocoding não encontrado');
s=s.replace(anchor,anchor+`
  // ${marker}: reduzir repetição da consulta por pequenas oscilações do GPS.
  const lastAttemptCell = useRef<string | null>(null);
  const runningCell = useRef(false);
`);
const start='  const refreshAddress = useCallback(async () => {';
if(!s.includes(start))throw Error('[FAIL] refreshAddress não encontrado');
s=s.replace(start,`  const refreshAddress = useCallback(async () => {
    if (!location || !Number.isFinite(location.latitude) || !Number.isFinite(location.longitude)) {
      setStatus("error");
      setError("Localização não disponível. Confira a permissão de GPS.");
      return;
    }
    if (runningCell.current) return;
`);
const oldGuard='    if (!location || !Number.isFinite(location.latitude) || !Number.isFinite(location.longitude)) return;';
s=s.replace(oldGuard,'');
const busyAnchor = '    geocodeBusyRef.current = true;';
if (!s.includes(busyAnchor)) throw Error('[FAIL] Pickup retry lock: geocode busy anchor absent');
if (s.includes('    runningCell.current = true;')) throw Error('[FAIL] Pickup retry lock still acquired before geocode jitter guards');
// APOIS_PICKUP_NO_EARLY_RUNNING_LOCK_V2: set running only after early returns of the active GPS jitter check.
// Any return before try/finally would otherwise freeze every subsequent tap.
s = s.replace(busyAnchor, busyAnchor + '\n    // APOIS_PICKUP_NO_EARLY_RUNNING_LOCK_V2: lock only after jitter guard\n    runningCell.current = true;');

const oldInvoke=`      const { data: reverse, error: reverseError } = await supabase.functions.invoke(
        "google-maps-address",
        {
          body: {
            action: "reverse_geocode",
            lat: location.latitude,
            lng: location.longitude,
          },
        },
      );`;
if(!s.includes(oldInvoke))throw Error('[FAIL] reverse geocode Supabase não localizado');
const newInvoke=`      let timeout: ReturnType<typeof setTimeout> | undefined;
      const reverseRequest = supabase.functions.invoke(
        "google-maps-address",
        { body: { action: "reverse_geocode", lat: location.latitude, lng: location.longitude } },
      );
      const result = await Promise.race([
        reverseRequest,
        new Promise<never>((_, reject) => {
          timeout = setTimeout(() => reject(new Error("Tempo excedido ao identificar endereço")), 12000);
        }),
      ]).finally(() => { if (timeout) clearTimeout(timeout); });
      const { data: reverse, error: reverseError } = result;`;
s=s.replace(oldInvoke,newInvoke);
// A jornada ja modifica o conteudo do finally; preservar o cleanup
// existente e inserir a liberacao de runningCell sem depender do loader literal.
const finallyAnchor=/    } finally \{(?:\r?\n)/;
if(!finallyAnchor.test(s))throw Error('[FAIL] bloco finally ausente');
s=s.replace(finallyAnchor,match=>match+'      runningCell.current = false;\n');
const oldEffect=`  useEffect(() => {
    if (location) {
      refreshAddress();
    }
  }, [location, refreshAddress]);`;
if(!s.includes(oldEffect))throw Error('[FAIL] efeito de localização inesperado');
s=s.replace(oldEffect,`  useEffect(() => {
    if (!location || !Number.isFinite(location.latitude) || !Number.isFinite(location.longitude)) return;
    const key = [Math.round(location.latitude * 1000), Math.round(location.longitude * 1000)].join(":");
    if (lastAttemptCell.current === key) return;
    lastAttemptCell.current = key;
    void refreshAddress();
  }, [location?.latitude, location?.longitude, refreshAddress]);`);
if (!s.includes("APOIS_PICKUP_NO_EARLY_RUNNING_LOCK_V2") ||
    s.indexOf('geocodeBusyRef.current = true;') >= s.indexOf('runningCell.current = true;')) {
  throw Error('[FAIL] Pickup lock must be acquired after 85m GPS jitter short-circuit');
}
writeFileSync(hookFile,s,'utf8');
console.log('[OK] Corridas: geocoding timeout 12s, GPS sem loops e falha permite nova tentativa.');
