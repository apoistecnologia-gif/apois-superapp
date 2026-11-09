// APOIS RV-09 / CV-027–028: presentation-only overlays in disposable workspaces.
import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const DRIVER_MARK = "APOIS_CV09_DRIVER_DELETION_DIALOG_V1";
export const PASSENGER_MARK = "APOIS_CV09_PASSENGER_DELETION_DIALOG_V1";
export const CUSTOMER_MARK = "APOIS_CV09_DELIVERY_DELETION_RESULT_V1";
const HELPER = "scripts/templates/useApoisDeletionDialogFocus.ts";
const HELPER_TARGET = "src/lib/useApoisDeletionDialogFocus.ts";

function once(source, before, after, description) {
  const matches = source.split(before).length - 1;
  if (matches !== 1) throw Error("[CV09] " + description + ": expected one anchor, got " + matches);
  return source.replace(before, after);
}
function containsAll(source, values, description) {
  for (const value of values) {
    if (!source.includes(value)) throw Error("[CV09] " + description + ": missing " + value);
  }
}
export function patchDriverDialog(source) {
  if (source.includes(DRIVER_MARK)) {
    containsAll(source, ["useApoisDeletionDialogFocus(deleteConfirmOpen)", "ref={deleteDialogRef}",
      "ref={deleteCancelRef}", 'deletePhrase.trim() !== "EXCLUIR"'], "partial driver");
    return source;
  }
  containsAll(source, [
    "APOIS_MOTORISTA_DELETE_CONFIRM_V4", 'aria-labelledby="driver-delete-dialog-title"',
    "setDeleteConfirmOpen(true)", 'rpc("request_own_account_deletion")',
    'deletePhrase.trim() !== "EXCLUIR"', "Solicitar exclusão com confirmação e retenções legais aplicáveis",
  ], "driver V4 baseline");
  let result = source;
  result = once(result,
    'import { useTheme } from "@/lib/theme";',
    'import { useTheme } from "@/lib/theme";\nimport { useApoisDeletionDialogFocus } from "@/lib/useApoisDeletionDialogFocus"; // ' + DRIVER_MARK,
    "driver hook import");
  result = once(result,
    '  const [deleteError, setDeleteError] = useState<string | null>(null);',
    '  const [deleteError, setDeleteError] = useState<string | null>(null);\n  const { dialogRef: deleteDialogRef, cancelRef: deleteCancelRef } = useApoisDeletionDialogFocus(deleteConfirmOpen);',
    "driver hook state");
  result = once(result,
    '<section role="dialog" aria-modal="true" aria-labelledby="driver-delete-dialog-title"',
    '<section role="dialog" aria-modal="true" aria-labelledby="driver-delete-dialog-title" ref={deleteDialogRef} tabIndex={-1}',
    "driver dialog ref and emergency focus target");
  result = once(result,
    '<button type="button" disabled={deleting} onClick={() => { setDeleteConfirmOpen(false); setDeletePhrase(""); setDeleteError(null); }}',
    '<button type="button" ref={deleteCancelRef} disabled={deleting} onClick={() => { setDeleteConfirmOpen(false); setDeletePhrase(""); setDeleteError(null); }}',
    "driver non-destructive initial focus");
  return result;
}

export function patchPassengerDialog(source) {
  if (source.includes(PASSENGER_MARK)) {
    containsAll(source, ["useApoisDeletionDialogFocus(open)", "ref={deleteDialogRef}",
      "ref={deleteCancelRef}", 'confirmation.trim() !== "EXCLUIR"'], "partial passenger");
    return source;
  }
  containsAll(source, ["APOIS_CLIENT_ACCOUNT_DELETION_V1", "serverConfirmed = true;",
    "if (serverConfirmed)", 'aria-labelledby="apois-account-deletion-title"',
    'confirmation.trim() !== "EXCLUIR"'], "passenger baseline");
  let result = source;
  result = once(result,
    'import { supabase } from "@/integrations/supabase/client";',
    'import { supabase } from "@/integrations/supabase/client";\nimport { useApoisDeletionDialogFocus } from "@/lib/useApoisDeletionDialogFocus"; // ' + PASSENGER_MARK,
    "passenger hook import");
  result = once(result,
    '  const [error, setError] = useState<string | null>(null);',
    '  const [error, setError] = useState<string | null>(null);\n  const { dialogRef: deleteDialogRef, cancelRef: deleteCancelRef } = useApoisDeletionDialogFocus(open);',
    "passenger hook state");
  result = once(result,
    '            role="dialog"\n            aria-modal="true"',
    '            role="dialog"\n            ref={deleteDialogRef}\n            tabIndex={-1}\n            aria-modal="true"',
    "passenger dialog ref");
  result = once(result,
    '<button type="button" disabled={busy || completed} onClick={close} aria-label="Cancelar exclusão"',
    '<button type="button" ref={deleteCancelRef} disabled={busy || completed} onClick={close} aria-label="Cancelar exclusão"',
    "passenger non-destructive initial focus");
  return result;
}

export function patchDeliveryDeletionFeedback(source) {
  if (source.includes(CUSTOMER_MARK)) {
    containsAll(source, [
      "let deletionRequestConfirmed = false;",
      "deletionRequestConfirmed = true;",
      "toast.error(deletionRequestConfirmed ?",
      'request_own_account_deletion',
    ], "partial delivery feedback");
    return source;
  }
  const start = source.indexOf("  const requestAccountDeletion = async () => {");
  const end = source.indexOf("\n  };", start);
  if (start < 0 || end <= start) throw Error("[CV09] final deletion request handler missing; do not retrofit deactivation");
  const before = source.slice(start, end);
  containsAll(before, [
    'values?.["confirmation"] !== "EXCLUIR"',
    'await removeCustomerPushRegistration(true);',
    '(supabase.rpc as any)("request_own_account_deletion")',
    'await supabase.auth.signOut()',
    'toast.error("Não foi possível solicitar a exclusão da conta. Tente novamente.");',
  ], "delivery deletion-confirmation baseline");
  let after = once(before,
    '    setDeactivating(true);\n    try {',
    '    setDeactivating(true);\n    // ' + CUSTOMER_MARK + ': only a confirmed request changes the public error message.\n    let deletionRequestConfirmed = false;\n    try {',
    "delivery confirmation flag");
  after = once(after,
    '      const { error } = await (supabase.rpc as any)("request_own_account_deletion");\n      if (error) throw error;',
    '      const { error } = await (supabase.rpc as any)("request_own_account_deletion");\n      if (error) throw error;\n      deletionRequestConfirmed = true;',
    "delivery RPC-success boundary");
  after = once(after,
    '      toast.error("Não foi possível solicitar a exclusão da conta. Tente novamente.");',
    '      toast.error(deletionRequestConfirmed\n        ? "A solicitação de exclusão foi registrada, mas não foi possível concluir a saída da conta. Saia manualmente ou procure o suporte."\n        : "Não foi possível solicitar a exclusão da conta. Tente novamente.");',
    "delivery truthful signout feedback");
  return source.slice(0, start) + after + source.slice(end);
}

function emitHook(root, workspace) {
  const destination = resolve(workspace, HELPER_TARGET);
  const template = readFileSync(resolve(root, HELPER), "utf8");
  if (!template.includes("APOIS_CV09_DELETION_FOCUS_V1")) throw Error("[CV09] focus template marker missing");
  mkdirSync(dirname(destination), { recursive: true });
  if (readFileSyncOrNull(destination) !== template) writeFileSync(destination, template, "utf8");
}
function readFileSyncOrNull(path) {
  try { return readFileSync(path, "utf8"); } catch (error) {
    if (error && error.code === "ENOENT") return null;
    throw error;
  }
}
export function applyVisual09(mode, root = process.cwd()) {
  const specs = {
    motorista: { workspace: process.env.APOIS_MOTORISTA_WORKSPACE || ".work/partner-motorista",
      path: "src/routes/motorista.configuracoes.tsx", patch: patchDriverDialog, focus: true },
    passageiro: { workspace: ".work/corridas",
      path: "src/components/profile/PassengerAccountDeletion.tsx", patch: patchPassengerDialog, focus: true },
    entregas: { workspace: ".work/entregas",
      path: "src/routes/perfil/dados-pessoais.tsx", patch: patchDeliveryDeletionFeedback, focus: false },
  };
  const target = specs[mode];
  if (!target) throw Error("[CV09] expected motorista, passageiro or entregas");
  const workspace = resolve(root, target.workspace);
  const path = resolve(workspace, target.path);
  const before = readFileSync(path, "utf8");
  const after = target.patch(before); // Abort on baseline drift before writing.
  if (target.focus) emitHook(root, workspace);
  if (before !== after) writeFileSync(path, after, "utf8");
  return { mode, changed: before !== after, path };
}
if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  const result = applyVisual09(process.argv[2]);
  console.log("[OK] RV-09 / " + result.mode + ": " + (result.changed ? "visual overlay applied" : "already applied"));
}
