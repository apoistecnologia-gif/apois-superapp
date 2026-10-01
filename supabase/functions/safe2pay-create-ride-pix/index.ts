import { createClient } from "npm:@supabase/supabase-js@2.112.1";

import {
  createSafe2PayPix,
  extractSafe2PayPixPublic,
  safe2PayFeePayer,
  safe2PayIsEnabled,
} from "./safe2pay.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-api-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Max-Age": "86400",
};

const headers = {
  ...cors,
  "content-type": "application/json; charset=utf-8",
};

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers,
  });
}

function digits(value: unknown): string {
  return String(value ?? "").replace(/\D/g, "");
}

function money(value: unknown): number {
  const parsed = Number(value);

  return Number.isFinite(parsed)
    ? Math.round(parsed * 100) / 100
    : 0;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: cors,
    });
  }

  if (req.method !== "POST") {
    return json(405, {
      error: "method_not_allowed",
    });
  }

  if (!safe2PayIsEnabled()) {
    return json(503, {
      error: "safe2pay_provider_disabled",
      code: "PAYMENT_PROVIDER_NOT_READY",
    });
  }

  const supabaseUrl =
    Deno.env.get("SUPABASE_URL") ?? "";

  const anonKey =
    Deno.env.get("SUPABASE_ANON_KEY") ?? "";

  const serviceRole =
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

  if (!supabaseUrl || !anonKey || !serviceRole) {
    return json(500, {
      error: "server_configuration_missing",
    });
  }

  const authorization =
    req.headers.get("Authorization") ?? "";

  const token = authorization
    .replace(/^Bearer\s+/i, "")
    .trim();

  if (!token) {
    return json(401, {
      error: "unauthorized",
    });
  }

  const auth = createClient(
    supabaseUrl,
    anonKey,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    },
  );

  const admin = createClient(
    supabaseUrl,
    serviceRole,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    },
  );

  const {
    data: authData,
    error: authError,
  } = await auth.auth.getUser(token);

  if (authError || !authData.user) {
    return json(401, {
      error: "unauthorized",
    });
  }

  const body = await req
    .json()
    .catch(() => ({})) as Record<string, unknown>;

  const rideId =
    String(body.ride_id ?? "");

  if (!UUID_RE.test(rideId)) {
    return json(400, {
      error: "invalid_ride_id",
    });
  }

  try {
    const {
      data: domainUser,
      error: domainError,
    } = await admin
      .from("users")
      .select("id,name,email,phone,cpf")
      .eq("auth_user_id", authData.user.id)
      .maybeSingle();

    if (domainError) {
      throw new Error(
        `passenger_lookup_failed:${domainError.message}`,
      );
    }

    if (!domainUser?.id) {
      return json(404, {
        error: "passenger_profile_not_found",
      });
    }

    const {
      data: ride,
      error: rideError,
    } = await admin
      .from("rides")
      .select(
        "id,passenger_id,driver_id,accepted_driver_id,status,estimated_price,final_price,fare_amount_cents,processing_fee_cents,passenger_charge_cents,payment_method,payment_status,origin_name,destination_name",
      )
      .eq("id", rideId)
      .eq("passenger_id", domainUser.id)
      .maybeSingle();

    if (rideError) {
      throw new Error(
        `ride_lookup_failed:${rideError.message}`,
      );
    }

    if (!ride) {
      return json(404, {
        error: "ride_not_found",
      });
    }

    if (
      [
        "cancelada_passageiro",
        "cancelada_motorista",
        "finalizada",
      ].includes(String(ride.status))
    ) {
      return json(409, {
        error: "ride_not_payable",
      });
    }

    if (ride.payment_method !== "pix") {
      return json(409, {
        error: "ride_payment_method_not_pix",
      });
    }

    if (ride.payment_status === "paid") {
      return json(409, {
        error: "ride_already_paid",
      });
    }

    if (ride.status !== "aguardando_pagamento") {
      return json(409, {
        error: "ride_not_awaiting_payment",
        status: ride.status,
      });
    }

    const driverId = String(
      ride.accepted_driver_id ??
        ride.driver_id ??
        "",
    );

    if (!UUID_RE.test(driverId)) {
      return json(409, {
        error: "driver_not_assigned",
      });
    }

    const {
      data: receiver,
      error: receiverError,
    } = await admin
      .from("driver_safe2pay_accounts")
      .select(
        "safe2pay_receiver_id,status,environment",
      )
      .eq("driver_id", driverId)
      .eq("status", "active")
      .maybeSingle();

    if (receiverError) {
      throw new Error(
        `safe2pay_receiver_lookup_failed:${receiverError.message}`,
      );
    }

    if (!receiver?.safe2pay_receiver_id) {
      return json(409, {
        error:
          "driver_safe2pay_receiver_not_ready",
      });
    }

    if (receiver.environment !== "production") {
      return json(409, {
        error:
          "driver_safe2pay_receiver_not_production",
      });
    }

    const fareCents = Number(
      ride.fare_amount_cents ??
        Math.round(
          money(
            ride.final_price ??
              ride.estimated_price,
          ) * 100,
        ),
    );

    const processingFeeCents =
      Number(
        ride.processing_fee_cents ?? 0,
      );

    const passengerChargeCents =
      Number(
        ride.passenger_charge_cents ??
          (fareCents + processingFeeCents),
      );

    if (
      !Number.isInteger(fareCents) ||
      fareCents <= 0
    ) {
      return json(409, {
        error: "ride_fare_invalid",
      });
    }

    if (
      !Number.isInteger(processingFeeCents) ||
      processingFeeCents < 0
    ) {
      return json(409, {
        error:
          "ride_processing_fee_invalid",
      });
    }

    if (
      !Number.isInteger(
        passengerChargeCents,
      ) ||
      passengerChargeCents !==
        fareCents + processingFeeCents
    ) {
      return json(409, {
        error:
          "ride_passenger_charge_invalid",
      });
    }

    const fareAmount =
      fareCents / 100;

    const processingFee =
      processingFeeCents / 100;

    const amount =
      passengerChargeCents / 100;

    const cpf =
      digits(domainUser.cpf);

    if (cpf.length !== 11) {
      return json(409, {
        error: "passenger_cpf_required",
      });
    }

    const name = String(
      domainUser.name ??
        authData.user.user_metadata
          ?.full_name ??
        "",
    ).trim();

    if (!name) {
      return json(409, {
        error:
          "passenger_name_required",
      });
    }

    const {
      data: existing,
      error: existingError,
    } = await admin
      .from("safe2pay_ride_transactions")
      .select(
        "id,provider_transaction_id,status,amount,reference,pix_copy_paste,pix_qr_code_base64,expires_at",
      )
      .eq("ride_id", ride.id)
      .in("status", [
        "pending",
        "processing",
        "authorized",
      ])
      .order("created_at", {
        ascending: false,
      })
      .limit(1)
      .maybeSingle();

    if (existingError) {
      throw new Error(
        `safe2pay_existing_lookup_failed:${existingError.message}`,
      );
    }

    if (existing) {
      const expiresAt =
        existing.expires_at
          ? Date.parse(
              String(
                existing.expires_at,
              ),
            )
          : Number.POSITIVE_INFINITY;

      const expiredLocally =
        [
          "pending",
          "processing",
        ].includes(
          String(existing.status),
        ) &&
        Number.isFinite(expiresAt) &&
        expiresAt <= Date.now();

      if (expiredLocally) {
        const {
          error: expireError,
        } = await admin
          .from(
            "safe2pay_ride_transactions",
          )
          .update({
            status: "expired",
            updated_at:
              new Date().toISOString(),
          })
          .eq("id", existing.id)
          .in("status", [
            "pending",
            "processing",
          ]);

        if (expireError) {
          throw new Error(
            `safe2pay_expire_local_failed:${expireError.message}`,
          );
        }
      } else {
        return json(200, {
          reused: true,
          reference:
            existing.reference,
          transactionId:
            existing.provider_transaction_id,
          status:
            existing.status,
          amount:
            existing.amount,
          pix: {
            copyPaste:
              existing.pix_copy_paste ??
              null,
            qrCodeBase64:
              existing.pix_qr_code_base64 ??
              null,
          },
        });
      }
    }

    const reference =
      `apois-ride-${ride.id}-${crypto.randomUUID()}`;

    const expiresAt =
      new Date(
        Date.now() + 600_000,
      ).toISOString();

    const feePayer =
      safe2PayFeePayer();

    if (feePayer !== "platform") {
      return json(503, {
        error:
          "safe2pay_fee_policy_incompatible",
        code:
          "DRIVER_MUST_RECEIVE_FULL_FARE",
      });
    }

    /*
     * MODO TEMPORÁRIO DE HOMOLOGAÇÃO
     *
     * Enquanto SAFE2PAY_PIX_HOMOLOGATION_DRIVER_ONLY=1:
     *
     * - somente o valor da corrida é cobrado;
     * - 100% desse valor vai para a subconta do motorista;
     * - nenhuma taxa da APOIS é incluída;
     * - não é necessário conhecer ainda o IdReceiver da conta principal;
     * - o Pix geral continua controlado externamente.
     */

    const homologationDriverOnly =
      (
        Deno.env.get(
          "SAFE2PAY_PIX_HOMOLOGATION_DRIVER_ONLY",
        ) ?? ""
      ) === "1";

    /*
     * Fail-closed:
     *
     * fora da homologação, se existir taxa da plataforma,
     * recusamos gerar o Pix até o receiver principal da
     * APOIS ser configurado corretamente.
     */

    if (
      !homologationDriverOnly &&
      processingFee > 0
    ) {
      return json(503, {
        error:
          "safe2pay_marketplace_receiver_id_required",
        code:
          "PLATFORM_RECEIVER_NOT_CONFIGURED",
      });
    }

    /*
     * Durante homologação:
     * passageiro paga apenas o valor da corrida.
     */

    const providerAmount =
      homologationDriverOnly
        ? fareAmount
        : amount;

    /*
     * Split temporário:
     * 100% do valor enviado à Safe2Pay vai
     * para a subconta do motorista.
     */

    const splits = [
      {
        IdReceiver: Number(
          receiver.safe2pay_receiver_id,
        ),
        CodeTaxType: 2 as const,
        Amount: providerAmount,
        IsPayTax: false,
      },
    ];

    const providerPayload =
      await createSafe2PayPix({
        reference,

        vendor:
          "APOIS Corridas",

        customer: {
          Name: name,

          Identity: cpf,

          Phone:
            digits(
              domainUser.phone,
            ) || undefined,

          Email:
            String(
              domainUser.email ??
                authData.user.email ??
                "",
            ).trim() ||
            undefined,
        },

        products: [
          {
            Code:
              String(ride.id),

            Description:
              `Corrida APOIS: ${String(
                ride.origin_name ?? "",
              )} → ${String(
                ride.destination_name ??
                  "",
              )}`.slice(
                0,
                200,
              ),

            UnitPrice:
              providerAmount,

            Quantity: 1,
          },
        ],

        expirationSeconds:
          600,

        splits,
      });

    const publicPix =
      extractSafe2PayPixPublic(
        providerPayload,
      );

    if (
      !publicPix.transactionId
    ) {
      throw new Error(
        "safe2pay_transaction_id_missing",
      );
    }

    const {
      error: insertError,
    } = await admin
      .from(
        "safe2pay_ride_transactions",
      )
      .insert({
        ride_id:
          ride.id,

        reference,

        provider_transaction_id:
          publicPix.transactionId,

        amount:
          providerAmount,

        status:
          publicPix.statusCode ===
          "3"
            ? "authorized"
            : "pending",

        receiver_id:
          Number(
            receiver.safe2pay_receiver_id,
          ),

        pix_copy_paste:
          publicPix.qrCode,

        pix_qr_code_base64:
          publicPix.qrCodeBase64,

        expires_at:
          expiresAt,

        environment:
          "production",

        authorized_at:
          publicPix.statusCode ===
          "3"
            ? new Date().toISOString()
            : null,
      });

    if (
      insertError &&
      insertError.code !== "23505"
    ) {
      throw new Error(
        `safe2pay_transaction_save_failed:${insertError.message}`,
      );
    }

    const ridePatch:
      Record<string, unknown> = {
        payment_provider:
          "safe2pay",

        provider_payment_id:
          String(
            publicPix.transactionId,
          ),

        payment_status:
          publicPix.statusCode ===
          "3"
            ? "paid"
            : "pending",

        updated_at:
          new Date().toISOString(),
      };

    if (
      publicPix.statusCode ===
      "3"
    ) {
      ridePatch.payment_confirmed_at =
        new Date().toISOString();
    }

    const {
      error: ridePatchError,
    } = await admin
      .from("rides")
      .update(
        ridePatch,
      )
      .eq(
        "id",
        ride.id,
      )
      .eq(
        "passenger_id",
        domainUser.id,
      );

    if (ridePatchError) {
      throw new Error(
        `ride_payment_state_failed:${ridePatchError.message}`,
      );
    }

    return json(200, {
      reused: false,

      reference,

      transactionId:
        publicPix.transactionId,

      status:
        publicPix.statusCode ===
        "3"
          ? "authorized"
          : "pending",

      amount:
        providerAmount,

      homologationDriverOnly,

      pix: {
        copyPaste:
          publicPix.qrCode,

        qrCodeBase64:
          publicPix.qrCodeBase64,
      },
    });
  } catch (error) {
    console.error(
      "[safe2pay-create-ride-pix]",
      {
        message:
          error instanceof Error
            ? error.message
            : "unknown_error",
      },
    );

    return json(502, {
      error:
        "safe2pay_charge_failed",
    });
  }
});