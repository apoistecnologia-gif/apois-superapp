// APOIS RV-15 — user-facing Auth errors, without changing auth callbacks or server policy.
export type PassengerAuthAction = "recover" | "reset";

export function passengerPublicAuthError(error: unknown, action: PassengerAuthAction): string {
  const typed = (error && typeof error === "object")
    ? error as {code?: unknown;message?: unknown;status?: unknown}
    : {};
  const code = typeof typed.code === "string" ? typed.code.toLowerCase() : "";
  const message = typeof typed.message === "string" ? typed.message.toLowerCase() : "";
  const status = typeof typed.status === "number" ? typed.status : 0;
  const detail = code + " " + message;
  if (status === 429 || /rate.limit|over.request.rate.limit|too.many.requests/.test(detail)) {
    return "Muitas tentativas em pouco tempo. Aguarde alguns minutos antes de tentar novamente.";
  }
  if (/network|failed.to.fetch|fetch.failed|connection|timeout|network_request_failed/.test(detail)) {
    return "Não foi possível conectar ao servidor. Verifique a internet e tente novamente.";
  }
  if (/invalid.email|email.address.invalid|email.not.valid/.test(detail)) {
    return "Confira o endereço de e-mail informado e tente novamente.";
  }
  if (action === "reset" && /weak.password|password.too.short|password.*(minimum|length|characters|requirements)/.test(detail)) {
    return "A nova senha não atende aos requisitos de segurança da conta. Escolha uma senha mais forte e tente novamente.";
  }
  if (action === "reset" && /expired|invalid.token|invalid.otp|otp.expired|invalid.recovery|session.not.found|session.expired/.test(detail)) {
    return "O link de recuperação não está mais válido. Solicite um novo link para continuar.";
  }
  // Do not expose raw provider messages, account existence or unsupported causes.
  return action === "recover"
    ? "Não foi possível solicitar a recuperação agora. Tente novamente em instantes."
    : "Não foi possível atualizar a senha agora. Tente novamente ou solicite um novo link.";
}
