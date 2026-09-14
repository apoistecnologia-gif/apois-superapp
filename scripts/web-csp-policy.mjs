export const REQUIRED_CSP_DIRECTIVES = {
  "default-src": ["'self'"],
  "base-uri": ["'self'"],
  "object-src": ["'none'"],
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

// frame-ancestors is intentionally header-only: browsers ignore it when CSP is
// delivered by <meta http-equiv="Content-Security-Policy">. Web hosts must add
// this directive to their HTTP Content-Security-Policy header.
export const HEADER_ONLY_CSP_DIRECTIVES = {
  "frame-ancestors": ["'none'"],
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

function serializeDirectives(directives, extraScriptHashes = []) {
  return Object.entries(directives)
    .map(([name, values]) => {
      const effective = name === "script-src" ? [...values, ...extraScriptHashes] : values;
      return `${name} ${effective.join(" ")}`;
    })
    .join("; ");
}

export function serializeCsp(extraScriptHashes = []) {
  return serializeDirectives(REQUIRED_CSP_DIRECTIVES, extraScriptHashes);
}

export function serializeHttpCsp(extraScriptHashes = []) {
  return serializeDirectives(
    { ...REQUIRED_CSP_DIRECTIVES, ...HEADER_ONLY_CSP_DIRECTIVES },
    extraScriptHashes,
  );
}
