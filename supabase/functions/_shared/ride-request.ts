export const MAX_INTERMEDIATES = 3;
export const RIDE_CATEGORY_CODES = ["carros", "motos", "fretes", "guincho", "envios"] as const;
export const PAYMENT_METHOD_CODES = ["pix", "credit", "debit", "cash", "wallet"] as const;

export type RideCategoryCode = (typeof RIDE_CATEGORY_CODES)[number];
export type PaymentMethodCode = (typeof PAYMENT_METHOD_CODES)[number];

export type RidePoint = {
  lat: number;
  lng: number;
  label?: string;
  address?: string;
  place_id?: string | null;
  source?: string;
};

export type CanonicalRideRequest = {
  request_key: string;
  category: RideCategoryCode;
  origin: RidePoint;
  origin_name: string;
  destination: RidePoint;
  destination_name: string;
  intermediates: RidePoint[];
  payment_method: PaymentMethodCode;
  service_details: Record<string, unknown> | null;
  pickup_notes: string | null;
  scheduled_for: string | null;
  coupon_code: string | null;
};

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function cleanText(value: unknown, maxLength: number): string {
  return String(value ?? "").trim().replace(/\s+/g, " ").slice(0, maxLength);
}

function validPoint(value: unknown): value is RidePoint {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const point = value as Partial<RidePoint>;
  return typeof point.lat === "number" && Number.isFinite(point.lat) && point.lat >= -90 && point.lat <= 90
    && typeof point.lng === "number" && Number.isFinite(point.lng) && point.lng >= -180 && point.lng <= 180;
}

export function normalizeRideCategory(value: unknown): RideCategoryCode | null {
  const normalized = cleanText(value, 30).toLowerCase();
  const aliases: Record<string, RideCategoryCode> = {
    carro: "carros", car: "carros", carros: "carros",
    moto: "motos", motos: "motos",
    frete: "fretes", fretes: "fretes", moving: "fretes",
    guincho: "guincho", tow: "guincho",
    envio: "envios", envios: "envios",
  };
  return aliases[normalized] ?? null;
}

export function normalizePaymentMethod(value: unknown): PaymentMethodCode | null {
  const normalized = cleanText(value, 40).toLowerCase();
  const aliases: Record<string, PaymentMethodCode> = {
    pix: "pix",
    credit: "credit", card: "credit", credit_card: "credit", credito: "credit", "crédito": "credit",
    debit: "debit", debit_card: "debit", debito: "debit", "débito": "debit",
    cash: "cash", money: "cash", dinheiro: "cash",
    wallet: "wallet", carteira: "wallet",
  };
  return aliases[normalized] ?? null;
}

export function parseRideRequest(input: unknown): CanonicalRideRequest {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new Error("invalid_request_body");
  const body = input as Record<string, unknown>;

  const requestKey = cleanText(body.request_key, 50);
  if (!UUID_PATTERN.test(requestKey)) throw new Error("invalid_request_key");

  if (!validPoint(body.origin) || !validPoint(body.destination)) throw new Error("invalid_coordinates");

  const rawIntermediates = body.intermediates == null ? [] : body.intermediates;
  if (!Array.isArray(rawIntermediates) || rawIntermediates.length > MAX_INTERMEDIATES || rawIntermediates.some((point) => !validPoint(point))) {
    throw new Error("invalid_intermediates");
  }

  const category = normalizeRideCategory(body.category);
  if (!category) throw new Error("invalid_category");

  const paymentMethod = normalizePaymentMethod(body.payment_method);
  if (!paymentMethod) throw new Error("payment_method_required");

  const originName = cleanText(body.origin_name ?? (body.origin as RidePoint).label, 200);
  const destinationName = cleanText(body.destination_name ?? (body.destination as RidePoint).label, 200);
  if (!originName || !destinationName) throw new Error("missing_address");

  let serviceDetails: Record<string, unknown> | null = null;
  if (body.service_details != null) {
    if (typeof body.service_details !== "object" || Array.isArray(body.service_details)) throw new Error("invalid_service_details");
    const encoded = JSON.stringify(body.service_details);
    if (encoded.length > 12_000) throw new Error("service_details_too_large");
    serviceDetails = JSON.parse(encoded) as Record<string, unknown>;
  }

  let scheduledFor: string | null = null;
  if (body.scheduled_for != null && cleanText(body.scheduled_for, 80)) {
    const date = new Date(String(body.scheduled_for));
    if (!Number.isFinite(date.getTime())) throw new Error("invalid_scheduled_for");
    scheduledFor = date.toISOString();
  }

  return {
    request_key: requestKey,
    category,
    origin: body.origin as RidePoint,
    origin_name: originName,
    destination: body.destination as RidePoint,
    destination_name: destinationName,
    intermediates: rawIntermediates as RidePoint[],
    payment_method: paymentMethod,
    service_details: serviceDetails,
    pickup_notes: cleanText(body.pickup_notes, 500) || null,
    scheduled_for: scheduledFor,
    coupon_code: cleanText(body.coupon_code, 100) || null,
  };
}
