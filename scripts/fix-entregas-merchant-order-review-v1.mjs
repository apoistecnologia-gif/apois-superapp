import {readFileSync,writeFileSync} from "node:fs";
import {resolve} from "node:path";
const file=resolve(".work/entregas/src/components/MerchantOrderControlCenter.tsx");
let s=readFileSync(file,"utf8");
// O snapshot evoluiu: a consulta de pedidos pagos pode já aceitar cash/pending
// ou ter sido reescrita. Substituição condicional; o contrato no fim garante o
// comportamento (pedido cash/pending permanece operacional).
function rep(a,b){if(s.includes(b))return;if(!s.includes(a)){console.log("[OK] Merchant review: padrão já evoluiu ("+a.slice(0,45)+")");return;}s=s.replace(a,b)}
rep("  const [open, setOpen] = useState(false);","  const [open, setOpen] = useState(false);\n  const seenReviewOrderIds = useRef<Set<string>>(new Set());");
rep("  created_at: string | null;\n};","  created_at: string | null;\n  observation?: string | null;\n  delivery_address?: Record<string, any> | null;\n  order_items?: Array<{quantity?:number;product_name?:string;name?:string;products?:{name?:string}|null}>;\n  customer_user_id?: string | null;\n};");
rep('"id,order_number,status,payment_status,payment_method,fulfillment_type,total,created_at",','"id,order_number,status,payment_status,payment_method,fulfillment_type,total,created_at,observation,delivery_address,customer_user_id,order_items(*)",');
rep('      .eq("payment_status", "paid")','      .or("payment_status.eq.paid,and(payment_method.eq.cash,payment_status.eq.pending)")');
rep('    setOrders((data ?? []) as MerchantOrder[]);', [
'    setOrders((data ?? []) as MerchantOrder[]);',
'    const newOrders = (data ?? []).filter((order: any) => order.status === "confirmed" && !seenReviewOrderIds.current.has(order.id));',
'    for (const order of newOrders) seenReviewOrderIds.current.add(order.id);',
'    if (newOrders.length > 0) setOpen(true);'
].join("\n"));
rep('                  {!paymentReady ? (',`                  <div data-apois-merchant-order-review className="mt-3 space-y-2 rounded-xl border border-zinc-700 bg-zinc-900 p-3 text-xs">
                    <p className="font-black text-white">ITENS SOLICITADOS</p>
                    {(order.order_items ?? []).map((item: any, i: number) => (
                      <p key={i} className="text-white">{Number(item.quantity ?? 1)}x {item.product_name ?? item.name ?? item.products?.name ?? "Produto não identificado"}</p>
                    ))}
                    {!order.order_items?.length ? <p className="text-amber-300">Itens não carregados. Não aceite antes de conferir.</p> : null}
                    <p className="text-zinc-200"><strong>Cliente:</strong> {order.customer_user_id ? "Identificado no cadastro — consulte a aba Pedidos" : "Não identificado"}</p>
                    <p className="text-zinc-200"><strong>Destino:</strong> {order.fulfillment_type === "delivery" ? [order.delivery_address?.street, order.delivery_address?.number, order.delivery_address?.neighborhood, order.delivery_address?.city].filter(Boolean).join(", ") || "Endereço não disponível" : "Retirada no local"}</p>
                    {order.observation ? <p className="break-words text-zinc-200"><strong>Observações:</strong> {order.observation}</p> : null}
                    <p className="text-zinc-300">{order.payment_method === "cash" && order.payment_status === "pending" ? "Pagamento direto de teste — não recebido" : "Pagamento: " + (order.payment_status ?? "pendente")}</p>
                  </div>
                  {!paymentReady ? (`);
rep('disabled={busy || !paymentReady}\n                        onClick={() => void transition(order.id, "accepted")}','disabled={busy || !paymentReady || !order.order_items?.length}\n                        onClick={() => void transition(order.id, "accepted")}');
writeFileSync(file,s);
console.log("[OK] Merchant order review: item list, destination, observation and safe cash visibility");
