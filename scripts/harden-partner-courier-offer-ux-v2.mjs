import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const root=resolve(process.env.APOIS_ENTREGAS_WORKSPACE||".work/partner-entregador");
function patch(path,apply){
  const file=resolve(root,path);
  const before=readFileSync(file,"utf8");
  const after=apply(before);
  if(before===after)throw Error("[FAIL] Entregador offer overlay unchanged: "+path);
  writeFileSync(file,after,"utf8");
}
function required(src,before,after,label){
  if(!src.includes(before))throw Error("[FAIL] Entregador offer patch missing "+label);
  return src.replace(before,after);
}
patch("src/components/CourierOfferOverlay.tsx",s=>{
  s=required(s,'import logoAsset from "@/assets/logo.png.asset.json";',
      'import { APOIS_PARTNER_LOGO_DATA_URL } from "@/assets/apoisPartnerLogoData";',"logo import");
  s=required(s,'src={logoAsset.url}','src={APOIS_PARTNER_LOGO_DATA_URL}',"logo render");
  const modalSurface=/className="w-full max-w-\[390px\][^"\n]+"/;
  if(!modalSurface.test(s))throw Error("[FAIL] Entregador offer modal surface changed");
  s=s.replace(modalSurface,'className="w-full max-w-[420px] overflow-hidden rounded-[1.6rem] border border-[#E5E7EB] bg-white text-[#111827] shadow-[0_16px_60px_rgba(17,24,39,0.24)]"');
  const modalHeader=/className="border-b border-accent\/25 bg-\[linear-gradient\([^"\n]+\)\] px-5 pb-4 pt-5"/;
  if(!modalHeader.test(s))throw Error("[FAIL] Entregador offer modal header changed");
  s=s.replace(modalHeader,'className="border-b border-[#E5E7EB] bg-[#FFF1F2] px-5 pb-4 pt-5"');
  s=s.replaceAll('bg-black/70','bg-white').replaceAll('bg-black','bg-[#F9FAFB]');
  s=s.replaceAll('bg-zinc-950','bg-white').replaceAll('bg-zinc-900','bg-[#F3F4F6]');
  s=s.replace('bg-[#F9FAFB]/85 p-3 backdrop-blur-md','bg-black/65 p-3 backdrop-blur-md');
  s=s.replaceAll('text-zinc-100','text-[#111827]').replaceAll('text-zinc-300','text-[#374151]');
  s=s.replaceAll('text-zinc-400','text-[#4B5563]').replaceAll('text-zinc-500','text-[#626B78]').replaceAll('text-zinc-600','text-[#626B78]');
  s=s.replaceAll('rgba(246,190,28','rgba(229,27,35').replaceAll('rgba(200,138,8','rgba(229,27,35');
  s=required(s,
    '    stopAlert();\n    setOffers((current) => current.filter((row) => row.id !== offer.id));',
    '    stopAlert();\n    if(action === "accept") window.dispatchEvent(new Event("apois:courier-offer-accepted"));\n    setOffers((current) => current.filter((row) => row.id !== offer.id));',
    "accepted offer immediate route event");
  return s;
});
patch("src/routes/courier.tsx",s=>{
  const before='    const interval = window.setInterval(refresh, 7000);\n    return () => {';
  const after='    const interval = window.setInterval(refresh, 7000);\n    window.addEventListener("apois:courier-offer-accepted", refresh);\n    return () => {\n      window.removeEventListener("apois:courier-offer-accepted", refresh);';
  return required(s,before,after,"accepted route refresh");
});
console.log("[OK] Entregador: card de nova oferta APOIS vermelho/branco, marca correta, alerta sonoro preservado e rota atualiza no aceite.");
