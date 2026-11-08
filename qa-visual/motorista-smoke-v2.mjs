// APOIS Motorista — visual smoke v2. Não contabiliza login como prova de telas privadas.
// Uso: APOIS_MOTORISTA_BASE_URL=http://127.0.0.1:4202 node qa-visual/motorista-smoke-v2.mjs
// Bundle standalone usa pathname. Para bundle Parceiro use APOIS_MOTORISTA_ROUTE_MODE=hash
// e BASE_URL apontando diretamente ao index.html do módulo.
import { chromium } from "playwright";
import { createHash } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";

const origin = process.env.APOIS_MOTORISTA_BASE_URL || "http://127.0.0.1:4202";
const mode = process.env.APOIS_MOTORISTA_ROUTE_MODE === "hash" ? "hash" : "browser";
const outputDir = "qa-visual/reteste-v2";
mkdirSync(outputDir, { recursive: true });
const checks = [
  { route: "/motorista/login", kind: "public", minChars: 60, minInputs: 2 },
  { route: "/motorista/cadastro", kind: "public", minChars: 120, minInputs: 4, required: "Seu veículo" },
  { route: "/motorista/recuperar-senha", kind: "public", minChars: 60, minInputs: 1 },
  { route: "/motorista/app", kind: "authenticated" },
  { route: "/motorista/corridas", kind: "authenticated" },
  { route: "/motorista/ganhos", kind: "authenticated" },
  { route: "/motorista/perfil", kind: "authenticated" },
  { route: "/motorista/documentos", kind: "authenticated" },
];

const urlFor = (route) => {
  const base = origin.replace(/\/$/, "");
  return mode === "hash"
    ? base + (base.endsWith(".html") ? "#" : "/#") + route
    : base + route;
};

const browser = await chromium.launch({ headless: true });
const output = [], hashes = new Map();
try {
  for (const check of checks) {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 }, serviceWorkers: "block" });
    const errors = [];
    page.on("pageerror", (err) => errors.push(err.message.slice(0, 250)));
    let result = { route: check.route, kind: check.kind, status: "NOT_TESTED", errors };
    try {
      const resp = await page.goto(urlFor(check.route), { waitUntil: "domcontentloaded", timeout: 12000 });
      await page.waitForTimeout(1400);
      const state = await page.evaluate((routeMode) => ({
        effectiveRoute: routeMode === "hash"
          ? location.hash.replace(/^#/, "").split("?")[0] || "/"
          : location.pathname,
        text: document.body.innerText.trim(),
        inputCount: document.querySelectorAll("input:not([type=hidden])").length,
        heading: document.querySelector("h1")?.textContent?.trim() ?? "",
        pageWidth: document.documentElement.scrollWidth,
        windowWidth: window.innerWidth,
      }), mode);
      result = { ...result, effectiveRoute: state.effectiveRoute, chars: state.text.length,
        heading: state.heading, inputCount: state.inputCount, viewportOverflow: state.pageWidth > state.windowWidth + 2,
        responseStatus: resp?.status() ?? null };
      const exact = state.effectiveRoute === check.route ||
        state.effectiveRoute.replace(/\/$/, "") === check.route.replace(/\/$/, "");
      if (check.kind === "authenticated") {
        result.status = exact
          ? "UNVERIFIED_PROTECTED_ROUTE_VISIBLE_NO_SESSION"
          : state.effectiveRoute.includes("/login")
            ? "REDIRECTED_LOGIN_NOT_TESTED"
            : "REDIRECTED_OTHER_NOT_TESTED";
        // Não aprovar nem gerar screenshot nomeado da rota protegida sem sessão.
      } else {
        const valid = exact && state.text.length >= check.minChars &&
          state.inputCount >= check.minInputs &&
          (!check.required || state.text.includes(check.required)) &&
          !result.viewportOverflow && !errors.length &&
          (result.responseStatus == null || result.responseStatus < 400);
        result.status = valid ? "PASS_PUBLIC_RENDER" : "FAIL_PUBLIC_RENDER";
        if (valid) {
          const bytes = await page.screenshot({ fullPage: true });
          const sha = createHash("sha256").update(bytes).digest("hex");
          const previous = hashes.get(sha);
          if (previous) {
            result.status = "FAIL_DUPLICATE_SCREENSHOT";
            result.duplicatedWith = previous;
          } else {
            hashes.set(sha, check.route);
            const filename = "motorista-" + check.route.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "") + ".png";
            writeFileSync(outputDir + "/" + filename, bytes);
            result.screenshot = filename;
          }
        }
      }
    } catch (error) {
      result.status = "FAIL_NAVIGATION_OR_RENDER";
      errors.push(String(error instanceof Error ? error.message : error).slice(0, 250));
    } finally {
      output.push(result);
      await page.close();
    }
  }
} finally {
  await browser.close();
}
const summary = {
  mode, baseUrl: origin, unauthenticated: true,
  publicPassed: output.filter(x=>x.status==="PASS_PUBLIC_RENDER").length,
  publicFailed: output.filter(x=>x.kind==="public"&&x.status!=="PASS_PUBLIC_RENDER").length,
  authenticatedNotTested: output.filter(x=>x.kind==="authenticated").length,
  protectedRoutesNeedReview: output.filter(x=>x.status==="UNVERIFIED_PROTECTED_ROUTE_VISIBLE_NO_SESSION").length,
};
writeFileSync(outputDir + "/report.json", JSON.stringify({ summary, results: output }, null, 2));
console.log(JSON.stringify({ summary, results: output }, null, 2));
if (summary.publicFailed || summary.protectedRoutesNeedReview) process.exitCode = 1;
