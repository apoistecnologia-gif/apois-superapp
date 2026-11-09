import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
const workspace = resolve(root, '.work/corridas');

function patch(relativePath, transform, verify, label) {
  const path = resolve(workspace, relativePath);
  if (!existsSync(path)) throw new Error(`[FAIL] ${label}: arquivo ausente ${relativePath}`);
  const before = readFileSync(path, 'utf8');
  const after = transform(before);
  if (!verify(after)) throw new Error(`[FAIL] ${label}: contrato final não confirmado em ${relativePath}`);
  if (after !== before) writeFileSync(path, after, 'utf8');
  console.log(`[OK] ${label}${after === before ? ' (já aplicado)' : ''}`);
}

patch('supabase/functions/request-ride/index.ts', (source) => {
  let next = source;

  next = next.replace(
    '      "user_id, category, is_online, approval_status, current_lat, current_lng, last_location_at",',
    '      "id,user_id,category,is_online,approval_status,current_lat,current_lng,last_location_at",',
  );

  const oldSubscriptions = `  const driverIds = (drivers ?? []).map((driver: any) => String(driver.user_id)).filter(Boolean);\n  const { data: activeSubscriptions, error: subscriptionsError } = driverIds.length\n    ? await admin\n        .from("subscriptions")\n        .select("driver_id")\n        .in("driver_id", driverIds)`;
  const newSubscriptions = `  const driverRecordIds = (drivers ?? []).map((driver: any) => String(driver.id)).filter(Boolean);\n  const driverDomainUserIds = (drivers ?? []).map((driver: any) => String(driver.user_id)).filter(Boolean);\n\n  // subscriptions.driver_id referencia public.drivers(id), enquanto drivers.user_id\n  // referencia public.users(id). Nunca misturar os dois identificadores.\n  const { data: activeSubscriptions, error: subscriptionsError } = driverRecordIds.length\n    ? await admin\n        .from("subscriptions")\n        .select("driver_id")\n        .in("driver_id", driverRecordIds)`;
  if (next.includes(oldSubscriptions)) next = next.replace(oldSubscriptions, newSubscriptions);

  const oldPreferences = `  const { data: preferences, error: preferencesError } = driverIds.length\n    ? await admin\n        .from("driver_preferences")\n        .select(\n          "user_id,ride_alerts,accept_short,accept_long,max_radius_km,accept_cash,accept_pix,accept_card",\n        )\n        .in("user_id", driverIds)\n    : { data: [], error: null };\n  if (preferencesError)\n    throw new Error(\`Falha ao buscar preferências dos motoristas: \${preferencesError.message}\`);\n  const preferencesByDriver = new Map(\n    (preferences ?? []).map((pref: any) => [String(pref.user_id), pref]),\n  );`;
  const newPreferences = `  // driver_preferences.user_id é AUTH ID no schema legado dessa tabela.\n  // Resolve explicitamente public.users.auth_user_id a partir do DOMAIN USER ID\n  // do motorista antes de consultar preferências.\n  const { data: driverUsers, error: driverUsersError } = driverDomainUserIds.length\n    ? await admin\n        .from("users")\n        .select("id,auth_user_id")\n        .in("id", driverDomainUserIds)\n    : { data: [], error: null };\n  if (driverUsersError)\n    throw new Error(\`Falha ao resolver identidade dos motoristas: \${driverUsersError.message}\`);\n  const authByDomainUser = new Map(\n    (driverUsers ?? []).map((row: any) => [String(row.id), String(row.auth_user_id ?? "")]),\n  );\n  const domainByAuthUser = new Map(\n    Array.from(authByDomainUser.entries()).filter(([, authId]) => authId).map(([domainId, authId]) => [authId, domainId]),\n  );\n  const driverAuthIds = Array.from(domainByAuthUser.keys());\n\n  const { data: preferences, error: preferencesError } = driverAuthIds.length\n    ? await admin\n        .from("driver_preferences")\n        .select(\n          "user_id,ride_alerts,accept_short,accept_long,max_radius_km,accept_cash,accept_pix,accept_card",\n        )\n        .in("user_id", driverAuthIds)\n    : { data: [], error: null };\n  if (preferencesError)\n    throw new Error(\`Falha ao buscar preferências dos motoristas: \${preferencesError.message}\`);\n  const preferencesByDriver = new Map(\n    (preferences ?? []).flatMap((pref: any) => {\n      const domainId = domainByAuthUser.get(String(pref.user_id));\n      return domainId ? [[domainId, pref] as const] : [];\n    }),\n  );`;
  if (next.includes(oldPreferences)) next = next.replace(oldPreferences, newPreferences);

  next = next.replace(
    '      if (!entitledDrivers.has(String(d.user_id))) return false;',
    '      if (!entitledDrivers.has(String(d.id))) return false;',
  );
  next = next.replaceAll(
    '      const active = activeByDriver.get(String(d.user_id));',
    '      const active = activeByDriver.get(String(d.id));',
  );
  next = next.replace(
    '      if (queuedDrivers.has(String(d.user_id))) return false;',
    '      if (queuedDrivers.has(String(d.id))) return false;',
  );

  // O contrato das listas de oferta continua sendo DOMAIN USER ID, pois elas não
  // são FKs de public.drivers. driver-ride-action resolve o mesmo domínio antes
  // de aceitar/rejeitar. driver_id/accepted_driver_id, por outro lado, são FKs
  // para public.drivers(id).
  next = next.replace(
    '            cancel_reason: "Nenhum motorista disponível no momento.",',
    '            cancellation_reason: "Nenhum motorista disponível no momento.",',
  );

  return next;
}, (source) =>
  source.includes('"id,user_id,category,is_online,approval_status,current_lat,current_lng,last_location_at"') &&
  ((source.includes('const driverRecordIds =') &&
    source.includes('.in("driver_id", driverRecordIds)')) ||
   (!source.includes('.from("subscriptions")') && !source.includes('entitledDrivers'))) &&
  source.includes('const driverDomainUserIds =') &&
  source.includes('.select("id,auth_user_id")') &&
  source.includes('const domainByAuthUser =') &&
  source.includes('activeByDriver.get(String(d.id))') &&
  source.includes('cancellation_reason: "Nenhum motorista disponível no momento."') &&
  !source.includes('cancel_reason: "Nenhum motorista disponível no momento."') &&
  !source.includes('.in("driver_id", driverIds)'),
'Corridas backend: dispatch separa driver record, domain user e auth user');

patch('supabase/functions/driver-ride-action/index.ts', (source) => {
  let next = source;

  next = next.replace(
    '    const userId = authData.user?.id;\n    if (authError || !userId) {',
    '    const authUserId = authData.user?.id;\n    if (authError || !authUserId) {',
  );

  const oldDriverLookup = `    const { data: driver, error: driverError } = await admin\n      .from("drivers")\n      .select(\n        "user_id,name,phone,rating,vehicle_model,vehicle_color,vehicle_plate,approval_status,is_online",\n      )\n      .eq("user_id", userId)\n      .maybeSingle();`;
  const newDriverLookup = `    const { data: domainUser, error: domainUserError } = await admin\n      .from("users")\n      .select("id")\n      .eq("auth_user_id", authUserId)\n      .maybeSingle();\n    if (domainUserError)\n      return json({ error: "driver_identity_lookup_failed", detail: domainUserError.message }, 500, req);\n    if (!domainUser?.id) return json({ error: "driver_profile_not_found" }, 404, req);\n    const domainUserId = String(domainUser.id);\n\n    const { data: driver, error: driverError } = await admin\n      .from("drivers")\n      .select(\n        "id,user_id,name,phone,rating,vehicle_model,vehicle_color,vehicle_plate,approval_status,is_online",\n      )\n      .eq("user_id", domainUserId)\n      .maybeSingle();`;
  if (next.includes(oldDriverLookup)) next = next.replace(oldDriverLookup, newDriverLookup);

  if (!next.includes('const driverRecordId = String(driver.id);')) {
    next = next.replace(
      '    if (driver.approval_status !== "aprovado") {\n      return json({ error: "driver_not_approved" }, 403, req);\n    }',
      '    if (driver.approval_status !== "aprovado") {\n      return json({ error: "driver_not_approved" }, 403, req);\n    }\n    const driverRecordId = String(driver.id);',
    );
  }

  next = next
    .replaceAll('candidates.includes(userId)', 'candidates.includes(domainUserId)')
    .replaceAll('offered.includes(userId)', 'offered.includes(domainUserId)')
    .replaceAll('rejected.add(userId)', 'rejected.add(domainUserId)')
    .replaceAll('id !== userId', 'id !== domainUserId')
    .replaceAll('=== userId\n              ? null', '=== domainUserId\n              ? null')
    .replaceAll('=== userId) {', '=== driverRecordId) {')
    .replace('          driver_id: userId,\n          accepted_driver_id: userId,', '          driver_id: driverRecordId,\n          accepted_driver_id: driverRecordId,')
    .replaceAll('String(ride.driver_id ?? "") !== userId', 'String(ride.driver_id ?? "") !== driverRecordId')
    .replaceAll('.eq("driver_id", userId)', '.eq("driver_id", driverRecordId)');

  return next;
}, (source) =>
  source.includes('const authUserId = authData.user?.id;') &&
  source.includes('.eq("auth_user_id", authUserId)') &&
  source.includes('const domainUserId = String(domainUser.id);') &&
  source.includes('"id,user_id,name,phone,rating,vehicle_model,vehicle_color,vehicle_plate,approval_status,is_online"') &&
  source.includes('.eq("user_id", domainUserId)') &&
  source.includes('const driverRecordId = String(driver.id);') &&
  source.includes('candidates.includes(domainUserId)') &&
  source.includes('driver_id: driverRecordId') &&
  source.includes('accepted_driver_id: driverRecordId') &&
  source.includes('.eq("driver_id", driverRecordId)') &&
  !source.includes('.eq("user_id", userId)') &&
  !source.includes('driver_id: userId'),
'Corridas backend: ação do motorista resolve AUTH -> DOMAIN USER -> DRIVER record');

patch('supabase/functions/send-ride-push/index.ts', (source) => {
  let next = source;

  if (!next.includes('async function normalizeRecipientDomainIds')) {
    const insertionPoint = 'Deno.serve(async (req) => {';
    const helper = "async function normalizeRecipientDomainIds(admin: any, ids: string[]): Promise<string[]> {\n  const unique = [...new Set(ids.map(String).filter(Boolean))];\n  if (!unique.length) return [];\n  // Push preferences, tokens and logs reference public.users(id), not auth.users(id).\n  // Reject unknown and mixed identity namespaces rather than guessing.\n  if (unique.length > 100) throw new Error(\"too_many_recipients\");\n  const { data: rows, error } = await admin\n    .from(\"users\")\n    .select(\"id\")\n    .in(\"id\", unique);\n  if (error) throw new Error(\"push_identity_lookup_failed\");\n  const valid = new Set((rows ?? []).map((row: any) => String(row.id)));\n  if (unique.some((id) => !valid.has(id))) throw new Error(\"push_recipient_not_domain_user\");\n  return unique;\n}\n\n";
    next = next.replace(insertionPoint, helper + insertionPoint);
  }

  if (!next.includes('let callerDomainUserId: string | null = null;')) {
    next = next.replace(
      '    let isAdmin = false;\n    let callerId: string | null = null;',
      '    let isAdmin = false;\n    let callerId: string | null = null; // AUTH ID\n    let callerDomainUserId: string | null = null;\n    let callerDriverRecordId: string | null = null;',
    );
  }

  const oldProfileAdminBlock = `      const { data: profileRow } = await admin\n        .from("users")\n        .select("id")\n        .eq("auth_user_id", callerId)\n        .maybeSingle();\n      if (profileRow?.id) {\n        const { data: roleData } = await admin\n          .from("user_roles")\n          .select("role")\n          .eq("user_id", profileRow.id)\n          .eq("role", "admin")\n          .maybeSingle();\n        isAdmin = Boolean(roleData);\n      }`;
  const newProfileAdminBlock = `      const { data: profileRow } = await admin\n        .from("users")\n        .select("id")\n        .eq("auth_user_id", callerId)\n        .maybeSingle();\n      callerDomainUserId = profileRow?.id ? String(profileRow.id) : null;\n      if (callerDomainUserId) {\n        const [{ data: roleData }, { data: driverRow }] = await Promise.all([\n          admin\n            .from("user_roles")\n            .select("role")\n            .eq("user_id", callerDomainUserId)\n            .eq("role", "admin")\n            .maybeSingle(),\n          admin\n            .from("drivers")\n            .select("id")\n            .eq("user_id", callerDomainUserId)\n            .maybeSingle(),\n        ]);\n        isAdmin = Boolean(roleData);\n        callerDriverRecordId = driverRow?.id ? String(driverRow.id) : null;\n      }`;
  if (next.includes(oldProfileAdminBlock)) next = next.replace(oldProfileAdminBlock, newProfileAdminBlock);

  next = next.replace(
    '      finalUserIds = [...new Set(input.user_ids.filter(Boolean))].slice(0, 100);',
    '      if (input.user_ids.length > 100) return json(req, { error: "too_many_recipients", maximum: 100 }, 422);\n      finalUserIds = await normalizeRecipientDomainIds(admin, input.user_ids);',
  );

  const oldActorBlock = `      const ride = data as RideRow;\n      const isPassenger = callerId === ride.passenger_id;\n      const isDriver = callerId === ride.driver_id;\n      const allowedActor = rule.actor === "driver" ? isDriver : isPassenger || isDriver;`;
  const newActorBlock = `      const ride = data as RideRow;\n      const isPassenger = Boolean(callerDomainUserId && callerDomainUserId === String(ride.passenger_id));\n      const isDriver = Boolean(callerDriverRecordId && callerDriverRecordId === String(ride.driver_id ?? ""));\n      const allowedActor = rule.actor === "driver" ? isDriver : isPassenger || isDriver;`;
  if (next.includes(oldActorBlock)) next = next.replace(oldActorBlock, newActorBlock);

  const oldRecipients = `      finalUserIds = isDriver\n        ? [ride.passenger_id]\n        : ride.driver_id\n          ? [ride.driver_id]\n          : [];`;
  const newRecipients = `      if (isDriver) {\n        finalUserIds = await normalizeRecipientDomainIds(admin, [ride.passenger_id]);\n      } else if (ride.driver_id) {\n        const { data: assignedDriver, error: assignedDriverError } = await admin\n          .from("drivers")\n          .select("user_id")\n          .eq("id", ride.driver_id)\n          .maybeSingle();\n        if (assignedDriverError)\n          throw new Error(\`push_driver_identity_lookup_failed:\${assignedDriverError.message}\`);\n        finalUserIds = assignedDriver?.user_id\n          ? await normalizeRecipientDomainIds(admin, [String(assignedDriver.user_id)])\n          : [];\n      } else {\n        finalUserIds = [];\n      }`;
  if (next.includes(oldRecipients)) next = next.replace(oldRecipients, newRecipients);

  next = next.replace(
    '    // user_notification_tokens.user_id = auth.users.id (mesma identidade de rides.*_id)',
    '    // user_notification_tokens/user_notification_preferences/notification_logs usam public.users(id); rides usam DOMAIN/DRIVER IDs.',
  );

  return next;
}, (source) =>
  source.includes('async function normalizeRecipientDomainIds') &&
  source.includes('let callerDomainUserId: string | null = null;') &&
  source.includes('let callerDriverRecordId: string | null = null;') &&
  source.includes('callerDomainUserId === String(ride.passenger_id)') &&
  source.includes('callerDriverRecordId === String(ride.driver_id ?? "")') &&
  source.includes('finalUserIds = await normalizeRecipientDomainIds(admin, input.user_ids);') &&
  source.includes('.eq("id", ride.driver_id)') &&
  // INV03 later reconciles the canonical FCM body on the disposable workspace.
  // Verify real domain-user queries, not a comment that its canonical copy replaces.
  source.includes('.from("user_notification_preferences")') &&
  source.includes('.in("user_id", finalUserIds)') &&
  source.includes('.from("user_notification_tokens")') &&
  source.includes('.in("user_id", allowedUsers)') &&
  source.includes('.from("notification_logs").insert(') &&
  source.includes('user_id: userId') &&
  !source.includes('const isPassenger = callerId === ride.passenger_id;') &&
  !source.includes('const isDriver = callerId === ride.driver_id;'),
'Corridas backend: Push preserva DOMAIN USER ID em tokens, preferências e logs');

console.log('[OK] Corridas backend identity boundary concluído sem alterar o submódulo protegido');
