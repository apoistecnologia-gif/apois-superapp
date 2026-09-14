export const REQUIRED_CSP_DIRECTIVES = {
  "default-src": ["'self'"],
  "base-uri": ["'self'"],
  "object-src": ["'none'"],
  "frame-ancestors": ["'none'"],
  "form-action": ["'self'"],
  "script-src": [
    "'self'",
    "https://maps.googleapis.com",
    "https://maps.gstatic.com",
  ],
  "style-src": [
    "'self'",
    "'unsafe-inline'",
    "https://fonts.googleapis.com",
  ],
  "img-src": [
    "'self'",
    "data:",
    "blob:",
    "https://maps.googleapis.com",
    "https://maps.gstatic.com",
    "https://*.googleusercontent.com",
  ],
  "font-src": ["'self'", "data:", "https://fonts.gstatic.com"],
  "connect-src": [
    "'self'",
    "https://*.supabase.co",
    "wss://*.supabase.co",
    "https://maps.googleapis.com",
    "https://places.googleapis.com",
    "https://*.googleapis.com",
    "https://maps.gstatic.com",
    "https://*.gstatic.com",
  ],
  "worker-src": ["'self'", "blob:"],
  "child-src": ["'self'", "blob:"],
  "media-src": ["'self'", "blob:", "data:"],
  "manifest-src": ["'self'"],
};

// These providers are server-side only. If one appears in a generated frontend
// bundle, the CSP audit fails instead of widening connect-src.
export const FORBIDDEN_FRONTEND_FINANCIAL_ORIGINS = [
  "api.mercadopago.com",
  "api.openpix.com.br",
  "api.woovi-sandbox.com",
  "api.asaas.com",
  "sandbox.asaas.com",
  "api.safe2pay.com.br",
  "api.celcoin.com.br",
];

export function serializeCsp(extraScriptHashes = []) {
  const directives = Object.entries(REQUIRED_CSP_DIRECTIVES).map(([name, values]) => {
    const effective = name === "script-src" ? [...values, ...extraScriptHashes] : values;
    return `${name} ${effective.join(" ")}`;
  });
  return directives.join("; ");
}
