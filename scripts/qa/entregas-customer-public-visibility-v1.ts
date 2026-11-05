// APOIS_ENTREGAS_REAL_CATALOG_V1
// Public customer display policy. Historical QA records remain untouched in Supabase.
export type PublicMerchantCandidate = {
  name?: string | null;
  slug?: string | null;
};
export type PublicAddressCandidate = {
  label?: string | null;
  street?: string | null;
};
const QA_SLUGS = new Set([
  "apois-teste-entregas-homologacao-20261029",
  "loja-qa-homologacao",
  "acai-no-grau-integracao",
]);
const QA_NAMES = new Set([
  "apois teste entregas",
  "loja qa homologacao",
  "açaí no grau",
]);

export function isCustomerHomologationMerchant(value: PublicMerchantCandidate | null | undefined): boolean {
  if (!value) return false;
  const slug = String(value.slug ?? "").trim().toLocaleLowerCase("pt-BR");
  if (slug) return QA_SLUGS.has(slug);
  // Safeguard for an older locally persisted cart that has only a display name.
  return QA_NAMES.has(String(value.name ?? "").trim().toLocaleLowerCase("pt-BR"));
}
export function isCustomerHomologationAddress(value: PublicAddressCandidate | null | undefined): boolean {
  if (!value) return false;
  const label = String(value.label ?? "").trim();
  // Existing prod fixtures are explicitly labelled "TESTE" / "(não entregar)".
  // Do not interfere with normal saved "Casa" or "Trabalho" delivery addresses.
  return /^TESTE(?:\s|[-—–])/i.test(label) || /\(\s*n[aã]o entregar\s*\)/i.test(label);
}
