import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

// APOIS_VISUAL04_PASSAGEIRO_V1 — presentation only on disposable .work/corridas.
// No changes to maps, Places, destination selection, pricing, checkout, ride
// completion, auto-return timer, API payload, authentication, or source pins.
const root = resolve(process.env.APOIS_CORRIDAS_WORKSPACE || ".work/corridas");
function transform(relative, apply, checks) {
  const path = resolve(root, relative);
  const previous = readFileSync(path, "utf8");
  const updated = apply(previous);
  for (const token of checks) {
    if (!updated.includes(token)) throw Error("[FAIL] CV04 missing " + token + " in " + relative);
  }
  if (updated !== previous) writeFileSync(path, updated, "utf8");
  console.log("[OK] CV04 presentation checked: " + relative);
}
function once(source, before, after, label) {
  const count = source.split(before).length - 1;
  if (count !== 1) throw Error("[FAIL] CV04 " + label + ": occurrences=" + count);
  return source.replace(before, after);
}

transform("src/routes/_authenticated.buscar-destino.tsx", (source) => {
  if (!source.includes("data-apois-visual04-clear-search-v1")) {
    const button = /<button\s+onClick=\{clearQuery\}\s+className="([^"]*)">/g;
    const matches = [...source.matchAll(button)];
    if (matches.length !== 1) throw Error("[FAIL] CV04 clearQuery button occurrences=" + matches.length);
    const cls = matches[0][1];
    if (!cls.includes("absolute") || !cls.includes("right-4")) {
      throw Error("[FAIL] CV04 clearQuery unexpected visual layout");
    }
    const refined = cls.replace(/\bright-4\b/, "right-1") +
      " grid h-11 w-11 min-h-11 min-w-11 place-items-center rounded-lg" +
      " focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#E51B23]";
    source = source.replace(matches[0][0],
      '<button type="button" data-apois-visual04-clear-search-v1 aria-label="Limpar busca" title="Limpar busca" onClick={clearQuery} className="' + refined + '">');
  }
  for (const invariant of [
    'onClick={clearQuery}', 'aria-label="Limpar busca"', "handleFinalSelection(details)",
    "handleSelectSuggestion", "setQuery(e.target.value)", "suggestions.map",
    "data-apois-visual04-clear-search-v1",
  ]) if (!source.includes(invariant)) throw Error("[FAIL] CV04 search lost " + invariant);
  return source;
}, ["data-apois-visual04-clear-search-v1", 'aria-label="Limpar busca"', "onClick={clearQuery}"]);

const formatter = [
  "",
  "// APOIS_VISUAL04_REVIEW_DETAILS_V1: text only; never modify data or request payload.",
  "const apoisReviewDetailLabels: Record<string, string> = {",
  '  ride_comfort_preferences: "Preferências de conforto",',
  '  conversation: "Conversa",',
  '  music: "Música",',
  '  air_conditioning: "Ar-condicionado",',
  "};",
  "const apoisReviewDetailChoices: Record<string, Record<string, string>> = {",
  '  conversation: { quiet: "Prefiro silêncio", talk: "Pode conversar", no_preference: "Sem preferência" },',
  '  music: { yes: "Quero ouvir música", no: "Prefiro sem música", no_preference: "Sem preferência" },',
  '  air_conditioning: { yes: "Prefiro ligado", no: "Prefiro desligado", no_preference: "Sem preferência" },',
  "};",
  "function formatApoisReviewDetailLabel(key: string): string {",
  "  if (Object.prototype.hasOwnProperty.call(apoisReviewDetailLabels, key)) return apoisReviewDetailLabels[key] ?? key;",
  "  // Unknown contract keys: only split punctuation/camelCase, never invent business translations.",
  '  const readable = key.replace(/([a-z0-9])([A-Z])/g, "$1 $2").replace(/[_-]+/g, " ").replace(/\\s+/g, " ").trim();',
  '  return readable ? readable.charAt(0).toLocaleUpperCase("pt-BR") + readable.slice(1) : "Detalhe";',
  "}",
  "function formatApoisReviewDetailValue(value: unknown, key = \"\", depth = 0): string {",
  '  if (value === null || value === undefined || value === "") return "Não informado";',
  '  if (typeof value === "boolean") return value ? "Sim" : "Não";',
  '  if (typeof value === "string") {',
  '    const choices = apoisReviewDetailChoices[key];',
  '    return choices && Object.prototype.hasOwnProperty.call(choices, value) ? choices[value] ?? value : value;',
  '  }',
  '  if (typeof value === "number") return Number.isFinite(value) ? String(value) : "Não informado";',
  '  if (Array.isArray(value)) return value.length ? value.map((entry) => formatApoisReviewDetailValue(entry, key, depth + 1)).join(", ") : "Nenhum item";',
  "  if (typeof value === \"object\") {",
  "    if (depth > 4) return JSON.stringify(value) ?? "Dados estruturados";",
  "    const entries = Object.entries(value as Record<string, unknown>);",
  '    return entries.length ? entries.map(([subkey, item]) => formatApoisReviewDetailLabel(subkey) + ": " + formatApoisReviewDetailValue(item, subkey, depth + 1)).join(" · ") : "Sem detalhes";',
  "  }",
  '  return String(value);',
  "}",
  "",
].join("\n");

transform("src/routes/_authenticated.revisar-solicitacao.tsx", (source) => {
  if (!source.includes("APOIS_VISUAL04_REVIEW_DETAILS_V1")) {
    source = once(source,
      "function RideRequestReviewPage() {",
      formatter + "\nfunction RideRequestReviewPage() {",
      "review formatter insertion");
    source = once(source,
      '{key.replace(/([A-Z])/g, " ")}',
      "{formatApoisReviewDetailLabel(key)}",
      "review label");
    source = once(source,
      "{String(value)}",
      "{formatApoisReviewDetailValue(value, key)}",
      "review value");
    source = once(source,
      'className="text-xs font-bold capitalize"',
      'className="text-xs font-bold break-words whitespace-normal"',
      "review long text and unknown codes");
  }
  for (const invariant of [
    "APOIS_VISUAL04_REVIEW_DETAILS_V1",
    "Object.entries(selectedCategory.details).map",
    "{formatApoisReviewDetailLabel(key)}",
    "{formatApoisReviewDetailValue(value, key)}",
    "const response = await confirmRide(comfort);",
    "checkout.finalTotal",
    "O valor oficial será confirmado pelo servidor ao solicitar.",
  ]) if (!source.includes(invariant)) throw Error("[FAIL] CV04 review lost " + invariant);
  return source;
}, ["APOIS_VISUAL04_REVIEW_DETAILS_V1", "{formatApoisReviewDetailValue(value, key)}"]);

console.log("[OK] CV04: clear-search accessible; review details legible with unknown keys preserved; completion timer untouched.");
