// RV-12 / CV-039: format stored order-item option snapshots for display and print.
// Pure presentation: never changes quantity, value, totals or payment state.
export const APOIS_VISUAL12_OPTIONS_MARK = "APOIS_CV12_MERCHANT_ORDER_OPTIONS_V1";

export function formatMerchantSelectedOptions(value: unknown): string[] {
  if (value === null || value === undefined) return [];
  const entries = Array.isArray(value)
    ? value
    : typeof value === "object" ? Object.values(value as Record<string, unknown>) : null;
  if (!entries) return ["Detalhes dos adicionais indisponíveis para conferência"];
  return entries.map((entry: unknown) => {
    if (!entry || typeof entry !== "object") return "Detalhe de adicional não identificado";
    const option = entry as Record<string, unknown>;
    const group = typeof option.groupName === "string" ? option.groupName.trim() : "";
    const name = typeof option.optionName === "string" ? option.optionName.trim() : "";
    return (group ? group + ": " : "") + (name || "Detalhe de adicional não identificado");
  });
}
