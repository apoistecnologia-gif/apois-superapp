import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
const workspace = process.env.APOIS_MOTORISTA_WORKSPACE || '.work/motorista';
const path = resolve(root, workspace, 'src/routes/admin.motoristas.tsx');
let source = readFileSync(path, 'utf8');

function replaceRequired(search, replacement, label) {
  if (source.includes(replacement)) return;
  if (!source.includes(search)) throw new Error('[FAIL] ' + label + ': padrão não encontrado');
  source = source.replace(search, replacement);
}

if (!source.includes('async function activateDriverSafe2Pay')) {
  replaceRequired(
    '  async function generateCharge(d: Driver) {',
    `  async function activateDriverSafe2Pay(d: Driver) {
    if (d.approval_status !== "aprovado") {
      toast.error("Apenas motoristas aprovados podem ser ativados na Safe2Pay.");
      return;
    }
    setBusyId(d.id);
    const toastId = toast.loading("Ativando recebedor Safe2Pay...");
    try {
      const { data, error } = await supabase.functions.invoke("safe2pay-subaccount-onboarding", {
        body: { target_id: d.id },
      });
      if (error) throw error;
      if (!data?.ok) throw new Error(String(data?.error ?? "safe2pay_onboarding_failed"));
      await logAdminAction({
        action: "driver.safe2pay.receiver.activate",
        entity: "drivers",
        entity_id: d.id,
        after: {
          safe2pay_receiver_id: data.receiverId ?? null,
          safe2pay_status: data.status ?? "active",
          reused: data.reused === true,
        },
      });
      toast.success(
        data.reused ? "Recebedor Safe2Pay já estava ativo." : "Recebedor Safe2Pay ativado.",
        {
          id: toastId,
          description: data.receiverId ? \`Receiver ID: \${data.receiverId}\` : undefined,
          duration: 8000,
        },
      );
      load();
    } catch (e) {
      const raw = e instanceof Error ? e.message : "safe2pay_onboarding_failed";
      let msg = mapAdminError(raw);
      if (raw.includes("driver_safe2pay_profile_incomplete")) {
        msg = "Cadastro financeiro incompleto. Confira CPF, nascimento, telefone, CEP e endereço do motorista.";
      } else if (raw.includes("safe2pay_reconciliation_required")) {
        msg = "A Safe2Pay exige reconciliação deste cadastro antes de uma nova tentativa.";
      } else if (raw.includes("safe2pay_subaccount_failed")) {
        msg = "A Safe2Pay recusou ou não conseguiu criar o recebedor. Verifique as credenciais e o cadastro.";
      }
      toast.error("Falha ao ativar Safe2Pay: " + msg, { id: toastId });
    } finally {
      setBusyId(null);
    }
  }

  async function generateCharge(d: Driver) {`,
    'Admin: função de onboarding Safe2Pay'
  );
}

replaceRequired(
  '              onGenerateCharge={() => generateCharge(d)}\n            />',
  '              onGenerateCharge={() => generateCharge(d)}\n              onActivateSafe2Pay={() => activateDriverSafe2Pay(d)}\n            />',
  'Admin: callback Safe2Pay no card'
);

replaceRequired(
  '  onGenerateCharge,\n}: {',
  '  onGenerateCharge,\n  onActivateSafe2Pay,\n}: {',
  'Admin: prop Safe2Pay no DriverCard'
);

replaceRequired(
  '  onGenerateCharge: () => void;\n}) {',
  '  onGenerateCharge: () => void;\n  onActivateSafe2Pay: () => void;\n}) {',
  'Admin: tipo da prop Safe2Pay'
);

if (!source.includes('Ativar Safe2Pay')) {
  replaceRequired(
    `          {driver.approval_status === "aprovado" && (
            <Button size="sm" variant="outline" onClick={onGenerateCharge} disabled={busy}>
              {busy ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <CreditCard className="mr-1 h-4 w-4" />} Cobrança
            </Button>
          )}`,
    `          {driver.approval_status === "aprovado" && (
            <>
              <Button size="sm" variant="outline" onClick={onActivateSafe2Pay} disabled={busy}>
                {busy ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Zap className="mr-1 h-4 w-4" />} Ativar Safe2Pay
              </Button>
              <Button size="sm" variant="outline" onClick={onGenerateCharge} disabled={busy}>
                {busy ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <CreditCard className="mr-1 h-4 w-4" />} Cobrança
              </Button>
            </>
          )}`,
    'Admin: botão Ativar Safe2Pay'
  );
}

for (const marker of [
  'async function activateDriverSafe2Pay',
  'safe2pay-subaccount-onboarding',
  'body: { target_id: d.id }',
  'driver.safe2pay.receiver.activate',
  'Ativar Safe2Pay',
]) {
  if (!source.includes(marker)) throw new Error('[FAIL] Admin Safe2Pay incompleto: ' + marker);
}

writeFileSync(path, source, 'utf8');
console.log('[OK] Admin: onboarding Safe2Pay disponível para motorista aprovado usando sessão autenticada.');
