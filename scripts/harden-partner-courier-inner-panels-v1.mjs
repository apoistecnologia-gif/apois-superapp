import {readFileSync,writeFileSync} from "node:fs";
import {resolve} from "node:path";
const root=resolve(process.env.APOIS_ENTREGAS_WORKSPACE||".work/partner-entregador");
function update(file,callback){const p=resolve(root,file);const original=readFileSync(p,"utf8");const result=callback(original);if(result===original)throw Error("[FAIL] painel sem alteracao "+file);writeFileSync(p,result,"utf8");}
function logo(s,file){
  const old='import logoAsset from "@/assets/logo.png.asset.json";';
  if(!s.includes(old))throw Error("[FAIL] logo anterior nao localizada "+file);
  s=s.replace(old,s.includes('import { APOIS_PARTNER_LOGO_DATA_URL } from "@/assets/apoisPartnerLogoData";') ? "" : 'import { APOIS_PARTNER_LOGO_DATA_URL } from "@/assets/apoisPartnerLogoData";');
  if(!s.includes("src={logoAsset.url}"))throw Error("[FAIL] imagem nao localizada "+file);
  return s.replaceAll("src={logoAsset.url}","src={APOIS_PARTNER_LOGO_DATA_URL}").replaceAll('alt="APOIS ENTREGA"','alt="APOIS"');
}
update("src/components/CourierPanels.tsx",s=>{
  s=logo(s,"CourierPanels");
  s=s.replace('PanelHeader title="Corridas"','PanelHeader title="Entregas"');
  s=s.replace('>Corridas</h1>','>Entregas</h1>');
  // Paineis operacionais claros: remover superficies escuras que tiveram texto alterado pelo tema global.
  s=s.replace('bg-[radial-gradient(circle_at_top_right,rgba(200,138,8,0.22),transparent_42%),#090909]','bg-white');
  s=s.replace('bg-[radial-gradient(circle_at_top_right,rgba(200,138,8,0.24),transparent_36%),linear-gradient(145deg,#101010,#070707)]','bg-white');
  s=s.replace('bg-zinc-950/80 p-9','bg-white p-9');
  s=s.replace('bg-black/55 p-4','bg-[#F3F4F6] p-4');
  s=s.replace('bg-[linear-gradient(145deg,#101010,#080808)]','bg-white');
  // Explicit legible text in light theme.
  s=s.replaceAll('text-zinc-600','text-[#596372]').replaceAll('text-zinc-500','text-[#596372]').replaceAll('text-zinc-400','text-[#4B5563]');
  return s;
});
update("src/components/CourierPremiumViews.tsx",s=>{
  s=logo(s,"CourierPremiumViews");
  s=s.replace('bg-[radial-gradient(circle_at_top_right,rgba(250,204,21,0.16),transparent_38%),linear-gradient(145deg,#111,#070707)]','bg-white');
  s=s.replaceAll('text-zinc-600','text-[#596372]').replaceAll('text-zinc-500','text-[#596372]');
  return s;
});
console.log("[OK] Entregador: logomarca oficial nas telas internas, contrastes e titulo de historico corrigidos.");
