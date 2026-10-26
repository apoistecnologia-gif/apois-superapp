import {readFileSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
const hookFile=resolve('.work/corridas/src/hooks/use-pickup-address.tsx');
let s=readFileSync(hookFile,'utf8');
const marker='APOIS_PICKUP_TIMEOUT_DEDUP_V1';
if(s.includes(marker)){console.log('[OK] pickup anti-travamento já instalado');process.exit(0);}
const oldImport='useState, useEffect, useCallback';
if(!s.includes(oldImport))throw Error('[FAIL] import hooks alterado');
s=s.replace(oldImport,'useState, useEffect, useCallback, useRef');
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
    runningCell.current = true;
`);
const oldGuard='    if (!location || !Number.isFinite(location.latitude) || !Number.isFinite(location.longitude)) return;';
s=s.replace(oldGuard,'');
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
const finalAnchor='      setIsLoading(false);';
if(!s.includes(finalAnchor))throw Error('[FAIL] finally ausente');
s=s.replace(finalAnchor,'      runningCell.current = false;\\n'+finalAnchor);
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
writeFileSync(hookFile,s,'utf8');
console.log('[OK] Corridas: geocoding timeout 12s, GPS sem loops e falha permite nova tentativa.');
