// APOIS RV-12: final presentation-only patches on disposable .work/entregas files.
import {readFileSync,writeFileSync,mkdirSync} from "node:fs";
import {resolve,dirname} from "node:path";
import {fileURLToPath} from "node:url";
export const MARK = "APOIS_CV12_MERCHANT_ORDER_OPTIONS_V1";
const OPTION_HELPER="scripts/templates/formatMerchantSelectedOptions.ts";
function once(source,oldValue,newValue,label){
  const count=source.split(oldValue).length-1;
  if(count!==1)throw Error("[RV12 options] "+label+" anchor count "+count);
  return source.replace(oldValue,newValue);
}
export function patchMerchantRoute(s){
  if(s.includes(MARK)){
    for(const required of ["formatMerchantSelectedOptions(item.selected_options)","...formatMerchantSelectedOptions(item.selected_options).map","data-apois-cv12-merchant-options"])
      if(!s.includes(required))throw Error("[RV12 options] partial Merchant route "+required);
    return s;
  }
  const from="import { use";
  if(!s.includes(from)||!s.includes("function printMerchantOrder(order: any)"))throw Error("[RV12 options] source merchant route drift");
  s=once(s,
    "function printMerchantOrder(order: any) {",
    "function printMerchantOrder(order: any) {",
    "print function exists");
  const beforePrint=[
    "  const itemLines = (order.order_items ?? []).map(",
    '    (item: any) => `${item.quantity}x ${item.product_name}    ${money(item.line_total)}`,',
    "  );",
  ].join("\n");
  const afterPrint=[
    "  const itemLines = (order.order_items ?? []).flatMap(",
    "    (item: any) => [",
    '      `${item.quantity}x ${item.product_name}    ${money(item.line_total)}`,',
    '      ...formatMerchantSelectedOptions(item.selected_options).map((choice) => "  + " + choice),',
    "    ],",
    "  );",
  ].join("\n");
  s=once(s,beforePrint,afterPrint,"print choices with existing totals");
  const beforeCard=[
    "          {order.order_items?.map((item: any) => (",
    '            <p key={item.id} className="text-sm text-zinc-400">',
    "              {item.quantity}x {item.product_name} — {money(item.line_total)}",
    "            </p>",
    "          ))}",
  ].join("\n");
  const afterCard=[
    "          {order.order_items?.map((item: any) => (",
    '            <div key={item.id} data-apois-cv12-merchant-options="true" className="space-y-1">',
    '              <p className="text-sm text-zinc-400">{item.quantity}x {item.product_name} — {money(item.line_total)}</p>',
    '              {formatMerchantSelectedOptions(item.selected_options).length > 0 ? (',
    '                <ul className="list-inside list-disc space-y-0.5 pl-2 text-xs text-zinc-300" aria-label={"Escolhas de " + String(item.product_name ?? "produto")}>',
    '                  {formatMerchantSelectedOptions(item.selected_options).map((choice, index) => <li key={index} className="break-words">{choice}</li>)}',
    "                </ul>",
    "              ) : null}",
    "            </div>",
    "          ))}",
  ].join("\n");
  s=once(s,beforeCard,afterCard,"merchant card line+choices");
  // One module import only; printing continues through textContent, not innerHTML.
  s='import { formatMerchantSelectedOptions } from "@/lib/formatMerchantSelectedOptions"; // '+MARK+"\n"+s;
  return s;
}
export function patchReview(s){
  if(s.includes(MARK)){
    for(const v of ["data-apois-merchant-order-review","formatMerchantSelectedOptions(item.selected_options)","Pagamento direto — ainda não confirmado"])
      if(!s.includes(v))throw Error("[RV12 options] partial review "+v);
    return s;
  }
  if(!s.includes("data-apois-merchant-order-review"))return {skipped:true,source:s};
  const oldRender=[
    "                    {(order.order_items ?? []).map((item: any, i: number) => (",
    '                      <p key={i} className="text-white">{Number(item.quantity ?? 1)}x {item.product_name ?? item.name ?? item.products?.name ?? "Produto não identificado"}</p>',
    "                    ))}",
  ].join("\n");
  const nextRender=[
    "                    {(order.order_items ?? []).map((item: any, i: number) => (",
    '                      <div key={i} className="space-y-1">',
    '                        <p className="break-words text-white">{Number(item.quantity ?? 1)}x {item.product_name ?? item.name ?? item.products?.name ?? "Produto não identificado"}</p>',
    '                        {formatMerchantSelectedOptions(item.selected_options).length > 0 ? (',
    '                          <ul className="list-inside list-disc pl-2 text-zinc-200" aria-label="Adicionais do item">',
    '                            {formatMerchantSelectedOptions(item.selected_options).map((choice, index) => <li key={index} className="break-words">{choice}</li>)}',
    "                          </ul>",
    "                        ) : null}",
    "                      </div>",
    "                    ))}",
  ].join("\n");
  s=once(s,oldRender,nextRender,"review choices");
  s=once(s,'"Pagamento direto de teste — não recebido"',
    '"Pagamento direto — ainda não confirmado"',"truthful pending direct payment");
  s='import { formatMerchantSelectedOptions } from "@/lib/formatMerchantSelectedOptions"; // '+MARK+"\n"+s;
  return s;
}
export function applyVisual12Orders(root=process.cwd()){
  const work=resolve(root,process.env.APOIS_ENTREGAS_WORKSPACE||".work/entregas");
  const files=[
    ["src/routes/merchant.tsx",patchMerchantRoute],
    ["src/components/MerchantOrderControlCenter.tsx",patchReview],
  ];
  const plans=files.map(([rel,fn])=>{
    const path=resolve(work,rel),old=readFileSync(path,"utf8"),result=fn(old);
    return {rel,path,old,next:typeof result==="string"?result:result.source,skipped:result?.skipped===true};
  });
  const template=readFileSync(resolve(root,OPTION_HELPER),"utf8");
  if(!template.includes(MARK))throw Error("[RV12 options] helper marker missing");
  const dest=resolve(work,"src/lib/formatMerchantSelectedOptions.ts");
  mkdirSync(dirname(dest),{recursive:true});
  // All source anchors were verified before any file write.
  if(readOptional(dest)!==template)writeFileSync(dest,template,"utf8");
  for(const p of plans)if(p.old!==p.next)writeFileSync(p.path,p.next,"utf8");
  return plans.map(p=>({file:p.rel,changed:p.old!==p.next,skipped:p.skipped}));
}
function readOptional(path){try{return readFileSync(path,"utf8")}catch(e){if(e?.code==="ENOENT")return null;throw e}}
if(process.argv[1]&&fileURLToPath(import.meta.url)===resolve(process.argv[1])){
  console.log("[OK] RV12 merchant order visual",JSON.stringify(applyVisual12Orders()));
}
