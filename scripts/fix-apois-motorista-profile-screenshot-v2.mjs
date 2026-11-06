// APOIS Motorista — screenshot 1001992581, perfil/foto/contagem/layout.
// Aplica exclusivamente na copia isolada .work/partner-motorista e nao toca no Entregador.
import {readFileSync,writeFileSync} from "node:fs";
import {resolve} from "node:path";
const root=resolve(process.env.APOIS_MOTORISTA_WORKSPACE||".work/partner-motorista");
function once(s,a,b,why){const n=s.split(a).length-1;if(n!==1)throw Error("[FAIL] profile screenshot "+why+" occurrences="+n);return s.replace(a,b);}
function patch(path,fn,marker){
 const absolute=resolve(root,path),source=readFileSync(absolute,"utf8");
 if(source.includes(marker)){console.log("[OK] already patched "+path);return;}
 const next=fn(source);
 if(next===source||!next.includes(marker))throw Error("[FAIL] profile screenshot "+path);
 writeFileSync(absolute,next,"utf8");console.log("[OK] profile screenshot "+path);
}
patch("src/components/ProfilePhotoUploader.tsx",s=>{
 const original=[
 'function friendlyPhotoError(error: unknown, fallback: string) {',
 '  if (import.meta.env.DEV) console.warn("[APOIS FOTO]", error);',
 '  return fallback;',
 '}'
 ].join("\n");
 const replacement=[
 '// APOIS_DRIVER_PROFILE_ERROR_STAGE_V2: exibimos apenas mensagens seguras e conhecidas, nunca SQL/JWT/paths.',
 'function friendlyPhotoError(error: unknown, fallback: string) {',
 '  if (import.meta.env.DEV) console.warn("[APOIS FOTO]", error);',
 '  const message = error instanceof Error ? error.message : "";',
 '  const safe = new Set([',
 '    "Sua sessão expirou. Entre novamente para alterar a foto.",',
 '    "Não foi possível enviar a foto agora. Tente novamente.",',
 '    "Não foi possível vincular a foto ao perfil.",',
 '    "Foto salva com sucesso, mas a visualização ainda não está disponível. Reabra a tela em instantes.",',
 '    "O caminho da foto não é válido.",',
 '    "Formato inválido. Envie JPG, JPEG, PNG ou WEBP.",',
 '    "A foto deve ter no máximo 5 MB.",',
 '    "Arquivo vazio.",',
 '  ]);',
 '  return safe.has(message) ? message : fallback;',
 '}'
 ].join("\n");
 return once(s,original,replacement,"safe upload failure reason");
},"APOIS_DRIVER_PROFILE_ERROR_STAGE_V2");
patch("src/routes/motorista.perfil.tsx",s=>{
 s=once(s,'const [totalRides, setTotalRides] = useState(0);',
   'const [totalRides, setTotalRides] = useState<number | null>(null); // APOIS_DRIVER_REAL_RIDE_COUNT_V2',
   "ride-count state");
 s=once(s,'        setTotalRides(0);','        setTotalRides(null);',"no profile default");
 s=once(s,
   '      setTotalRides(safeCount(nextDriver.completed_rides));',
   [
    '      // A tabela drivers nao possui completed_rides: contar as corridas reais,',
    '      // visiveis ao motorista pela mesma RLS usada no seu Historico.',
    '      setTotalRides(null);',
    '      if (nextDriver.id) {',
    '        const { count, error: rideCountError } = await supabase',
    '          .from("rides")',
    '          .select("id", { count: "exact", head: true })',
    '          .eq("driver_id", nextDriver.id)',
    '          .eq("status", "finalizada");',
    '        if (requestId !== requestRef.current) return;',
    '        if (rideCountError) {',
    '          console.warn("[APOIS DRIVER PROFILE] count unavailable", rideCountError.code);',
    '          setTotalRides(null);',
    '        } else {',
    '          setTotalRides(count ?? null);',
    '        }',
    '      }'
   ].join("\n"),"true driver ride total");
 s=once(s,'  const completed = safeCount(driver?.completed_rides ?? totalRides);',
   '  const completed = totalRides;',"avoid bogus zero from absent column");
 s=once(s,
   '{completed} {completed === 1 ? "corrida" : "corridas"}',
   '{completed ?? "—"} {completed === 1 ? "corrida" : "corridas"}',
   "header count unavailable");
 s=once(s,'<StatCard label="Corridas" value={String(completed)} />',
   '<StatCard label="Corridas" value={completed == null ? "—" : String(completed)} />',
   "metric count unavailable");
 const statStart=s.indexOf("function StatCard("), statEnd=s.indexOf("function MenuRow(",statStart);
 if(statStart<0||statEnd<=statStart) throw Error("[FAIL] metric boundaries changed");
 let stat=s.slice(statStart,statEnd);
 const labelEnd=stat.indexOf('">{label}</Label>');
 const labelStart=stat.lastIndexOf('<Label className="',labelEnd);
 if(labelEnd<0||labelStart<0||labelEnd-labelStart>260) throw Error("[FAIL] stat label changed: "+stat.slice(0,650));
 const oldLabel=stat.slice(labelStart,labelEnd+'">{label}</Label>'.length);
 const styledLabel=oldLabel.replace('<Label className="','<Label className="max-w-full whitespace-nowrap text-center !text-[clamp(10px,2.7vw,12px)] leading-4 tracking-tight ');
 stat=stat.replace(oldLabel,styledLabel);
 s=s.slice(0,statStart)+stat+s.slice(statEnd);
 return s;
},"APOIS_DRIVER_REAL_RIDE_COUNT_V2");
console.log("[OK] Motorista profile: safe upload diagnostics, actual completed rides and one-line metric labels.");
