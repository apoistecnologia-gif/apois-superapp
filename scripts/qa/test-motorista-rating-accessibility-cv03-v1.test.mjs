import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { test } from "node:test";

const project = resolve(fileURLToPath(new URL("../..", import.meta.url)));
const patch = resolve(project, "scripts/fix-partner-motorista-rating-accessibility-cv03-v1.mjs");
const route = "src/routes/motorista.app.tsx";
const css = "src/styles.css";
const fragment = [
  "function RatingScreen() {",
  "  const stars = 5, comment = '', setStars = () => {}, setComment = () => {};",
  "  return (",
  '    <div data-apois-driver-rating-readable-v7 className="fixed inset-0">',
  '      <p>Pronto para novas corridas</p>',
  '      <p>Como foi o passageiro?</p>',
  '      <div className="mt-1.5 flex items-center justify-center gap-1">',
  '        {[1, 2, 3, 4, 5].map((n) => (',
  '          <button key={n} type="button" onClick={() => setStars(n)} className="p-1 transition active:scale-90">',
  '            <Star />',
  '          </button>',
  '        ))}',
  '      </div>',
  '                <textarea',
  '                  value={comment}',
  '                  onChange={(e) => setComment(e.target.value)}',
  '        placeholder="Comentário (opcional)"',
  '        className="mt-2.5 w-full resize-none rounded-[14px] bg-white p-3 text-[13px] font-medium text-[#111827] placeholder:text-[#8A9098] ring-1 ring-[#D1D5DB] focus:outline-none focus:ring-[#E51B23]/40"',
  '      />',
  '      <button onClick={onSubmit}>Concluir</button>',
  '      <button onClick={onDismiss}>Fechar</button>',
  '      <button onClick={onSkip}>Pular avaliação</button>',
  '      <span>Tentar novamente</span>',
  '    </div>',
  '  );',
  '}',
  'function SummaryRow() { return null; }',
].join("\n");
const original = '/* before RatingScreen */\n' + fragment + '\n/* after SummaryRow */';

const save = (base, rel, content) => {
  const p = join(base, rel);
  mkdirSync(dirname(p), { recursive: true });
  writeFileSync(p, content, "utf8");
};
const load = (base, rel) => readFileSync(join(base, rel), "utf8");

test("CV-013/014/015: isolated generated rating preserves callbacks and is idempotent", () => {
  const temp = mkdtempSync(join(tmpdir(), "apois-cv03-"));
  const work = join(temp, ".work/partner-motorista");
  const run = () => spawnSync(process.execPath, [patch], {
    cwd: temp, encoding: "utf8",
    env: { ...process.env, APOIS_MOTORISTA_WORKSPACE: work },
  });
  try {
    save(work, route, original);
    save(work, css, "/* existing styles */\n");
    let r = run();
    assert.equal(r.status, 0, r.stderr);
    const rendered = load(work, route);
    const styles = load(work, css);
    const review = rendered.slice(rendered.indexOf("function RatingScreen("), rendered.indexOf("function SummaryRow("));
    assert.match(review, /data-apois-cv03-rating-stars="APOIS_CV03_DRIVER_RATING_V1"/);
    assert.match(review, /role="group" aria-label="Nota do passageiro"/);
    assert.match(review, /aria-label=\{n === 1 \? "1 estrela" : n \+ " estrelas"\}/);
    assert.match(review, /aria-pressed=\{stars === n\}/);
    assert.match(review, /min-h-11 min-w-11/);
    assert.match(review, /htmlFor="apois-driver-rating-comment"/);
    assert.match(review, /id="apois-driver-rating-comment"/);
    assert.match(review, /placeholder:text-\[#596372\]/);
    assert.doesNotMatch(review, /placeholder:text-\[#8A9098\]/);
    assert.match(styles, /textarea#apois-driver-rating-comment::placeholder/);
    assert.match(styles, /color:#596372!important/);
    for (const key of [
      "onClick={() => setStars(n)}", "value={comment}",
      "onChange={(e) => setComment(e.target.value)}",
      "onClick={onSubmit}", "onClick={onDismiss}", "onClick={onSkip}",
      "Tentar novamente", "Pular avaliação", "Pronto para novas corridas",
    ]) assert.ok(review.includes(key), "Keep rating flow: " + key);
    assert.equal(rendered.slice(0, rendered.indexOf("function RatingScreen(")),
      original.slice(0, original.indexOf("function RatingScreen(")));
    assert.equal(rendered.slice(rendered.indexOf("function SummaryRow(")),
      original.slice(original.indexOf("function SummaryRow(")));
    r = run();
    assert.equal(r.status, 0, r.stderr);
    assert.equal(load(work, route), rendered, "Idempotent TSX");
    assert.equal(load(work, css), styles, "Idempotent styles");
    save(work, route, original.replace("data-apois-driver-rating-readable-v7", "data-unknown-version"));
    r = run();
    assert.notEqual(r.status, 0, "Version drift must fail closed");
  } finally {
    rmSync(temp, { recursive: true, force: true });
  }
});

test("CV-015: rating-only placeholder color passes WCAG 4.5:1 on white", () => {
  function luminance(color) {
    const v = color.match(/[A-Fa-f0-9]{2}/g).map((s) => parseInt(s, 16) / 255);
    return v.map((x) => x <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4)
      .reduce((sum, x, i) => sum + x * [0.2126, 0.7152, 0.0722][i], 0);
  }
  const a = luminance("#FFFFFF"), b = luminance("#596372");
  assert.ok((Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05) >= 4.5);
});

test("CV-03: build order retains old contrast fix, then V7, then final scoped rating", () => {
  const build = readFileSync(resolve(project, "scripts/build-partner-release.sh"), "utf8");
  const old = build.indexOf('fix-partner-input-contrast-v1.mjs" motorista');
  const v7 = build.indexOf('fix-partner-motorista-ride-visual-v7.mjs');
  const current = build.indexOf('fix-partner-motorista-rating-accessibility-cv03-v1.mjs');
  assert.ok(old >= 0 && v7 > old && current > v7);
});
