import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
const workspace = process.env.APOIS_ENTREGAS_WORKSPACE || '.work/partner-entregador';
const path = resolve(root, workspace, 'src/routes/courier.tsx');
let source = readFileSync(path, 'utf8');

if (!source.includes('const COURIER_ACTION_TIMEOUT_MS = 20_000;')) {
  const anchor = 'function CourierApp() {';
  if (!source.includes(anchor)) throw new Error('Entregador Parceiro: CourierApp não encontrado.');
  const helper = `const COURIER_ACTION_TIMEOUT_MS = 20_000;\n\nasync function courierActionWithTimeout<T>(operation: PromiseLike<T>, label: string): Promise<T> {\n  let timer: ReturnType<typeof setTimeout> | null = null;\n  try {\n    return await Promise.race([\n      Promise.resolve(operation),\n      new Promise<T>((_, reject) => {\n        timer = setTimeout(() => {\n          reject(new Error(\`Tempo esgotado ao \${label}. O app vai conferir o estado atual antes de permitir nova tentativa.\`));\n        }, COURIER_ACTION_TIMEOUT_MS);\n      }),\n    ]);\n  } finally {\n    if (timer) clearTimeout(timer);\n  }\n}\n\n${anchor}`;
  source = source.replace(anchor, helper);
}

const transitionPattern = /  const transitionDelivery = async \(status: string\) => \{[\s\S]*?\n  \};\n\n  const completeDelivery = async \(\) => \{/;
if (!source.includes('const transitionJobId = activeJob.id;')) {
  const match = source.match(transitionPattern);
  if (!match) throw new Error('Entregador Parceiro: transitionDelivery não encontrado.');
  const replacement = `  const transitionDelivery = async (status: string) => {\n    if (!activeJob || !courier?.id || busy) return;\n    const transitionJobId = activeJob.id;\n    setBusy("delivery");\n    try {\n      const { error } = await courierActionWithTimeout(\n        rpc("courier_transition_delivery", {\n          _delivery_job_id: transitionJobId,\n          _new_status: status,\n        }),\n        "atualizar a etapa da entrega",\n      );\n      if (error) {\n        toast.error(courierReadableError(error, "Não foi possível atualizar a entrega."));\n        await loadCourierOperations(courier.id);\n        return;\n      }\n\n      // O backend confirmou: avança a UI imediatamente e usa o refetch apenas\n      // como reconciliação. Assim o botão não fica aparentemente travado\n      // aguardando Realtime/polling para mostrar a próxima etapa.\n      setActiveJob((current: any) =>\n        current?.id === transitionJobId ? { ...current, status } : current,\n      );\n      toast.success("Etapa atualizada.");\n      await loadCourierOperations(courier.id);\n    } catch (error) {\n      toast.error(courierReadableError(\n        error,\n        "A atualização demorou demais. Conferimos a entrega antes de permitir nova tentativa.",\n      ));\n      await loadCourierOperations(courier.id);\n    } finally {\n      setBusy((current) => (current === "delivery" ? null : current));\n    }\n  };\n\n  const completeDelivery = async () => {`;
  source = source.replace(transitionPattern, replacement);
}

const completePattern = /  const completeDelivery = async \(\) => \{[\s\S]*?\n  \};\n\n  const reportDeliveryProblem = async \(\) => \{/;
if (!source.includes('const completionJobId = activeJob.id;')) {
  const match = source.match(completePattern);
  if (!match) throw new Error('Entregador Parceiro: completeDelivery não encontrado.');
  const replacement = `  const completeDelivery = async () => {\n    if (!activeJob || !courier?.id || !/^\\d{4}$/.test(pin))\n      return toast.error("Informe o PIN de 4 dígitos do cliente.");\n    if (busy) return;\n\n    const deliveredJob = activeJob;\n    const completionJobId = activeJob.id;\n    setBusy("delivery");\n    try {\n      const { data, error } = await courierActionWithTimeout(\n        rpc("complete_delivery_with_pin", {\n          _delivery_job_id: completionJobId,\n          _pin: pin,\n        }),\n        "confirmar a entrega",\n      );\n      if (error) {\n        toast.error(courierReadableError(error, "Não foi possível concluir a entrega."));\n        await loadCourierOperations(courier.id);\n        return;\n      }\n      if (!data) {\n        toast.error("PIN incorreto. Confira com o cliente.");\n        return;\n      }\n\n      // O backend confirmou a conclusão. Remove a entrega ativa imediatamente\n      // para não deixar o entregador preso no destino anterior enquanto o\n      // Realtime/refetch chega, e mantém o resumo de conclusão visível.\n      setActiveJob((current: any) => (current?.id === completionJobId ? null : current));\n      setPin("");\n      setSupportOpen(false);\n      setSupportDescription("");\n      setCompletedJob({ ...deliveredJob, status: "delivered" });\n      toast.success("Entrega concluída!");\n      await loadCourierOperations(courier.id);\n    } catch (error) {\n      toast.error(courierReadableError(\n        error,\n        "A confirmação demorou demais. Conferimos a entrega antes de permitir nova tentativa.",\n      ));\n      await loadCourierOperations(courier.id);\n    } finally {\n      setBusy((current) => (current === "delivery" ? null : current));\n    }\n  };\n\n  const reportDeliveryProblem = async () => {`;
  source = source.replace(completePattern, replacement);
}

for (const marker of [
  'const COURIER_ACTION_TIMEOUT_MS = 20_000;',
  'async function courierActionWithTimeout<T>',
  'Tempo esgotado ao ${label}.',
  'const transitionJobId = activeJob.id;',
  'setActiveJob((current: any) =>',
  'const completionJobId = activeJob.id;',
  'setCompletedJob({ ...deliveredJob, status: "delivered" });',
  'current === "delivery" ? null : current',
]) {
  if (!source.includes(marker)) throw new Error(`[FAIL] Entregador Parceiro: timeout/handoff incompleto (${marker}).`);
}

writeFileSync(path, source, 'utf8');
console.log('[OK] Entregador Parceiro: transições e conclusão possuem timeout, reconciliação e avanço local sem spinner infinito.');
