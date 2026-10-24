import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import { importPKCS8, SignJWT } from "npm:jose@5.9.6";
import { getCorsHeaders } from "../_shared/cors.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const FIREBASE_B64 = Deno.env.get("FIREBASE_SERVICE_ACCOUNT_B64") ?? "";

function json(req: Request, body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...getCorsHeaders(req), "content-type": "application/json" },
  });
}

type ServiceAccount = {
  project_id: string;
  client_email: string;
  private_key: string;
  token_uri?: string;
};

type PushBody = {
  user_ids?: string[];
  event: string;
  title?: string;
  body?: string;
  url?: string;
  ride_id?: string;
  data?: Record<string, string>;
};

type RideRow = {
  passenger_id: string;
  driver_id: string | null;
  status: string;
};

const CLIENT_EVENT_RULES: Record<
  string,
  { actor: "driver" | "participant"; statuses: string[]; title: string; body: string }
> = {
  "ride.accepted": {
    actor: "driver",
    statuses: ["motorista_a_caminho"],
    title: "Corrida aceita",
    body: "Um motorista aceitou sua solicitação.",
  },
  "ride.driver_arrived": {
    actor: "driver",
    statuses: ["motorista_chegou"],
    title: "Motorista no local",
    body: "Seu motorista chegou ao ponto de embarque.",
  },
  "ride.started": {
    actor: "driver",
    statuses: ["em_viagem"],
    title: "Corrida iniciada",
    body: "Sua viagem começou. Tenha um bom trajeto!",
  },
  "ride.completed": {
    actor: "driver",
    statuses: ["finalizada"],
    title: "Corrida finalizada",
    body: "Você chegou ao seu destino.",
  },
  "ride.cancelled": {
    actor: "participant",
    statuses: ["cancelada_passageiro", "cancelada_motorista"],
    title: "Corrida cancelada",
    body: "A solicitação de corrida foi cancelada.",
  },
};

function readServiceAccount(): ServiceAccount {
  if (!FIREBASE_B64) throw new Error("firebase_secret_missing");
  return JSON.parse(
    new TextDecoder().decode(Uint8Array.from(atob(FIREBASE_B64), (c) => c.charCodeAt(0))),
  );
}

async function accessToken(account: ServiceAccount): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const key = await importPKCS8(account.private_key, "RS256");
  const assertion = await new SignJWT({
    scope: "https://www.googleapis.com/auth/firebase.messaging",
  })
    .setProtectedHeader({ alg: "RS256", typ: "JWT" })
    .setIssuer(account.client_email)
    .setSubject(account.client_email)
    .setAudience(account.token_uri ?? "https://oauth2.googleapis.com/token")
    .setIssuedAt(now)
    .setExpirationTime(now + 3600)
    .sign(key);

  const response = await fetch(account.token_uri ?? "https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    }),
  });
  if (!response.ok) throw new Error(`firebase_oauth_failed:${response.status}`);
  const result = await response.json();
  if (!result.access_token) throw new Error("firebase_token_missing");
  return result.access_token;
}

Deno.serve(async (req) => {
  try {
    if (req.method === "OPTIONS") return new Response(null, { headers: getCorsHeaders(req) });
    if (req.method !== "POST") return json(req, { error: "method_not_allowed" }, 405);

    const token = (req.headers.get("Authorization") ?? "")
      .replace(/^Bearer\s+/i, "")
      .trim();
    if (!token) return json(req, { error: "unauthorized" }, 401);

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const isServiceRequest = token === SERVICE_ROLE;
    let isAdmin = false;
    let callerId: string | null = null;
    let callerDomainId: string | null = null;
    let callerDriverId: string | null = null;

    if (!isServiceRequest) {
      const { data: userData, error: authError } = await admin.auth.getUser(token);
      if (authError || !userData.user) return json(req, { error: "unauthorized" }, 401);
      callerId = userData.user.id;
      // user_roles.user_id referencia public.users.id (UUID interno),
      // enquanto callerId é o UUID de auth.users -> resolver via users.auth_user_id.
      const { data: profileRow } = await admin
        .from("users")
        .select("id")
        .eq("auth_user_id", callerId)
        .maybeSingle();
      if (profileRow?.id) {
        callerDomainId = String(profileRow.id);
        const { data: driverRow } = await admin.from("drivers").select("id").eq("user_id", callerDomainId).maybeSingle();
        callerDriverId = driverRow?.id ? String(driverRow.id) : null;
        const { data: roleData } = await admin
          .from("user_roles")
          .select("role")
          .eq("user_id", profileRow.id)
          .eq("role", "admin")
          .maybeSingle();
        isAdmin = Boolean(roleData);
      }

    }

    const input = (await req.json()) as PushBody;
    if (!input.event) return json(req, { error: "invalid_payload" }, 422);

    // Diagnóstico de prontidão: NÃO envia notificação e NÃO revela segredos.
    // Retorna apenas presença/ausência e formato da configuração.
    if (input.event === "diagnostics.readiness") {
      if (!isServiceRequest && !isAdmin) return json(req, { error: "forbidden" }, 403);

      let serviceAccountShapeOk = false;
      let hasProjectId = false;
      let hasClientEmail = false;
      let privateKeyLooksPkcs8 = false;

      if (FIREBASE_B64) {
        try {
          const account = readServiceAccount();
          hasProjectId = typeof account.project_id === "string" && account.project_id.length > 0;
          hasClientEmail = typeof account.client_email === "string" && account.client_email.includes("@");
          privateKeyLooksPkcs8 =
            typeof account.private_key === "string" &&
            account.private_key.includes("BEGIN PRIVATE KEY");
          serviceAccountShapeOk = hasProjectId && hasClientEmail && privateKeyLooksPkcs8;
        } catch {
          serviceAccountShapeOk = false;
        }
      }

      const { count: activeTokens } = await admin
        .from("user_notification_tokens")
        .select("id", { count: "exact", head: true })
        .eq("is_active", true)
        .eq("permission_status", "granted");

      return json(req, {
        ok: true,
        mode: "readiness",
        sent: 0,
        firebase_secret_present: FIREBASE_B64.length > 0,
        service_account_parsable: serviceAccountShapeOk,
        service_account_fields: {
          project_id: hasProjectId,
          client_email: hasClientEmail,
          private_key_pkcs8: privateKeyLooksPkcs8,
        },
        fcm_api: "https://fcm.googleapis.com/v1/projects/{project_id}/messages:send",
        android_channel_id: "apois_rides",
        active_device_tokens: activeTokens ?? 0,
      }, 200);
    }

    let finalUserIds: string[] = [];
    let finalTitle = "";
    let finalBody = "";
    const finalUrl = input.url ?? "";
    const finalData = input.data ?? {};

    if (isServiceRequest || isAdmin) {
      if (!input.user_ids?.length || !input.title) {
        return json(req, { error: "admin_payload_incomplete" }, 422);
      }
      finalUserIds = [...new Set(input.user_ids.filter(Boolean))].slice(0, 100);
      finalTitle = input.title.slice(0, 100);
      finalBody = (input.body ?? "").slice(0, 500);
    } else {
      if (!input.ride_id || !callerId) return json(req, { error: "invalid_payload" }, 422);
      const rule = CLIENT_EVENT_RULES[input.event];
      if (!rule) return json(req, { error: "event_not_allowed" }, 403);

      const { data, error: rideError } = await admin
        .from("rides")
        .select("passenger_id,driver_id,status")
        .eq("id", input.ride_id)
        .maybeSingle();
      if (rideError || !data) return json(req, { error: "ride_not_found" }, 404);

      const ride = data as RideRow;
      const isPassenger = callerDomainId !== null && callerDomainId === ride.passenger_id;
      const isDriver = callerDriverId !== null && callerDriverId === ride.driver_id;
      const allowedActor = rule.actor === "driver" ? isDriver : isPassenger || isDriver;
      if (!allowedActor) return json(req, { error: "forbidden" }, 403);
      if (!rule.statuses.includes(ride.status)) {
        return json(req, { error: "event_status_mismatch" }, 409);
      }

      if (isDriver) {
        finalUserIds = [ride.passenger_id];
      } else if (ride.driver_id) {
        const { data: assignedDriver } = await admin.from("drivers").select("user_id").eq("id", ride.driver_id).maybeSingle();
        finalUserIds = assignedDriver?.user_id ? [String(assignedDriver.user_id)] : [];
      } else {
        finalUserIds = [];
      }
      finalTitle = rule.title;
      finalBody = rule.body;
      if (!finalUserIds.length) {
        return json(req, { ok: true, sent: 0, reason: "no_recipients_derived" }, 200);
      }
    }

    const { data: preferences } = await admin
      .from("user_notification_preferences")
      .select("user_id,ride_updates,ride_requests")
      .in("user_id", finalUserIds);
    const prefMap = new Map((preferences ?? []).map((preference) => [preference.user_id, preference]));
    const requestEvent = input.event === "driver.new_ride_request";
    const allowedUsers = finalUserIds.filter((userId) => {
      const preference = prefMap.get(userId);
      if (!preference) return true;
      return requestEvent ? preference.ride_requests !== false : preference.ride_updates !== false;
    });
    if (!allowedUsers.length) {
      return json(req, { ok: true, sent: 0, suppressed: finalUserIds.length }, 200);
    }

    // user_notification_tokens.user_id = auth.users.id (mesma identidade de rides.*_id)
    const { data: tokenRows, error: tokenError } = await admin
      .from("user_notification_tokens")
      .select("user_id,token")
      .in("user_id", allowedUsers)
      .eq("is_active", true)
      .eq("permission_status", "granted");
    if (tokenError) throw new Error(`notification_token_lookup_failed:${tokenError.message}`);
    if (!tokenRows?.length) {
      return json(req, { ok: true, sent: 0, no_tokens: allowedUsers.length }, 200);
    }


    const account = readServiceAccount();
    const bearer = await accessToken(account);
    let sent = 0;
    const failures = new Set<string>();

    for (const row of tokenRows) {
      const response = await fetch(
        `https://fcm.googleapis.com/v1/projects/${account.project_id}/messages:send`,
        {
          method: "POST",
          headers: {
            authorization: `Bearer ${bearer}`,
            "content-type": "application/json",
          },
          body: JSON.stringify({
            message: {
              token: row.token,
              notification: { title: finalTitle, body: finalBody },
              data: {
                event: input.event,
                url: finalUrl,
                ride_id: input.ride_id ?? "",
                ...finalData,
              },
              android: {
                priority: "high",
                notification: { channel_id: "apois_rides", sound: "default" },
              },
            },
          }),
        },
      );
      if (response.ok) sent += 1;
      else {
        failures.add(row.user_id);
        // Token rejeitado pelo FCM (404/UNREGISTERED) -> desativar para não reenviar.
        if (response.status === 404 || response.status === 400) {
          await admin
            .from("user_notification_tokens")
            .update({ is_active: false })
            .eq("token", row.token);
        }
      }
    }

    const { error: logError } = await admin.from("notification_logs").insert(
      allowedUsers.map((userId) => ({
        user_id: userId,
        event: input.event,
        channel: "fcm",
        title: finalTitle,
        body: finalBody || null,
        data: { url: finalUrl || null },
        ride_id: input.ride_id ?? null,
        status: failures.has(userId) ? "failed" : "sent",
      })),
    );

    if (logError) console.error("[APOIS FCM] notification_log_failed", logError.message);

    return json(req, { ok: failures.size === 0, sent, failed: failures.size }, 200);
  } catch (error) {
    console.error("[APOIS FCM]", error);
    return json(req, { error: "push_failed" }, 500);
  }
});
