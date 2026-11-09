import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

// APOIS_CV03_DRIVER_RATING_V1
// Visual/acessibilidade APENAS na RatingScreen gerada em .work/partner-motorista.
// Manter stars, comment, onSubmit, onSkip, onDismiss e todos os contratos de corrida.
const root = resolve(process.env.APOIS_MOTORISTA_WORKSPACE || ".work/partner-motorista");
const routePath = resolve(root, "src/routes/motorista.app.tsx");
const cssPath = resolve(root, "src/styles.css");
function once(text, oldValue, replacement, label) {
  const n = text.split(oldValue).length - 1;
  if (n !== 1) throw Error("[FAIL] CV03 Motorista " + label + ": " + n + " âncoras");
  return text.replace(oldValue, replacement);
}
const before = readFileSync(routePath, "utf8");
const a = before.indexOf("function RatingScreen(");
const b = before.indexOf("function SummaryRow(", a + 1);
if (a < 0 || b <= a) throw Error("[FAIL] CV03 Motorista: RatingScreen ausente");
let rating = before.slice(a, b);
if (!rating.includes("data-apois-driver-rating-readable-v7")) {
  throw Error("[FAIL] CV03 Motorista: overlay V7 ausente; não aplicar no snapshot antigo");
}
if (!rating.includes("APOIS_CV03_DRIVER_RATING_V1")) {
  rating = once(rating,
    '<div className="mt-1.5 flex items-center justify-center gap-1">',
    '<div data-apois-cv03-rating-stars="APOIS_CV03_DRIVER_RATING_V1" role="group" aria-label="Nota do passageiro" className="mt-1.5 flex items-center justify-center gap-1">',
    "grupo das cinco estrelas");
  rating = once(rating,
    '<button key={n} type="button" onClick={() => setStars(n)} className="p-1 transition active:scale-90">',
    '<button key={n} type="button" onClick={() => setStars(n)} aria-label={n === 1 ? "1 estrela" : n + " estrelas"} aria-pressed={stars === n} className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg p-1 transition active:scale-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#E51B23]">',
    "nomes, estado e alvo das estrelas");
  rating = once(rating,
    '                <textarea\n                  value={comment}',
    '                <label htmlFor="apois-driver-rating-comment" className="mt-3 block text-left text-[13px] font-semibold text-[#344054]">Comentário (opcional)</label>\n                <textarea\n                  id="apois-driver-rating-comment"\n                  value={comment}',
    "label visível do comentário");
  rating = once(rating,
    'placeholder:text-[#8A9098]',
    'placeholder:text-[#596372]',
    "contraste do placeholder V7");
}
for (const marker of [
  "APOIS_CV03_DRIVER_RATING_V1",
  'role="group" aria-label="Nota do passageiro"',
  'aria-label={n === 1 ? "1 estrela" : n + " estrelas"}',
  'aria-pressed={stars === n}',
  'htmlFor="apois-driver-rating-comment"',
  'id="apois-driver-rating-comment"',
  'placeholder:text-[#596372]',
  'onClick={() => setStars(n)}',
  'value={comment}', 'onChange={(e) => setComment(e.target.value)}',
  'onClick={onSubmit}', 'onClick={onSkip}', 'onClick={onDismiss}',
  'Tentar novamente', 'Pular avaliação', 'Pronto para novas corridas',
]) if (!rating.includes(marker)) throw Error("[FAIL] CV03 Motorista: contrato perdido " + marker);
if (rating.includes("placeholder:text-[#8A9098]")) {
  throw Error("[FAIL] CV03 Motorista: placeholder antigo ainda presente");
}
const updatedRoute = before.slice(0, a) + rating + before.slice(b);
const cssOriginal = readFileSync(cssPath, "utf8");
const cssMarker = "/* APOIS_CV03_DRIVER_RATING_PLACEHOLDER_V1 */";
let css = cssOriginal;
if (!css.includes(cssMarker)) {
  css += "\n" + cssMarker + "\n" +
    '[data-apois-driver-rating-readable-v7] textarea#apois-driver-rating-comment::placeholder {' +
    "color:#596372!important;-webkit-text-fill-color:#596372!important;opacity:1!important;" +
    "}\n";
}
for (const marker of [cssMarker, "textarea#apois-driver-rating-comment::placeholder", "#596372!important"]) {
  if (!css.includes(marker)) throw Error("[FAIL] CV03 Motorista: CSS incompleto " + marker);
}
if (updatedRoute !== before) writeFileSync(routePath, updatedRoute, "utf8");
if (css !== cssOriginal) writeFileSync(cssPath, css, "utf8");
console.log("[OK] CV03 Motorista: notas acessíveis, comentário identificado, placeholder legível; callbacks preservados.");
