import { createClient } from "npm:@supabase/supabase-js@2.112.1";
import {
  createSafe2PayPix,
  extractSafe2PayPixPublic,
  safe2PayFeePayer,
  safe2PayIsEnabled,
} from "../_shared/safe2pay.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const headers = { ...cors, "content-type": "application/json; charset=utf-8" };
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers });
const digits = (value: unknown) => String(value ?? "").replace(/\D/g, "");
const money = (value: unknown) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.round(parsed * 100) / 100 : 0;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
  if (req.method !== "POST") return json(405, { error: "method_not_allowed" });
  if (!safe2PayIsEnabled()) return json(503, { error: "safe2pay_provider_disabled", code: "PAYMENT_PROVIDER_NOT_READY" });

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
  const serviceRole = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  if (!supabaseUrl || !anonKey || !serviceRole) return json(500, { error: "server_configuration_missing" });

  const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
  if (!token) return json(401, { error: "unauthorized" });

  const auth = createClient(supabaseUrl, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const admin = createClient(supabaseUrl, serviceRole, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: authData, error: authError } = await auth.auth.getUser(token);
  if (authError || !authData.user) return json(401, { error: "unauthorized" });

  const body = await req.json().catch(() => ({})) as Record<string, unknown>;
  const orderId = String(body.order_id ?? "");
  if (!UUID_RE.test(orderId)) return json(400, { error: "invalid_order_id" });

  try {
    const { data: order, error: orderError } = await admin
      .from("orders")
      .select("id,order_number,customer_user_id,merchant_id,status,payment_status,total,subtotal,delivery_fee,discount")
      .eq("id", orderId)
      .eq("customer_user_id", authData.user.id)
      .maybeSingle();
    if (orderError) throw new Error(`order_lookup_failed:${orderError.message}`);
    if (!order) return json(404, { error: "order_not_found" });
    if (["cancelled","refunded"].includes(String(order.status))) return json(409, { error: "order_not_payable" });
    if (order.payment_status === "paid") return json(200, { reused: true, status: "authorized", orderId: order.id });

    const { data: profile, error: profileError } = await admin
      .from("profiles")
      .select("full_name,phone,cpf")
      .eq("id", authData.user.id)
      .maybeSingle();
    if (profileError) throw new Error(`customer_profile_lookup_failed:${profileError.message}`);

    const cpf = digits(profile?.cpf);
    if (cpf.length !== 11) return json(409, { error: "customer_cpf_required" });
    const name = String(profile?.full_name ?? authData.user.user_metadata?.full_name ?? "").trim();
    if (!name) return json(409, { error: "customer_name_required" });

    const { data: receiver, error: receiverError } = await admin
      .from("merchant_safe2pay_accounts")
      .select("safe2pay_receiver_id,status,environment")
      .eq("merchant_id", order.merchant_id)
      .eq("status", "active")
      .maybeSingle();
    if (receiverError) throw new Error(`safe2pay_receiver_lookup_failed:${receiverError.message}`);
    if (!receiver?.safe2pay_receiver_id) return json(409, { error: "merchant_safe2pay_receiver_not_ready" });
    if (receiver.environment !== "production") return json(409, { error: "merchant_safe2pay_receiver_not_production" });

    const amount = money(order.total);
    if (!(amount > 0)) return json(409, { error: "order_amount_invalid" });

    const { data: existing, error: existingError } = await admin
      .from("safe2pay_order_transactions")
      .select("id,provider_transaction_id,status,amount,reference,pix_copy_paste,pix_qr_code_base64,expires_at")
      .eq("order_id", order.id)
      .in("status", ["pending","processing","authorized"])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (existingError) throw new Error(`safe2pay_existing_lookup_failed:${existingError.message}`);

    if (existing) {
      const expiresAt = existing.expires_at ? Date.parse(String(existing.expires_at)) : Number.POSITIVE_INFINITY;
      const expiredLocally =
        ["pending","processing"].includes(String(existing.status)) &&
        Number.isFinite(expiresAt) &&
        expiresAt <= Date.now();

      if (expiredLocally) {
        const { error: expireError } = await admin
          .from("safe2pay_order_transactions")
          .update({ status: "expired", updated_at: new Date().toISOString() })
          .eq("id", existing.id)
          .in("status", ["pending","processing"]);
        if (expireError) throw new Error(`safe2pay_expire_local_failed:${expireError.message}`);
      } else {
        return json(200, {
          reused: true,
          reference: existing.reference,
          transactionId: existing.provider_transaction_id,
          status: existing.status,
          amount: existing.amount,
          pix: {
            copyPaste: existing.pix_copy_paste ?? null,
            qrCodeBase64: existing.pix_qr_code_base64 ?? null,
          },
        });
      }
    }

    const reference = `apois-order-${order.id}-${crypto.randomUUID()}`;
    const expiresAt = new Date(Date.now() + 600_000).toISOString();
    const feePayer = safe2PayFeePayer();
    const providerPayload = await createSafe2PayPix({
      reference,
      vendor: "APOIS Entregas",
      customer: {
        Name: name,
        Identity: cpf,
        Phone: digits(profile?.phone) || undefined,
        Email: authData.user.email ?? undefined,
      },
      products: [{
        Code: String(order.order_number ?? order.id),
        Description: `Pedido APOIS #${String(order.order_number ?? order.id)}`.slice(0, 200),
        UnitPrice: amount,
        Quantity: 1,
      }],
      expirationSeconds: 600,
      splits: [{
        IdReceiver: Number(receiver.safe2pay_receiver_id),
        CodeTaxType: 2,
        Amount: amount,
        IsPayTax: feePayer === "receiver",
      }],
    });

    const publicPix = extractSafe2PayPixPublic(providerPayload);
    if (!publicPix.transactionId) throw new Error("safe2pay_transaction_id_missing");

    const { error: insertError } = await admin.from("safe2pay_order_transactions").insert({
      order_id: order.id,
      reference,
      provider_transaction_id: publicPix.transactionId,
      amount,
      merchant_amount: amount,
      status: publicPix.statusCode === "3" ? "authorized" : "pending",
      pix_copy_paste: publicPix.qrCode,
      pix_qr_code_base64: publicPix.qrCodeBase64,
      expires_at: expiresAt,
      environment: "production",
      authorized_at: publicPix.statusCode === "3" ? new Date().toISOString() : null,
    });
    if (insertError && insertError.code !== "23505") throw new Error(`safe2pay_transaction_save_failed:${insertError.message}`);

    if (publicPix.statusCode === "3") {
      await admin.from("orders").update({ payment_status: "paid" }).eq("id", order.id).neq("status", "cancelled").neq("status", "refunded");
    }

    return json(200, {
      reused: false,
      orderId: order.id,
      reference,
      transactionId: publicPix.transactionId,
      status: publicPix.statusCode === "3" ? "authorized" : "pending",
      amount,
      pix: { copyPaste: publicPix.qrCode, qrCodeBase64: publicPix.qrCodeBase64 },
    });
  } catch (error) {
    console.error("[safe2pay-create-order-pix]", { message: error instanceof Error ? error.message : "unknown_error" });
    return json(502, { error: "safe2pay_charge_failed" });
  }
});
