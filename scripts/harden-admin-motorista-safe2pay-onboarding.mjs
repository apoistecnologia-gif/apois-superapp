import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
const workspace =
  process.env.APOIS_ADMIN_WORKSPACE ||
  process.env.APOIS_MOTORISTA_WORKSPACE ||
  '.work/admin';
const path = resolve(root, workspace, 'src/routes/admin.motoristas.tsx');
let source = readFileSync(path, 'utf8');

function replaceRequired(search, replacement, label) {
  if (source.includes(replacement)) return;
  if (!source.includes(search)) throw new Error('[FAIL] ' + label + ': padrão não encontrado');
  source = source.replace(search, replacement);
}

function addPinnedAdminFlow() {
  if (!source.includes('async function activateDriverSafe2Pay')) {
    const anchor = '  async function openDetails(driver: DriverRow) {';
    const fn = `  async function activateDriverSafe2Pay(driver: DriverRow) {
    if (busyId || !cleanText(driver.id)) return;
    if (normalizeApproval(driver.approval_status) !== "aprovado") {
      toast.error("Apenas motoristas aprovados podem ser ativados na Safe2Pay.");
      return;
    }

    setBusyId(driver.id);
    setActionError(null);
    const toastId = toast.loading("Ativando recebedor Safe2Pay...");
    try {
      const { data, error } = await supabase.functions.invoke("safe2pay-subaccount-onboarding", {
        body: { target_id: driver.id },
      });
      if (error) throw error;
      if (!data?.ok) throw new Error(String(data?.error ?? "safe2pay_onboarding_failed"));

      toast.success(
        data.reused ? "Recebedor Safe2Pay já estava ativo." : "Recebedor Safe2Pay ativado.",
        {
          id: toastId,
          description: data.receiverId ? \`Receiver ID: \${data.receiverId}\` : undefined,
          duration: 8000,
        },
      );
      await load();
    } catch (error) {
      const raw = error instanceof Error ? error.message : "safe2pay_onboarding_failed";
      let message = "Não foi possível ativar o recebedor Safe2Pay.";
      if (raw.includes("driver_safe2pay_profile_incomplete")) {
        message = "Cadastro financeiro incompleto. Confira CPF, nascimento, telefone, CEP e endereço do motorista.";
      } else if (raw.includes("safe2pay_reconciliation_required")) {
        message = "A Safe2Pay exige reconciliação deste cadastro antes de uma nova tentativa.";
      } else if (raw.includes("safe2pay_subaccount_failed")) {
        message = "A Safe2Pay recusou ou não conseguiu criar o recebedor. Verifique credenciais e cadastro.";
      } else if (/unauthorized|authorization/i.test(raw)) {
        message = "Sessão administrativa expirada. Entre novamente no painel.";
      } else if (raw.includes("forbidden")) {
        message = "Esta conta não possui permissão administrativa para ativar recebedores.";
      }
      setActionError(message);
      toast.error(message, { id: toastId });
    } finally {
      setBusyId(null);
    }
  }

${anchor}`;
    replaceRequired(anchor, fn, 'Admin Corridas: ação Safe2Pay');
  }

  if (!source.includes('Ativar Safe2Pay')) {
    const cardAnchor = `                    <DSButton size="sm" onClick={() => void approval(driver, "aprovado")} disabled={Boolean(busyId) || approvalStatus === "aprovado"} className="min-h-11 gap-2">
                      <CheckCircle2 className="h-4 w-4" aria-hidden="true" /> Aprovar
                    </DSButton>`;
    const cardReplacement = cardAnchor + `
                    {approvalStatus === "aprovado" ? (
                      <DSButton
                        variant="outline"
                        size="sm"
                        onClick={() => void activateDriverSafe2Pay(driver)}
                        disabled={Boolean(busyId)}
                        className="min-h-11 gap-2"
                      >
                        <CheckCircle2 className="h-4 w-4" aria-hidden="true" /> Ativar Safe2Pay
                      </DSButton>
                    ) : null}`;
    replaceRequired(cardAnchor, cardReplacement, 'Admin Corridas: botão Safe2Pay no card');
  }

  if (!source.includes('Ativar recebedor Safe2Pay')) {
    const detailAnchor = `              <DSButton
                variant="outline"
                onClick={() => void approval(selected, "reprovado")}
                disabled={Boolean(busyId) || cleanText(rejectReason).length < 3}
                className="min-h-11 gap-2"
                aria-busy={busyId === selected.id}
              >
                <XCircle className="h-4 w-4" aria-hidden="true" /> {busyId === selected.id ? "Reprovando…" : "Reprovar cadastro"}
              </DSButton>`;
    const detailReplacement = detailAnchor + `
              {normalizeApproval(selected.approval_status) === "aprovado" ? (
                <DSButton
                  onClick={() => void activateDriverSafe2Pay(selected)}
                  disabled={Boolean(busyId)}
                  className="min-h-11 gap-2"
                  aria-busy={busyId === selected.id}
                >
                  <CheckCircle2 className="h-4 w-4" aria-hidden="true" /> Ativar recebedor Safe2Pay
                </DSButton>
              ) : null}`;
    replaceRequired(detailAnchor, detailReplacement, 'Admin Corridas: botão Safe2Pay nos detalhes');
  }
}

function addLegacyAdminFlow() {
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
      'Admin legado: função de onboarding Safe2Pay'
    );
  }

  replaceRequired(
    '              onGenerateCharge={() => generateCharge(d)}\n            />',
    '              onGenerateCharge={() => generateCharge(d)}\n              onActivateSafe2Pay={() => activateDriverSafe2Pay(d)}\n            />',
    'Admin legado: callback Safe2Pay no card'
  );

  replaceRequired(
    '  onGenerateCharge,\n}: {',
    '  onGenerateCharge,\n  onActivateSafe2Pay,\n}: {',
    'Admin legado: prop Safe2Pay no DriverCard'
  );

  replaceRequired(
    '  onGenerateCharge: () => void;\n}) {',
    '  onGenerateCharge: () => void;\n  onActivateSafe2Pay: () => void;\n}) {',
    'Admin legado: tipo da prop Safe2Pay'
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
      'Admin legado: botão Ativar Safe2Pay'
    );
  }
}

if (source.includes('function AdminMotoristasPage()') && source.includes('type DriverRow =')) {
  addPinnedAdminFlow();
} else if (source.includes('function AdminMotoristas()') && source.includes('type Driver =')) {
  addLegacyAdminFlow();
} else {
  throw new Error('[FAIL] Admin: implementação de motoristas não reconhecida');
}

for (const marker of [
  'async function activateDriverSafe2Pay',
  'safe2pay-subaccount-onboarding',
  'target_id:',
  'Ativar Safe2Pay',
]) {
  if (!source.includes(marker)) throw new Error('[FAIL] Admin Safe2Pay incompleto: ' + marker);
}

writeFileSync(path, source, 'utf8');
console.log('[OK] Admin: onboarding Safe2Pay disponível para motorista aprovado usando sessão autenticada.');
