const REDACTED = '[REDACTED]';
const PRECISE_LOCATION = '[PRECISE_LOCATION_REDACTED]';

const SECRET_KEY_RE = /(?:authorization|access[_-]?token|refresh[_-]?token|jwt|id[_-]?token|oauth[_-]?code|code[_-]?verifier|pkce|client[_-]?secret|service[_-]?role|private[_-]?key|webhook[_-]?secret|firebase[_-]?private[_-]?key|mercado[_-]?pago.*token|provider[_-]?payload|payment[_-]?payload|financial[_-]?payload|raw[_-]?payload|password|secret)/i;
const PRECISE_LOCATION_KEY_RE = /^(?:lat|lng|latitude|longitude|coordinates?|coords|gps)$/i;
const PERSONAL_KEY_RE = /^(?:email|phone|telefone|cpf|cnpj|full[_-]?name|nome[_-]?completo|address|endereco)$/i;
const AUTH_VALUE_RE = /^Bearer\s+\S+/i;
const JWT_VALUE_RE = /^eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/;
const PRIVATE_KEY_RE = /-----BEGIN (?:RSA |EC |)PRIVATE KEY-----/;
const MERCADO_PAGO_TOKEN_RE = /\b(?:APP_USR|TEST)-[A-Za-z0-9_-]{20,}\b/;

export function redactRuntimeLogValue(value, options = {}, seen = new WeakSet()) {
  const { allowPreciseLocation = false, allowPersonalData = false, depth = 0 } = options;
  if (depth > 6) return '[MAX_DEPTH]';
  if (value == null || typeof value === 'boolean' || typeof value === 'number') return value;
  if (typeof value === 'bigint') return String(value);
  if (typeof value === 'string') {
    if (AUTH_VALUE_RE.test(value) || JWT_VALUE_RE.test(value) || PRIVATE_KEY_RE.test(value) || MERCADO_PAGO_TOKEN_RE.test(value)) return REDACTED;
    return value.length > 500 ? `${value.slice(0, 500)}…[TRUNCATED]` : value;
  }
  if (value instanceof Error) {
    return {
      name: value.name,
      message: redactRuntimeLogValue(value.message, options, seen),
      ...(typeof value.cause === 'string' ? { cause: redactRuntimeLogValue(value.cause, options, seen) } : {}),
    };
  }
  if (typeof value !== 'object') return String(value);
  if (seen.has(value)) return '[CIRCULAR]';
  seen.add(value);
  if (Array.isArray(value)) {
    return value.slice(0, 50).map((item) => redactRuntimeLogValue(item, { ...options, depth: depth + 1 }, seen));
  }
  const output = {};
  for (const [key, item] of Object.entries(value)) {
    if (SECRET_KEY_RE.test(key)) {
      output[key] = REDACTED;
      continue;
    }
    if (!allowPreciseLocation && PRECISE_LOCATION_KEY_RE.test(key)) {
      output[key] = PRECISE_LOCATION;
      continue;
    }
    if (!allowPersonalData && PERSONAL_KEY_RE.test(key)) {
      output[key] = '[PERSONAL_DATA_REDACTED]';
      continue;
    }
    output[key] = redactRuntimeLogValue(item, { ...options, depth: depth + 1 }, seen);
  }
  return output;
}

export function safeRuntimeContext(context, options = {}) {
  const redacted = redactRuntimeLogValue(context, options);
  if (!redacted || typeof redacted !== 'object' || Array.isArray(redacted)) return { value: redacted };
  return redacted;
}

export function createSafeRuntimeLogger(base = console) {
  const emit = (method, event, context) => {
    if (context === undefined) return base[method](event);
    return base[method](event, safeRuntimeContext(context));
  };
  return {
    info: (event, context) => emit('log', event, context),
    warn: (event, context) => emit('warn', event, context),
    error: (event, context) => emit('error', event, context),
  };
}

export const LOG_REDACTION_MARKERS = Object.freeze({ REDACTED, PRECISE_LOCATION });
