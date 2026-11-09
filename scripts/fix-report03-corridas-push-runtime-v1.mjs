// Relatorio 03: aplica ao backend Corridas gerado as correcoes auditadas do
// send-ride-push canonico, sem alterar o snapshot do Passageiro nem fazer deploy.
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
const root = process.cwd();
const canonicalFile = resolve(root, "supabase/functions/send-ride-push/index.ts");
const generatedFile = resolve(root, ".work/corridas/supabase/functions/send-ride-push/index.ts");
if (!existsSync(canonicalFile) || !existsSync(generatedFile)) {
  throw new Error("[INV03] send-ride-push canonico ou workspace Corridas ausente");
}
const canonical = readFileSync(canonicalFile, "utf8");
const generated = readFileSync(generatedFile, "utf8");
const BEGIN_CANONICAL = "    const { data: preferences, error: preferencesError } = await admin";
const BEGIN_OLD = "    const { data: preferences } = await admin";
const END = "\n  } catch (error) {\n    console.error(\"[APOIS FCM]\", error);";
function extract(source, begin, label) {
  const a = source.indexOf(begin);
  const b = source.lastIndexOf(END);
  if (a < 0 || b <= a || source.indexOf(begin, a + 1) !== -1) {
    throw new Error("[INV03] limites da secao de notificacoes alterados: " + label);
  }
  return { start: a, end: b };
}
const current = extract(canonical, BEGIN_CANONICAL, "canonico");
const canonicalSection = canonical.slice(current.start, current.end);
const original = generated.includes(BEGIN_CANONICAL)
  ? extract(generated, BEGIN_CANONICAL, "gerado corrigido")
  : extract(generated, BEGIN_OLD, "gerado original");
if (generated.includes("normalizeRecipientAuthIds")) {
  throw new Error("[INV03] regressao de identidade AUTH ainda presente");
}
if (!generated.includes("normalizeRecipientDomainIds")) {
  throw new Error("[INV03] hardener de identidade ainda nao aplicado");
}
if (!generated.includes('if (input.user_ids.length > 100)')) {
  throw new Error("[INV03] limite por chamada ainda nao aplicado no gerador");
}
if (generated.includes('finalUserIds = [...new Set(input.user_ids.filter(Boolean))].slice(0, 100)')) {
  throw new Error("[INV03] truncamento silencioso ainda presente");
}
const after = generated.slice(0, original.start) + canonicalSection + generated.slice(original.end);
for (const text of [
  'const unregistered = response.status === 404',
  'const noTokenIds = allowedUsers.filter',
  'const partialUsers = allowedUsers.filter',
  'error: preferencesError',
  'failed_users: failedUsers.length',
]) {
  if (!after.includes(text)) throw new Error("[INV03] incompleto: " + text);
}
if (after.includes('response.status === 404 || response.status === 400')) {
  throw new Error("[INV03] desativacao por status HTTP 400 ainda presente");
}
if (after !== generated) writeFileSync(generatedFile, after, "utf8");
console.log("[OK] INV-036/039/043 runtime Corridas: regras FCM preservadas no workspace sem envio real");
