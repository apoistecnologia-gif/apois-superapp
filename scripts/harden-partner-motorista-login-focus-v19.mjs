import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

// Apply after the Motorista v18 visual hardener, only in the disposable
// build workspace. The source submodules remain unchanged.
const root = resolve(process.env.APOIS_MOTORISTA_WORKSPACE || ".work/partner-motorista");
const loginPath = resolve(root, "src/routes/motorista.login.tsx");
const cssPath = resolve(root, "src/styles.css");
const marker = "APOIS_MOTORISTA_INPUT_FOCUS_V19";
let login = readFileSync(loginPath, "utf8");
if (!login.includes('data-apois-partner-auth-v18')) {
  throw Error("[FAIL] Motorista focus v19: login template v18 was not applied");
}
const previous = "focus-within:border-[#E51B23] focus-within:ring-2 focus-within:ring-[#E51B23]/10";
const occurrences = login.split(previous).length - 1;
if (occurrences !== 2) {
  throw Error("[FAIL] Motorista focus v19: expected two login input wrappers, found " + occurrences);
}
login = login.replaceAll(
  previous,
  "focus-within:border-[#AEB7C4] focus-within:ring-1 focus-within:ring-[#CBD5E1]/60",
);
const inputNames = ["email", "password"];
for (const name of inputNames) {
  if (!login.includes('name="' + name + '"')) throw Error("[FAIL] Login input absent: " + name);
}
writeFileSync(loginPath, login, "utf8");

let css = readFileSync(cssPath, "utf8");
if (css.includes(marker)) throw Error("[FAIL] Login input focus patch applied twice");
css += "\n/* " + marker + " */\n" +
  "/* Samsung Android WebView: suppress the unwanted rectangular native focus\n" +
  "   outline on the inner text input. The rounded parent still provides\n" +
  "   a subtle visible focus state for keyboard/accessibility users. */\n" +
  "[data-apois-partner-auth-v18] input[name=\"email\"],\n" +
  "[data-apois-partner-auth-v18] input[name=\"password\"],\n" +
  "[data-apois-partner-auth-v18] input[name=\"email\"]:focus,\n" +
  "[data-apois-partner-auth-v18] input[name=\"password\"]:focus,\n" +
  "[data-apois-partner-auth-v18] input[name=\"email\"]:focus-visible,\n" +
  "[data-apois-partner-auth-v18] input[name=\"password\"]:focus-visible {\n" +
  "  outline: none !important;\n" +
  "  outline-width: 0 !important;\n" +
  "  border: 0 !important;\n" +
  "  border-radius: 0 !important;\n" +
  "  -webkit-appearance: none;\n" +
  "  appearance: none;\n" +
  "}\n" +
  "/* Do not override the inset white autofill shadow protecting contrast. */\n" +
  "[data-apois-partner-auth-v18] input[name=\"email\"]:focus:not(:-webkit-autofill),\n" +
  "[data-apois-partner-auth-v18] input[name=\"password\"]:focus:not(:-webkit-autofill) {\n" +
  "  box-shadow: none !important;\n" +
  "  -webkit-box-shadow: none !important;\n" +
  "}\n";
writeFileSync(cssPath, css, "utf8");
console.log("[OK] Motorista login: inner rectangular focus removed on email/password, rounded focus and autofill contrast preserved.");
