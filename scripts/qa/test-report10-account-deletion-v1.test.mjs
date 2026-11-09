// APOIS Relatório 10 — somente fixtures sintéticas; nenhum acesso ao banco real.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const root = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(root, "../..");
const read = (relative) => readFileSync(resolve(repoRoot, relative), "utf8");
const sql = read("supabase/corridas-forward-migrations/20261109_report10_account_deletion_search_guard_QA_NOT_APPLIED.sql");
const v4 = read("scripts/fix-partner-motorista-account-deletion-dialog-v4.mjs");

function readPredicate(label) {
  const index = sql.indexOf(label + " :=");
  assert.ok(index >= 0, "missing predicate " + label);
  const match = sql.slice(index).match(/'([^\n]+)';/);
  assert.ok(match, label + " predicate must exist");
  return match[1].replaceAll("''", "'");
}

function createSyntheticDriverSettings() {
  return [
    'function DriverSettings() {',
    '  const [deleting, setDeleting] = useState(false);',
    '  let signingOut = false;',
    '  async function handleDeleteAccount() {',
    '    if (deleting || signingOut) return;',
    '    if (window.confirm("EXCLUIR?")) {',
    '      await supabase.functions.invoke("delete-my-account", { body: {} });',
    '    }',
    '  }',
    '  return (',
    '    <div>',
    '      <SettingsPageShell>',
    '        <SettingsRow hint="Exclusão permanente dos dados pessoais e documentos"',
    '          onClick={() => void handleDeleteAccount()} />',
    '        </SettingsPageShell>',
    '      </div>',
    '  );',
    '}',
  ].join("\n");
}

function applyV4WithMocks(input) {
  let written = null;
  const body = v4.replace(/^import .*;$/gm, "");
  vm.runInNewContext(body, {
    process: { env: { APOIS_MOTORISTA_WORKSPACE: "synthetic-test-only" } },
    resolve: (...parts) => parts.join("/"),
    readFileSync: () => input,
    writeFileSync: (_name, value) => { written = value; },
    console: { log: () => {} },
  }, { timeout: 5000 });
  assert.ok(written, "generator must write synthetic result");
  return written;
}

test("INV-061: exactly procurar_motorista is added; prior aliases preserved", () => {
  const prior = readPredicate("prior_predicate constant text");
  const corrected = readPredicate("corrected_predicate constant text");
  const tokenize = (s) => [...s.matchAll(/'([^']+)'/g)].map((m) => m[1]);
  const a = tokenize(prior), b = tokenize(corrected);
  assert.deepEqual(b.filter((s) => !a.includes(s)), ["procurar_motorista"]);
  assert.deepEqual(a.filter((s) => !b.includes(s)), []);
  for (const finished of ["concluida", "completed", "cancelada", "cancelled"]) {
    assert.ok(!b.includes(finished), finished + " must not become blocking");
  }
  assert.ok(corrected.startsWith("r.status in"));
});

test("INV-061: migration fail-closed preserves private RPC and is not applied here", () => {
  for (const required of [
    "QA_NOT_APPLIED", "pg_get_functiondef(target_oid)", "current_definition",
    "EXECUTE replace(current_definition, prior_predicate, corrected_predicate)",
    "auth.uid()", "public.audit_logs", "public.drivers",
    "RAISE EXCEPTION", "search_path", "NAO executar",
  ]) assert.ok(sql.includes(required), "missing SQL safeguard " + required);
  assert.ok(!sql.includes("DROP TABLE"));
  assert.ok(!sql.includes("TRUNCATE"));
  assert.ok(!sql.includes("DELETE FROM public.users"));
});

test("INV-062: v4 transforms original modal without legacy endpoint", () => {
  const output = applyV4WithMocks(createSyntheticDriverSettings());
  assert.ok(output.includes("APOIS Corridas, compartilhada pelos perfis Motorista e Passageiro"));
  assert.ok(output.includes("deixará de acessar ambos os perfis de Corridas"));
  assert.ok(output.includes("sem apagar imediatamente todos os dados"));
  assert.ok(!output.includes("Esta ação impedirá o uso do perfil APOIS Motorista após a confirmação"));
  assert.ok(!output.includes('functions.invoke("delete-my-account"'));
  assert.ok(!output.includes("window.confirm("));
  assert.ok(!output.includes("window.prompt("));
});

test("INV-062: RPC and logout follow typed EXCLUIR and server confirmation", () => {
  const output = applyV4WithMocks(createSyntheticDriverSettings());
  const handler = output.slice(output.indexOf("async function confirmDeleteAccount()"), output.indexOf("\n  return ("));
  const phrase = handler.indexOf('deletePhrase.trim() !== "EXCLUIR"');
  const rpc = handler.indexOf('rpc("request_own_account_deletion")');
  const success = handler.indexOf("if (data?.ok !== true)");
  const logout = handler.indexOf('await supabase.auth.signOut({ scope: "local" });');
  const nav = handler.indexOf('await navigate({ to: "/motorista/login", replace: true });');
  assert.ok(phrase >= 0 && rpc > phrase && success > rpc && logout > success && nav > logout);
});

test("INV-062: missing source anchors fail closed before writing", () => {
  assert.throws(
    () => applyV4WithMocks("function unrelated() { return null; }"),
    /Delete V4 modal state anchor count/,
  );
});
