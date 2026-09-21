import { createClient } from "npm:@supabase/supabase-js@2.112.1";

type JsonRecord = Record<string, unknown>;
type OrderItemInput = { productId: string; quantity: number; options: Array<{ optionId: string }> };
type CanonicalItem = { productId: string; quantity: number; options: Array<{ optionId: string }> };

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const jsonHeaders = { ...corsHeaders, "Content-Type": "application/json; charset=utf-8" };
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

// Current release contract: order creation accepts PIX only. The function
// creates the order in pending state; payment authority belongs exclusively to
// Safe2Pay webhook/status reconciliation. Never fabricate paid here.
const PAYMENT_METHODS = new Set(["pix"]);
const FULFILLMENT_TYPES = new Set(["delivery", "pickup"]);

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function text(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}
function badRequest(message: string, code = "INVALID_REQUEST") {
  return new Response(JSON.stringify({ error: message, code }), { status: 400, headers: jsonHeaders });
}
function parseItems(value: unknown): OrderItemInput[] | null {
  if (!Array.isArray(value) || value.length === 0 || value.length > 100) return null;
  const items: OrderItemInput[] = [];
  for (const rawItem of value) {
    if (!isRecord(rawItem)) return null;
    const productId = rawItem.productId;
    const quantity = rawItem.quantity;
    const rawOptions = rawItem.options ?? [];
    if (typeof productId !== "string" || !UUID_RE.test(productId)) return null;
    if (!Number.isInteger(quantity) || Number(quantity) <= 0 || Number(quantity) > 99) return null;
    if (!Array.isArray(rawOptions) || rawOptions.length > 50) return null;
    const options: Array<{ optionId: string }> = [];
    for (const rawOption of rawOptions) {
      if (!isRecord(rawOption)) return null;
      const optionId = rawOption.optionId;
      if (typeof optionId !== "string" || !UUID_RE.test(optionId)) return null;
      options.push({ optionId });
    }
    items.push({ productId, quantity: Number(quantity), options });
  }
  return items;
}
function stable(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`;
  if (isRecord(value)) {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stable(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}
async function deriveUuid(seed: string, payload: unknown): Promise<string> {
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`${seed}:${stable(payload)}`)));
  const bytes = digest.slice(0, 16);
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
function canonicalItems(items: OrderItemInput[]): CanonicalItem[] {
  const grouped = new Map<string, CanonicalItem>();
  for (const item of items) {
    const options = [...item.options].map((option) => ({ optionId: option.optionId })).sort((a, b) => a.optionId.localeCompare(b.optionId));
    const key = `${item.productId}:${options.map((option) => option.optionId).join(",")}`;
    const existing = grouped.get(key);
    if (existing) existing.quantity += item.quantity;
    else grouped.set(key, { productId: item.productId, quantity: item.quantity, options });
  }
  return [...grouped.entries()].sort(([left], [right]) => left.localeCompare(right)).map(([, item]) => item);
}
function mapOrderError(message: string) {
  const normalized = message.toLowerCase();
  if (normalized.includes("merchant is closed")) return { status: 409, code: "MERCHANT_CLOSED", error: "O estabelecimento está fechado no momento." };
  if (normalized.includes("merchant is inactive") || normalized.includes("merchant not found") || normalized.includes("active customer account required")) {
    return { status: 409, code: "MERCHANT_UNAVAILABLE", error: "O estabelecimento ou sua conta não está disponível para este pedido." };
  }
  if (normalized.includes("delivery address unavailable")) return { status: 409, code: "DELIVERY_ADDRESS_UNAVAILABLE", error: "Este endereço está fora da área de entrega disponível." };
  if (normalized.includes("courier marketplace payout not live") || normalized.includes("delivery is unavailable")) {
    return { status: 409, code: "DELIVERY_UNAVAILABLE", error: "Este estabelecimento não está aceitando entregas no momento." };
  }
  if (normalized.includes("pickup is unavailable")) return { status: 409, code: "PICKUP_UNAVAILABLE", error: "Este estabelecimento não está aceitando retirada no momento." };
  if (normalized.includes("merchant minimum order")) return { status: 409, code: "MINIMUM_ORDER_NOT_REACHED", error: "O valor mínimo de pedido deste estabelecimento ainda não foi atingido." };
  if (normalized.includes("coupon")) {
    return { status: 409, code: "COUPON_INVALID", error: normalized.includes("minimum order") ? "O valor mínimo necessário para usar este cupom ainda não foi atingido." : "Este cupom não pode ser utilizado neste pedido." };
  }
  if (normalized.includes("group") || normalized.includes("selection")) return { status: 409, code: "CUSTOMIZATION_INVALID", error: "Revise as opções de personalização do pedido." };
  if (normalized.includes("unavailable") || normalized.includes("product") || normalized.includes("option")) return { status: 409, code: "ITEM_UNAVAILABLE", error: "Um item ou adicional não está mais disponível. Revise a sacola." };
  return { status: 409, code: "ORDER_CREATION_FAILED", error: "Não foi possível criar o pedido. Tente novamente." };
}

Deno.serve(async (request: Request) => {
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });
  if (request.method !== "POST") {
    return new Response(JSON.stringify({ error: "Método não permitido.", code: "METHOD_NOT_ALLOWED" }), { status: 405, headers: jsonHeaders });
  }

  const authorization = request.headers.get("Authorization");
  if (!authorization?.startsWith("Bearer ")) {
    return new Response(JSON.stringify({ error: "Autenticação obrigatória.", code: "UNAUTHORIZED" }), { status: 401, headers: jsonHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    console.error("create-order: Supabase environment is incomplete");
    return new Response(JSON.stringify({ error: "Serviço temporariamente indisponível.", code: "SERVER_CONFIGURATION" }), { status: 500, headers: jsonHeaders });
  }

  const token = authorization.slice("Bearer ".length);
  const authClient = createClient(supabaseUrl, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: userData, error: userError } = await authClient.auth.getUser(token);
  if (userError || !userData.user) {
    return new Response(JSON.stringify({ error: "Sessão inválida ou expirada.", code: "UNAUTHORIZED" }), { status: 401, headers: jsonHeaders });
  }

  const adminClient = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });

  let payload: unknown;
  try { payload = await request.json(); } catch { return badRequest("Corpo da requisição inválido."); }
  if (!isRecord(payload)) return badRequest("Dados do pedido inválidos.");

  const merchantId = payload.merchantId;
  const requestKey = payload.requestKey;
  const paymentMethod = payload.paymentMethod;
  const fulfillmentType = payload.fulfillmentType ?? "delivery";
  const rawDeliveryAddress = payload.deliveryAddress;
  const observation = payload.observation;
  const rawCouponCode = payload.couponCode;
  const items = parseItems(payload.items);

  if (typeof merchantId !== "string" || !UUID_RE.test(merchantId)) return badRequest("Estabelecimento inválido.");
  if (typeof requestKey !== "string" || !UUID_RE.test(requestKey)) return badRequest("Identificador da tentativa inválido.");
  if (typeof paymentMethod !== "string" || !PAYMENT_METHODS.has(paymentMethod)) return badRequest("Forma de pagamento inválida.", "PAYMENT_METHOD_NOT_CONFIGURED");
  if (typeof fulfillmentType !== "string" || !FULFILLMENT_TYPES.has(fulfillmentType)) return badRequest("Modalidade de recebimento inválida.");

  let deliveryAddress: JsonRecord = {};
  if (fulfillmentType === "delivery") {
    if (!isRecord(rawDeliveryAddress)) return badRequest("Endereço de entrega inválido.");
    const addressId = text(rawDeliveryAddress.id);
    if (!addressId || !UUID_RE.test(addressId)) return badRequest("Selecione um endereço salvo para entrega.", "DELIVERY_ADDRESS_NOT_SAVED");

    const { data: savedAddress, error: addressError } = await adminClient
      .from("customer_addresses")
      .select("id,label,street,number,complement,neighborhood,city,state,postal_code,reference,latitude,longitude")
      .eq("id", addressId)
      .eq("user_id", userData.user.id)
      .maybeSingle();
    if (addressError) {
      console.error("create-order address lookup failed", { code: addressError.code, addressId });
      return new Response(JSON.stringify({ error: "Não foi possível validar o endereço de entrega.", code: "DELIVERY_ADDRESS_LOOKUP_FAILED" }), { status: 500, headers: jsonHeaders });
    }
    if (!savedAddress) return badRequest("Este endereço não pertence à sua conta ou não está mais disponível.", "DELIVERY_ADDRESS_NOT_FOUND");
    if (savedAddress.latitude === null || savedAddress.longitude === null) return badRequest("Confirme o ponto exato deste endereço no mapa antes de finalizar.", "DELIVERY_COORDINATES_REQUIRED");
    deliveryAddress = {
      id: savedAddress.id, label: savedAddress.label, street: savedAddress.street, number: savedAddress.number,
      complement: savedAddress.complement, neighborhood: savedAddress.neighborhood, city: savedAddress.city,
      state: savedAddress.state, postal_code: savedAddress.postal_code, reference: savedAddress.reference,
      latitude: savedAddress.latitude, longitude: savedAddress.longitude,
    };
  }

  if (observation !== undefined && observation !== null && typeof observation !== "string") return badRequest("Observação inválida.");
  if (typeof observation === "string" && observation.length > 1000) return badRequest("A observação é muito longa.");
  if (rawCouponCode !== undefined && rawCouponCode !== null && typeof rawCouponCode !== "string") return badRequest("Cupom inválido.");
  if (typeof rawCouponCode === "string" && rawCouponCode.trim().length > 80) return badRequest("Cupom inválido.");
  if (!items) return badRequest("A sacola contém itens inválidos.");

  const normalizedObservation = typeof observation === "string" && observation.trim() ? observation.trim() : null;
  const couponCode = typeof rawCouponCode === "string" && rawCouponCode.trim() ? rawCouponCode.trim().toUpperCase() : null;
  const canonicalPayload = { merchantId, paymentMethod, fulfillmentType, deliveryAddress, couponCode, observation: normalizedObservation, items: canonicalItems(items) };
  const effectiveRequestKey = await deriveUuid(`attempt:${requestKey}`, canonicalPayload);
  const checkoutIntentKey = await deriveUuid(`checkout:${userData.user.id}`, canonicalPayload);

  const { data, error } = await adminClient.rpc("create_order_for_checkout_intent_v2", {
    p_customer_user_id: userData.user.id,
    p_merchant_id: merchantId,
    p_items: items,
    p_payment_method: paymentMethod,
    p_delivery_address: deliveryAddress,
    p_request_key: effectiveRequestKey,
    p_checkout_intent_key: checkoutIntentKey,
    p_fulfillment_type: fulfillmentType,
    p_coupon_code: couponCode,
    p_observation: normalizedObservation,
  });

  if (error) {
    console.error("create-order RPC failed", { code: error.code, requestKey: effectiveRequestKey, checkoutIntentKey });
    const mapped = mapOrderError(error.message);
    return new Response(JSON.stringify({ error: mapped.error, code: mapped.code }), { status: mapped.status, headers: jsonHeaders });
  }

  const created = Array.isArray(data) ? data[0] : null;
  if (!created?.order_id || created.order_number === undefined) {
    console.error("create-order RPC returned an invalid response", { requestKey: effectiveRequestKey, checkoutIntentKey });
    return new Response(JSON.stringify({ error: "Resposta inválida ao criar pedido.", code: "INVALID_BACKEND_RESPONSE" }), { status: 500, headers: jsonHeaders });
  }

  const { data: snapshot, error: snapshotError } = await adminClient
    .from("orders")
    .select("id,order_number,created_at,status,payment_method,payment_status,fulfillment_type,coupon_id,subtotal,delivery_fee,discount,total,observation,order_items(id,product_id,product_name,product_description,base_price,unit_price,quantity,line_total,selected_options)")
    .eq("id", created.order_id)
    .single();
  if (snapshotError || !snapshot) {
    console.error("create-order could not load authoritative snapshot", { code: snapshotError?.code, requestKey: effectiveRequestKey, checkoutIntentKey });
    return new Response(JSON.stringify({ error: "Pedido criado, mas não foi possível carregar o resumo.", code: "SNAPSHOT_FAILED" }), { status: 500, headers: jsonHeaders });
  }

  // Fail closed if a future/legacy DB function unexpectedly fabricated payment.
  if (snapshot.payment_method !== "pix" || snapshot.payment_status === "paid") {
    console.error("create-order rejected inconsistent financial snapshot", {
      orderId: snapshot.id,
      paymentMethod: snapshot.payment_method,
      paymentStatus: snapshot.payment_status,
    });
    return new Response(JSON.stringify({ error: "Estado financeiro incompatível com o modo de pagamento atual.", code: "FINANCIAL_CONTRACT_MISMATCH" }), { status: 500, headers: jsonHeaders });
  }

  return new Response(JSON.stringify({
    orderId: snapshot.id,
    orderNumber: snapshot.order_number,
    createdAt: snapshot.created_at,
    status: snapshot.status,
    paymentMethod: snapshot.payment_method,
    paymentStatus: snapshot.payment_status,
    fulfillmentType: snapshot.fulfillment_type,
    couponId: snapshot.coupon_id,
    subtotal: snapshot.subtotal,
    deliveryFee: snapshot.delivery_fee,
    discount: snapshot.discount,
    total: snapshot.total,
    observation: snapshot.observation,
    items: snapshot.order_items,
  }), { status: 200, headers: jsonHeaders });
});
