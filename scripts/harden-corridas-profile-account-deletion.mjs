// APOIS_CLIENT_ACCOUNT_DELETION_V1
// Habilita solicitação de exclusão somente no Perfil Corridas do usuário autenticado.
// Origem fixada preservada; nenhuma alteração de produção/banco em build.
import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

const work = resolve(process.env.APOIS_CORRIDAS_WORKSPACE || ".work/corridas");
const routePath = resolve(work, "src/routes/_authenticated.perfil.tsx");
const targetPath = resolve(work, "src/components/profile/PassengerAccountDeletion.tsx");
const templatePath = resolve("scripts/templates/PassengerAccountDeletion.tsx");
let route = readFileSync(routePath, "utf8");

function replaceExactlyOnce(before, after, label) {
  if (route.includes(after)) return;
  const count = route.split(before).length - 1;
  if (count !== 1) throw new Error("[FAIL] Exclusão Corridas: " + label + " (" + count + ")");
  route = route.replace(before, after);
}

if (!route.includes("APOIS_CLIENT_ACCOUNT_DELETION_V1")) {
  if (!route.includes("APOIS_CLIENT_PROFILE_EDIT_V1")) {
    throw new Error("[FAIL] Exclusão Corridas: editor de perfil deve ser montado primeiro");
  }
  replaceExactlyOnce(
    'import { PassengerProfileEditor, type PassengerProfileField } from "@/components/profile/PassengerProfileEditor";',
    'import { PassengerProfileEditor, type PassengerProfileField } from "@/components/profile/PassengerProfileEditor";\nimport { PassengerAccountDeletion } from "@/components/profile/PassengerAccountDeletion"; // APOIS_CLIENT_ACCOUNT_DELETION_V1',
    "import do componente",
  );
  replaceExactlyOnce(
    '        <div className="p-6 mt-4">\n          <Button',
    '        <div className="p-6 mt-4">\n          <PassengerAccountDeletion onConfirmed={async () => {\n            await signOut();\n            await navigate({ to: "/login", replace: true });\n          }} />\n          <Button',
    "opção visível no Perfil",
  );
}

for (const token of [
  "APOIS_CLIENT_ACCOUNT_DELETION_V1",
  'import { PassengerAccountDeletion }',
  "<PassengerAccountDeletion onConfirmed={async () => {",
  "await signOut();",
  'await navigate({ to: "/login", replace: true });',
]) {
  if (!route.includes(token)) throw Error("[FAIL] Exclusão Corridas: ausente " + token);
}

const component = readFileSync(templatePath, "utf8");
for (const token of [
  "APOIS_CLIENT_ACCOUNT_DELETION_V1",
  'requestDeletion("request_own_account_deletion")',
  'confirmation.trim() !== "EXCLUIR"',
  'data?.ok !== true',
  'rpcError.code === "55000"',
  "await onConfirmed();",
]) {
  if (!component.includes(token)) throw Error("[FAIL] Exclusão Corridas: contrato incompleto " + token);
}
if (/delete-my-account|auth\.admin\.deleteUser|service_role/.test(component)) {
  throw Error("[FAIL] Exclusão Corridas: chamada destrutiva legada ou chave privilegiada no cliente");
}

mkdirSync(dirname(targetPath), { recursive: true });
copyFileSync(templatePath, targetPath);
writeFileSync(routePath, route, "utf8");
console.log("[OK] APOIS Corridas: exclusão de conta disponível no Perfil, com confirmação EXCLUIR e RPC autenticada.");
