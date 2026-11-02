import {readFileSync,writeFileSync} from "node:fs";
import {resolve} from "node:path";
const root=resolve(".work/partner-motorista");
function edit(file,edits){
 const path=resolve(root,file);let s=readFileSync(path,"utf8");
 for(const [from,to,label] of edits){const n=s.split(from).length-1;if(n!==1)throw Error("[FAIL] Motorista historico/perfil "+label+" occurrences="+n);s=s.replace(from,to);}
 writeFileSync(path,s,"utf8");
}
edit("src/routes/motorista.corridas.tsx",[
 ['<div className="flex min-h-dvh flex-col bg-background">',
  '<div data-apois-driver-history-contrast-v2 className="flex min-h-dvh flex-col bg-[#F7F7F8] text-[#111827]">',"history shell"],
 ['<HeadingXL className="break-words">Histórico</HeadingXL>',
  '<HeadingXL className="break-words text-[#111827]">Histórico</HeadingXL>',"history heading"],
 ['<DSCard className="flex min-w-0 flex-col gap-1.5 p-3 sm:p-4">',
  '<DSCard className="flex min-w-0 flex-col gap-1.5 rounded-2xl border border-[#D9DDE3] bg-white p-3 text-[#111827] sm:p-4">',"history summary card"],
 ['"max-w-full break-words text-[clamp(14px,4.6vw,18px)] leading-tight",',
  '"max-w-full break-words text-[clamp(14px,4.6vw,18px)] font-extrabold leading-tight text-[#111827]",',"history metric ink"],
 ['<Label className="break-words">{label}</Label>',
  '<Label className="break-words text-[#596372]">{label}</Label>',"history metric label"],
 ['<DSCard className="press-scale flex min-w-0 flex-col gap-3 p-3 transition hover:-translate-y-[1px] sm:p-4">',
  '<DSCard className="press-scale flex min-w-0 flex-col gap-3 rounded-2xl border border-[#D9DDE3] bg-white p-3 text-[#111827] transition hover:-translate-y-[1px] sm:p-4">',"history ride card"]
]);
edit("src/components/profile/DriverProfessionalProfileDialog.tsx",[
 ['  useDriverPublicProfile,\n} from "./DriverProfessionalProfile";',
  '  useDriverPublicProfile,\n  type DriverPublicProfile,\n} from "./DriverProfessionalProfile";',"own profile fallback import"],
 ['  driverUserId,\n}: {',
  '  driverUserId,\n  ownProfile,\n}: {',"own profile prop"],
 ['  driverUserId: string | null;\n}) {',
  '  driverUserId: string | null;\n  ownProfile?: DriverPublicProfile | null;\n}) {',"own profile typing"],
 ['        <div className="min-w-0">\n          <DriverProfessionalProfile profile={data} loading={loading} />',
  '        <div className="min-w-0">\n          {!loading && !data && ownProfile ? <p role="status" className="mb-3 rounded-xl bg-[#F3F4F6] px-3 py-2 text-center text-xs font-semibold text-[#596372]">Prévia dos dados do seu cadastro. A consulta pública está indisponível.</p> : null}\n          <DriverProfessionalProfile profile={data ?? ownProfile ?? null} loading={loading} />',"own profile readonly fallback"]
]);
edit("src/routes/motorista.perfil.tsx",[
 ['<DriverProfessionalProfileDialog open={publicProfileOpen} onOpenChange={setPublicProfileOpen} driverUserId={userId} />',
  '<DriverProfessionalProfileDialog open={publicProfileOpen} onOpenChange={setPublicProfileOpen} driverUserId={userId}\n        ownProfile={driver && userId ? {\n          user_id: userId, name: driver.name,\n          photo_url: driver.photo_url?.startsWith("https://") ? driver.photo_url : null,\n          city: driver.city ?? null, state: null, category: driver.category,\n          vehicle_model: driver.vehicle_model, vehicle_color: driver.vehicle_color,\n          vehicle_plate: driver.vehicle_plate, vehicle_year: driver.vehicle_year,\n          average_rating: driver.average_rating ?? driver.rating ?? null,\n          total_ratings: driver.total_ratings ?? null,\n          completed_rides: driver.completed_rides ?? null,\n          approval_status: driver.approval_status, is_online: driver.is_online,\n          member_since: driver.created_at,\n        } : null} />',"public profile fallback limited to current user"]
]);
console.log("[OK] Motorista: Histórico contrast and safe own-profile preview when RPC unavailable.");
