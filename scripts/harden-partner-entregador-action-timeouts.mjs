import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
const workspace = process.env.APOIS_ENTREGAS_WORKSPACE || '.work/partner-entregador';
const path = resolve(root, workspace, 'src/routes/courier.tsx');
let source = readFileSync(path, 'utf8');

if (!source.includes('const COURIER_ACTION_TIMEOUT_MS = 20_000;')) {
  const anchor = 'function CourierApp() {';
  if (!source.includes(anchor)) throw new Error('Entregador Parceiro: CourierApp não encontrado.');
  const helper = `const COURIER_ACTION_TIMEOUT_MS = 20_000;\n\nasync function courierActionWithTimeout<T>(operation: PromiseLike<T>, label: string): Promise<any> {\n  let timer: ReturnType<typeof setTimeout> | null = null;\n  try {\n    return await Promise.race([\n      Promise.resolve(operation),\n      new Promise<T>((_, reject) => {\n        timer = setTimeout(() => {\n          reject(new Error(\`Tempo esgotado ao \${label}. O app vai conferir o estado atual antes de permitir nova tentativa.\`));\n        }, COURIER_ACTION_TIMEOUT_MS);\n      }),\n    ]);\n  } finally {\n    if (timer) clearTimeout(timer);\n  }\n}\n\n${anchor}`;
  source = source.replace(anchor, helper);
}

const acceptPattern = /  const acceptOffer = async \(offerId: string\) => \{[\s\S]*?\n  \};\n\n  const rejectOffer = async \(offerId: string\) => \{/;
if (!source.includes('const acceptedOfferId = offerId;')) {
  const match = source.match(acceptPattern);
  if (!match) throw new Error('Entregador Parceiro: acceptOffer não encontrado.');
  source = source.replace(
    acceptPattern,
    `  const acceptOffer = async (offerId: string) => {\n    if (!courier?.id || busy) return;\n    const acceptedOfferId = offerId;\n    setBusy(\`offer:\${offerId}\`);\n    try {\n      const { error } = await courierActionWithTimeout(\n        rpc("accept_delivery_offer", { _offer_id: acceptedOfferId }),\n        "aceitar a entrega",\n      );\n      if (error) {\n        toast.error(courierReadableError(error, "Esta entrega não está mais disponível."));\n        await loadCourierOperations(courier.id);\n        return;\n      }\n      // Some imediatamente com a oferta aceita para impedir duplo toque enquanto\n      // o backend/realtime entrega o job ativo.\n      setOffers((current) => current.filter((offer: any) => offer.id !== acceptedOfferId));\n      toast.success("Entrega aceita.");\n      await loadCourierOperations(courier.id);\n    } catch (error) {\n      toast.error(courierReadableError(error, "A resposta demorou demais. Conferimos as chamadas antes de permitir nova tentativa."));\n      await loadCourierOperations(courier.id);\n    } finally {\n      setBusy((current) => (current === \`offer:\${acceptedOfferId}\` ? null : current));\n    }\n  };\n\n  const rejectOffer = async (offerId: string) => {`,
  );
}

const rejectPattern = /  const rejectOffer = async \(offerId: string\) => \{[\s\S]*?\n  \};\n\n  const transitionDelivery = async \(status: string\) => \{/;
if (!source.includes('const rejectedOfferId = offerId;')) {
  const match = source.match(rejectPattern);
  if (!match) throw new Error('Entregador Parceiro: rejectOffer não encontrado.');
  source = source.replace(
    rejectPattern,
    `  const rejectOffer = async (offerId: string) => {\n    if (!courier?.id || busy) return;\n    const rejectedOfferId = offerId;\n    setBusy(\`offer:\${offerId}\`);\n    try {\n      const { error } = await courierActionWithTimeout(\n        rpc("reject_delivery_offer", { _offer_id: rejectedOfferId }),\n        "recusar a entrega",\n      );\n      if (error) {\n        toast.error(courierReadableError(error, "Não foi possível recusar esta chamada."));\n        await loadCourierOperations(courier.id);\n        return;\n      }\n      setOffers((current) => current.filter((offer: any) => offer.id !== rejectedOfferId));\n      await loadCourierOperations(courier.id);\n    } catch (error) {\n      toast.error(courierReadableError(error, "A resposta demorou demais. Conferimos as chamadas antes de permitir nova tentativa."));\n      await loadCourierOperations(courier.id);\n    } finally {\n      setBusy((current) => (current === \`offer:\${rejectedOfferId}\` ? null : current));\n    }\n  };\n\n  const transitionDelivery = async (status: string) => {`,
  );
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

const supportPattern = /  const reportDeliveryProblem = async \(\) => \{[\s\S]*?\n  \};\n\n  const savePayoutAccount = async \(\) => \{/;
if (!source.includes('const supportJobId = activeJob.id;')) {
  const match = source.match(supportPattern);
  if (!match) throw new Error('Entregador Parceiro: reportDeliveryProblem não encontrado.');
  source = source.replace(
    supportPattern,
    `  const reportDeliveryProblem = async () => {\n    if (!activeJob || busy) return;\n    const description = supportDescription.trim();\n    if (description.length < 10) {\n      toast.error("Descreva o problema com pelo menos 10 caracteres.");\n      return;\n    }\n\n    const supportJobId = activeJob.id;\n    setBusy("support");\n    try {\n      const { error } = await courierActionWithTimeout(\n        rpc("create_support_ticket", {\n          _category: "delivery",\n          _subject: \`Problema na entrega #\${activeJob.orders?.order_number ?? activeJob.order_id}\`,\n          _description: description,\n          _order_id: activeJob.order_id,\n          _delivery_job_id: supportJobId,\n        }),\n        "abrir o chamado de suporte",\n      );\n      if (error) {\n        toast.error(courierReadableError(error, "Não foi possível abrir o chamado."));\n        return;\n      }\n      setSupportOpen(false);\n      setSupportDescription("");\n      toast.success("Chamado aberto para o suporte.");\n    } catch (error) {\n      toast.error(courierReadableError(error, "A abertura do chamado demorou demais. Tente novamente."));\n    } finally {\n      setBusy((current) => (current === "support" ? null : current));\n    }\n  };\n\n  const savePayoutAccount = async () => {`,
  );
}

for (const marker of [
  'const COURIER_ACTION_TIMEOUT_MS = 20_000;',
  'async function courierActionWithTimeout<T>',
  'Tempo esgotado ao ${label}.',
  'const acceptedOfferId = offerId;',
  'const rejectedOfferId = offerId;',
  'setOffers((current) => current.filter',
  'const transitionJobId = activeJob.id;',
  'setActiveJob((current: any) =>',
  'const completionJobId = activeJob.id;',
  'setCompletedJob({ ...deliveredJob, status: "delivered" });',
  'const supportJobId = activeJob.id;',
  'current === "delivery" ? null : current',
  'current === "support" ? null : current',
]) {
  if (!source.includes(marker)) throw new Error(`[FAIL] Entregador Parceiro: timeout/handoff incompleto (${marker}).`);
}

writeFileSync(path, source, 'utf8');
console.log('[OK] Entregador Parceiro: aceitar/recusar, transições, conclusão e suporte possuem timeout, reconciliação e limpeza de busy sem spinner infinito.');
