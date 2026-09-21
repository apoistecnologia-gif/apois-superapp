type Safe2PaySplit = {
  IdReceiver: number;
  CodeTaxType: 2;
  Amount: number;
  IsPayTax: boolean;
};

type Safe2PayCustomer = {
  Name: string;
  Identity: string;
  Phone?: string;
  Email?: string;
  Address?: Record<string, unknown>;
};

type Safe2PayProduct = {
  Code: string;
  Description: string;
  UnitPrice: number;
  Quantity: number;
};

type Safe2PayPixInput = {
  reference: string;
  vendor: string;
  customer: Safe2PayCustomer;
  products: Safe2PayProduct[];
  expirationSeconds?: number;
  splits: Safe2PaySplit[];
};

const PAYMENT_URL = "https://payment.safe2pay.com.br/v2/payment";
const SUBACCOUNT_URL = "https://api.safe2pay.com.br/v2/marketplace/add";

function env(name: string): string {
  return (Deno.env.get(name) ?? "").trim();
}

export function safe2PayIsEnabled(): boolean {
  return env("SAFE2PAY_PROVIDER_ENABLED") === "1";
}

function environment(): string {
  return env("SAFE2PAY_ENVIRONMENT").toLowerCase() || "production";
}

function productionApiKey(): string {
  const key = env("SAFE2PAY_API_KEY");
  if (!key) throw new Error("safe2pay_production_api_key_missing");
  return key;
}

function callbackUrl(): string {
  const value = env("SAFE2PAY_CALLBACK_URL");
  if (!value || !value.startsWith("https://")) throw new Error("safe2pay_callback_url_invalid");
  return value;
}

export function assertSafe2PayReady(): void {
  if (!safe2PayIsEnabled()) throw new Error("safe2pay_provider_disabled");
  productionApiKey();
  callbackUrl();
}

function normalizeMoney(value: number): number {
  if (!Number.isFinite(value) || value < 0) throw new Error("safe2pay_invalid_amount");
  return Math.round(value * 100) / 100;
}

function productsTotal(products: Safe2PayProduct[]): number {
  return normalizeMoney(products.reduce((sum, product) => {
    const unit = normalizeMoney(product.UnitPrice);
    const quantity = Number(product.Quantity);
    if (!Number.isInteger(quantity) || quantity <= 0) throw new Error("safe2pay_invalid_quantity");
    return sum + unit * quantity;
  }, 0));
}

export function validateFixedSplits(total: number, splits: Safe2PaySplit[]): Safe2PaySplit[] {
  if (!splits.length) throw new Error("safe2pay_split_required");
  const normalized = splits.map((split) => {
    const receiver = Number(split.IdReceiver);
    if (!Number.isInteger(receiver) || receiver <= 0) throw new Error("safe2pay_invalid_receiver");
    if (split.CodeTaxType !== 2) throw new Error("safe2pay_split_must_use_fixed_amount");
    return {
      IdReceiver: receiver,
      CodeTaxType: 2 as const,
      Amount: normalizeMoney(split.Amount),
      IsPayTax: split.IsPayTax === true,
    };
  });
  const splitTotal = normalizeMoney(normalized.reduce((sum, split) => sum + split.Amount, 0));
  if (Math.round(splitTotal * 100) !== Math.round(normalizeMoney(total) * 100)) {
    throw new Error("safe2pay_split_total_mismatch");
  }
  return normalized;
}

async function safe2PayFetch(url: string, body: unknown): Promise<Record<string, unknown>> {
  assertSafe2PayReady();
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "X-API-KEY": productionApiKey(),
    },
    body: JSON.stringify(body),
  });
  const payload = await response.json().catch(() => ({})) as Record<string, unknown>;
  if (!response.ok || payload.HasError === true) {
    const code = String(payload.ErrorCode ?? response.status);
    throw new Error(`safe2pay_request_failed:${code}`);
  }
  return payload;
}

export async function createSafe2PayPix(input: Safe2PayPixInput): Promise<Record<string, unknown>> {
  const reference = String(input.reference ?? "").trim();
  if (reference.length < 3 || reference.length > 200) throw new Error("safe2pay_invalid_reference");
  const vendor = String(input.vendor ?? "").trim();
  if (vendor.length < 1 || vendor.length > 100) throw new Error("safe2pay_invalid_vendor");
  if (!input.customer?.Name || !input.customer?.Identity) throw new Error("safe2pay_invalid_customer");
  if (!Array.isArray(input.products) || !input.products.length) throw new Error("safe2pay_products_required");

  const total = productsTotal(input.products);
  const splits = validateFixedSplits(total, input.splits);
  const expiration = Math.max(60, Math.min(86400, Math.trunc(input.expirationSeconds ?? 600)));

  return safe2PayFetch(PAYMENT_URL, {
    // Safe2Pay documentation states Pix has no sandbox environment.
    IsSandbox: false,
    Application: "APOIS",
    Vendor: vendor,
    CallbackUrl: callbackUrl(),
    PaymentMethod: "6",
    Reference: reference,
    Customer: input.customer,
    PaymentObject: { Expiration: expiration },
    Products: input.products,
    Splits: splits,
  });
}

export async function createSafe2PaySubaccount(payload: Record<string, unknown>): Promise<Record<string, unknown>> {
  if (!payload || typeof payload !== "object") throw new Error("safe2pay_invalid_subaccount_payload");
  const useSandbox = environment() !== "production";
  const key = useSandbox ? env("SAFE2PAY_API_KEY_SANDBOX") || productionApiKey() : productionApiKey();
  const response = await fetch(SUBACCOUNT_URL, {
    method: "POST",
    headers: { "content-type": "application/json", "X-API-KEY": key },
    body: JSON.stringify(payload),
  });
  const result = await response.json().catch(() => ({})) as Record<string, unknown>;
  if (!response.ok || result.HasError === true) throw new Error(`safe2pay_subaccount_failed:${String(result.ErrorCode ?? response.status)}`);
  return result;
}


export function safe2PayFeePayer(): "receiver" | "platform" {
  const value = env("SAFE2PAY_PIX_FEE_PAYER").toLowerCase();
  if (value !== "receiver" && value !== "platform") throw new Error("safe2pay_fee_payer_not_configured");
  return value;
}

function walk(value: unknown, visitor: (key: string, value: unknown) => void): void {
  if (Array.isArray(value)) {
    for (const item of value) walk(item, visitor);
    return;
  }
  if (!value || typeof value !== "object") return;
  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    visitor(key, child);
    walk(child, visitor);
  }
}

export function extractSafe2PayPixPublic(payload: Record<string, unknown>): {
  transactionId: number | null;
  qrCode: string | null;
  qrCodeBase64: string | null;
  statusCode: string | null;
} {
  let transactionId: number | null = null;
  let qrCode: string | null = null;
  let qrCodeBase64: string | null = null;
  let statusCode: string | null = null;

  walk(payload, (rawKey, value) => {
    const key = rawKey.toLowerCase();
    if (transactionId === null && ["idtransaction", "transactionid"].includes(key)) {
      const parsed = Number(value);
      if (Number.isInteger(parsed) && parsed > 0) transactionId = parsed;
    }
    if (qrCode === null && ["qrcode", "qrcodepayload", "payload", "copyandpaste", "pixcopyandpaste"].includes(key) && typeof value === "string") {
      const text = value.trim();
      if (text.length >= 20 && !text.startsWith("data:image/")) qrCode = text;
    }
    if (qrCodeBase64 === null && ["qrcodebase64", "qrcodeimage", "qrcodeimagebase64"].includes(key) && typeof value === "string") {
      const text = value.trim();
      if (text) qrCodeBase64 = text;
    }
    if (statusCode === null && ["code", "statuscode"].includes(key) && (typeof value === "string" || typeof value === "number")) {
      const text = String(value).trim();
      if (/^\d+$/.test(text)) statusCode = text;
    }
  });

  return { transactionId, qrCode, qrCodeBase64, statusCode };
}


export function extractSafe2PaySubaccountPublic(payload: Record<string, unknown>): {
  receiverId: number | null;
  hasSensitiveTokens: boolean;
} {
  const detail = payload.ResponseDetail && typeof payload.ResponseDetail === "object"
    ? payload.ResponseDetail as Record<string, unknown>
    : {};
  const candidates = [
    detail.Id,
    detail.IdReceiver,
    detail.IdMerchant,
    detail.MerchantId,
    detail.ReceiverId,
  ];
  let receiverId: number | null = null;
  for (const value of candidates) {
    const parsed = Number(value);
    if (Number.isInteger(parsed) && parsed > 0) {
      receiverId = parsed;
      break;
    }
  }
  const hasSensitiveTokens = ["Token","TokenSandbox","SecretKey","SecretKeySandbox"]
    .some((key) => typeof detail[key] === "string" && String(detail[key]).trim().length > 0);
  return { receiverId, hasSensitiveTokens };
}
