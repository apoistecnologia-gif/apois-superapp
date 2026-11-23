import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const workspace = resolve(process.env.APOIS_CORRIDAS_WORKSPACE || ".work/corridas");
const MARKER = "APOIS_PASSENGER_AUDIT_20261123";

function replaceOnce(source, from, to, label) {
  const matches = source.split(from).length - 1;
  if (matches !== 1) throw new Error("[FAIL] Passageiro " + label + ": anchors=" + matches);
  return source.replace(from, to);
}
function patch(relative, transform, required) {
  const path = resolve(workspace, relative);
  if (!existsSync(path)) throw new Error("[FAIL] Passageiro: arquivo não encontrado: " + relative);
  const before = readFileSync(path, "utf8");
  if (before.startsWith("// " + MARKER + " ")) {
    for (const token of required) if (!before.includes(token)) throw new Error("[FAIL] Passageiro patch incompleto: " + relative + " / " + token);
    return;
  }
  let next = transform(before);
  if (next === before) throw new Error("[FAIL] Passageiro: nenhuma mudança em " + relative);
  next = "// " + MARKER + " " + relative + "\n" + next;
  for (const token of required) if (!next.includes(token)) throw new Error("[FAIL] Passageiro contrato ausente: " + relative + " / " + token);
  writeFileSync(path, next, "utf8");
  console.log("[OK] Auditoria Passageiro: " + relative);
}
const serviceDetailsForm = "import React from \"react\";\nimport { usePricing } from \"@/hooks/use-pricing\";\nimport { useRideCategories } from \"@/hooks/use-ride-categories\";\n\ntype ToggleOption = { key: string; label: string };\nconst FREIGHT_OPTIONS: ToggleOption[] = [\n  { key: \"itemPesado\", label: \"Item pesado\" },\n  { key: \"desmontar\", label: \"Montagem ou desmontagem\" },\n  { key: \"embalar\", label: \"Embalagem\" },\n];\nconst TOW_OPTIONS: ToggleOption[] = [\n  { key: \"dificilAcesso\", label: \"Acesso difícil\" },\n  { key: \"acidente\", label: \"Veículo acidentado\" },\n  { key: \"precisaPlataforma\", label: \"Precisa de plataforma\" },\n  { key: \"rodasTravadas\", label: \"Rodas travadas\" },\n  { key: \"garagemSubsolo\", label: \"Garagem ou subsolo\" },\n];\nexport const ServiceDetailsForm: React.FC<{ isOpen: boolean; onClose: () => void }> = ({\n  isOpen,\n  onClose,\n}) => {\n  const { selectedCategory } = useRideCategories();\n  const { serviceDetails, setServiceDetails } = usePricing();\n  const details = serviceDetails as Record<string, unknown>;\n  const code = selectedCategory?.code;\n  if (!isOpen || !code || ![\"fretes\", \"guincho\", \"envios\"].includes(code)) return null;\n\n  const update = (key: string, value: unknown) => {\n    setServiceDetails({ ...serviceDetails, [key]: value });\n  };\n  const options = code === \"fretes\" ? FREIGHT_OPTIONS : code === \"guincho\" ? TOW_OPTIONS : [];\n\n  return (\n    <section className=\"rounded-2xl border border-white/10 bg-zinc-900 px-5 py-5 space-y-4\" aria-label=\"Detalhes do serviço\">\n      <h3 className=\"text-base font-black text-white\">Detalhes de {selectedCategory.name}</h3>\n      {code === \"fretes\" && (\n        <label className=\"block text-sm font-semibold text-white\">\n          Ajudantes\n          <select\n            aria-label=\"Quantidade de ajudantes\"\n            className=\"mt-2 w-full rounded-lg bg-zinc-800 p-3 text-white\"\n            value={String(details['ajudantes'] ?? \"nenhum\")}\n            onChange={(event) => update(\"ajudantes\", event.target.value)}\n          >\n            <option value=\"nenhum\">Sem ajudantes</option>\n            <option value=\"um\">Um ajudante</option>\n            <option value=\"dois\">Dois ajudantes</option>\n          </select>\n        </label>\n      )}\n      {code === \"guincho\" && (\n        <label className=\"block text-sm font-semibold text-white\">\n          Tipo do veículo\n          <select\n            aria-label=\"Tipo do veículo para guincho\"\n            className=\"mt-2 w-full rounded-lg bg-zinc-800 p-3 text-white\"\n            value={String(details['tipoVeiculo'] ?? \"carro\")}\n            onChange={(event) => update(\"tipoVeiculo\", event.target.value)}\n          >\n            <option value=\"carro\">Carro de passeio</option>\n            <option value=\"utilitario\">Utilitário</option>\n            <option value=\"caminhonete\">Caminhonete</option>\n          </select>\n        </label>\n      )}\n      {code === \"envios\" && (\n        <label className=\"block text-sm font-semibold text-white\">\n          Peso aproximado em kg\n          <input\n            type=\"number\"\n            min=\"0.1\"\n            step=\"0.1\"\n            inputMode=\"decimal\"\n            aria-label=\"Peso do envio em quilogramas\"\n            className=\"mt-2 w-full rounded-lg bg-zinc-800 p-3 text-white\"\n            value={typeof details['weightKg'] === \"number\" ? details['weightKg'] : \"\"}\n            onChange={(event) => {\n              const next = Number(event.target.value);\n              update(\"weightKg\", Number.isFinite(next) && next >= 0 ? next : 0);\n            }}\n            placeholder=\"Exemplo: 2.5\"\n          />\n        </label>\n      )}\n      {options.map((option) => (\n        <label key={option.key} className=\"flex items-center gap-3 text-sm text-white\">\n          <input\n            type=\"checkbox\"\n            className=\"h-5 w-5 accent-red-600\"\n            checked={details[option.key] === true}\n            onChange={(event) => update(option.key, event.target.checked)}\n          />\n          <span>{option.label}</span>\n        </label>\n      ))}\n      <p className=\"text-xs text-zinc-400\">\n        Alterar estas opções atualiza a cotação. O valor definitivo será validado pelo servidor.\n      </p>\n      <button\n        type=\"button\"\n        onClick={onClose}\n        className=\"w-full rounded-xl bg-red-600 px-4 py-3 text-sm font-bold text-white\"\n      >\n        Salvar detalhes\n      </button>\n    </section>\n  );\n};";

patch("src/components/pricing/ServiceDetailsForm.tsx", (s) => {
  if (!s.includes("Form implementation for each category would go here")) {
    throw new Error("[FAIL] Passageiro: formulário base de adicionais mudou; revisão obrigatória");
  }
  return serviceDetailsForm;
}, ["FREIGHT_OPTIONS", "TOW_OPTIONS", "weightKg", "setServiceDetails"]);

patch("src/types/pricing.ts", (s) => replaceOnce(
  s,
  "  categoryIds?: string[];\n}",
  "  categoryIds?: string[];\n  serviceDetails?: Record<string, unknown>;\n}",
  "tipar detalhes da cotação",
), ["serviceDetails?: Record<string, unknown>"]);

patch("src/hooks/use-pricing.tsx", (s) => {
  if (!s.includes("APOIS_REPORT09_PRICING_V1")) throw new Error("[FAIL] Passageiro requer preço seguro do Relatório 09");
  s = replaceOnce(s,
    "      categoryIds: categories.map((c) => c.id),",
    "      categoryIds: categories.map((c) => c.id),\n      serviceDetails: serviceDetails as Record<string, unknown>,",
    "cotação com adicionais");
  return replaceOnce(s,
    "}, [route, routeIsCurrent, orderedStops, categories]);",
    "}, [route, routeIsCurrent, orderedStops, categories, serviceDetails]);",
    "invalidação da cotação");
}, ["serviceDetails: serviceDetails as Record<string, unknown>", "categories, serviceDetails"]);

patch("src/types/rides/ride-request.ts", (s) => replaceOnce(
  s,
  "  estimated_price?: number | null;",
  "  estimated_price?: number | null;\n  expected_price_cents?: number;",
  "tipo de confirmação de preço",
), ["expected_price_cents?: number"]);

patch("src/hooks/rides/use-ride-request.tsx", (s) => {
  if (!s.includes("APOIS_REPORT09_SUBMIT_GUARD_V1") || !s.includes("APOIS_RIDE_COMFORT_PREFS_V1"))
    throw new Error("[FAIL] Passageiro requer anti-duplo-clique e preferências já integrados");
  s = replaceOnce(s,
    'import { useCheckoutPreparation } from "@/hooks/use-checkout-preparation";',
    'import { useCheckoutPreparation } from "@/hooks/use-checkout-preparation";\nimport { usePricing } from "@/hooks/use-pricing";',
    "hook de cotação no pedido");
  s = replaceOnce(s,
    "  const { checkout } = useCheckoutPreparation();",
    "  const { checkout } = useCheckoutPreparation();\n  const { serviceDetails } = usePricing();",
    "obter adicionais");
  s = replaceOnce(s,
    "  paymentMethod: string | null;\n}",
    "  paymentMethod: string | null;\n  detailsSignature: string;\n}",
    "assinatura de adicionais");
  s = replaceOnce(s,
    "    paymentMethod: null,\n  });",
    '    paymentMethod: null,\n    detailsSignature: "",\n  });',
    "estado inicial da assinatura");
  s = replaceOnce(s,
    '    const currentStopsSignature = JSON.stringify(route?.intermediates ?? []); // APOIS_STOPS_REQUEST_V2',
    '    const currentStopsSignature = JSON.stringify(route?.intermediates ?? []); // APOIS_STOPS_REQUEST_V2\n    const currentDetailsSignature = JSON.stringify(serviceDetails);',
    "detalhes na revisão");
  s = replaceOnce(s,
    "      currentStopsSignature !== stopsSignatureRef.current;",
    "      currentStopsSignature !== stopsSignatureRef.current ||\n      currentDetailsSignature !== requestDataRef.current.detailsSignature;",
    "invalidar chave idempotente ao alterar adicionais");
  s = replaceOnce(s,
    "        paymentMethod: selectedMethod,\n      };",
    "        paymentMethod: selectedMethod,\n        detailsSignature: currentDetailsSignature,\n      };",
    "salvar assinatura no request");
  s = replaceOnce(s,
    "  }, [selectedCategory, selectedMethod, route, request.requestKey]);",
    "  }, [selectedCategory, selectedMethod, route, request.requestKey, serviceDetails]);",
    "dependência da revisão");
  s = replaceOnce(s,
    "    requestDataRef.current = { category: null, origin: null, destination: null, paymentMethod: null };",
    '    requestDataRef.current = { category: null, origin: null, destination: null, paymentMethod: null, detailsSignature: "" };',
    "reset dos detalhes");

  // Preserve the three existing comfort preferences for standard cars.
  s = replaceOnce(s,
    'service_details: { ...(selectedCategory.details ?? {}), ...(selectedCategory.code === "carros" && comfort ? {ride_comfort_preferences: comfort} : {}) },',
    'service_details: { ...serviceDetails, ...(selectedCategory.code === "carros" && comfort ? {ride_comfort_preferences: comfort} : {}) },',
    "adicionais e conforto no pedido");
  s = replaceOnce(s,
    "        payment_method: selectedMethod,",
    "        payment_method: selectedMethod,\n        expected_price_cents: Math.round(checkout.finalTotal * 100),",
    "comparação em centavos");
  s = replaceOnce(s,
    '        latest.stops === stopsSignatureRef.current;',
    '        latest.stops === stopsSignatureRef.current &&\n        requestDataRef.current.detailsSignature === JSON.stringify(serviceDetails);',
    "consistência dos adicionais durante confirmação");
  // A server-side 409 must show the price change, not only a generic FunctionsHttpError.
  s = replaceOnce(s,
    "        if (error) throw error;",
    '        if (error) {\n          const context = (error as { context?: Response }).context;\n          if (context && typeof context.clone === "function") {\n            const responseData = await context.clone().json().catch(() => null) as { error_code?: string } | null;\n            if (responseData?.error_code === "price_changed") {\n              throw new Error("O valor mudou. Volte e revise a cotação antes de solicitar.");\n            }\n          }\n          throw error;\n        }',
    "erro quando preço mudou");
  s = replaceOnce(s,
    "pickupPlaceId, destination, selectedMethod]);",
    "pickupPlaceId, destination, selectedMethod, serviceDetails, checkout, confirmedStops]);",
    "dependências do envio");
  return s;
}, ["detailsSignature", "expected_price_cents", "service_details: { ...serviceDetails", 'error_code === "price_changed"']);

patch("src/routes/_authenticated.revisar-solicitacao.tsx", (s) => {
  if (!s.includes("APOIS_REPORT09_REVIEW_GUARD_V1")) throw new Error("[FAIL] Passageiro perdeu guarda de cotação");
  s = replaceOnce(s,
    'import { useActiveRide } from "@/hooks/rides/use-active-ride";',
    'import { activeRideService } from "@/services/rides/active-ride-service";\nimport { useAuth } from "@/hooks/use-auth";\nimport { usePricing } from "@/hooks/use-pricing";\nimport { toast } from "sonner";',
    "dependências da recuperação");
  s = replaceOnce(s,
    "  const { recoverActiveRide } = useActiveRide();",
    "  const { profile } = useAuth();\n  const { serviceDetails } = usePricing();",
    "perfil de domínio e detalhes");
  s = replaceOnce(s,
    "      const existingRideId = await recoverActiveRide();",
    '      if (!profile?.id) {\n        toast.error("Não foi possível confirmar sua sessão.");\n        return;\n      }\n      let existingRideId: string | null = null;\n      try {\n        const existingRide = await activeRideService.getActiveRide(profile.id);\n        existingRideId = existingRide?.id ?? null;\n      } catch (error) {\n        console.warn("[Passageiro] Consulta de corrida ativa indisponível", error);\n        toast.error("Não foi possível verificar sua corrida ativa. Confira a conexão.");\n        return;\n      }',
    "não tratar falha de rede como corrida ausente");
  s = replaceOnce(s, "recoverActiveRide, walletState]", "profile?.id, walletState]", "deps de recuperação");
  s = replaceOnce(s,
    'selectedCategory?.details && Object.keys(selectedCategory.details).length > 0',
    'Object.keys(serviceDetails).length > 0',
    "mostrar adicionais informados");
  s = replaceOnce(s, 'Object.entries(selectedCategory.details)', 'Object.entries(serviceDetails)', "detalhes na confirmação");
  return s;
}, ["activeRideService.getActiveRide(profile.id)", "Object.entries(serviceDetails)", "profile?.id"]);

patch("src/routes/_authenticated.corrida.$rideId.tsx", (s) => {
  if (!s.includes('if (screenState === "completed")')) throw new Error("[FAIL] Passageiro sem terminal concluído QA");
  s = replaceOnce(s,
    '>Valor Total</span>',
    '>Taxa de Cancelamento</span>',
    "rótulo valor cancelado");
  return replaceOnce(s,
    'R$ {(ride.final_price ?? ride.estimated_price).toFixed(2).replace(".", ",")}',
    'R$ {(ride.cancellation_fee ?? 0).toFixed(2).replace(".", ",")}',
    "valor cancelamento");
}, ['Taxa de Cancelamento', "ride.cancellation_fee ?? 0"]);

patch("src/services/routes/route-service.ts", (s) => replaceOnce(s,
  '        { body: request },',
  '        { body: request, signal: controller.signal },',
  "abortar HTTP rota anterior",
), ["signal: controller.signal"]);


const timeoutPath = resolve(workspace, "src/hooks/rides/use-ride-request.tsx");
{
  const src = readFileSync(timeoutPath, "utf8");
  if (!src.includes("APOIS_PASSENGER_AUDIT_ABORT_V1")) {
    const begin = src.indexOf("async function invokeRequestRideWithTimeout(body: object) {");
    const end = src.indexOf("\n\ninterface RideRequestContextType", begin);
    if (begin < 0 || end < 0) throw new Error("[FAIL] Passageiro: helper timeout inesperado");
    const safe = [
      "// APOIS_PASSENGER_AUDIT_ABORT_V1: abort HTTP and reconcile uncertain server state.",
      "async function invokeRequestRideWithTimeout(body: object) {",
      "  const controller = new AbortController();",
      '  const timeoutId = setTimeout(() => controller.abort(), REQUEST_RIDE_TIMEOUT_MS);',
      "  try {",
      '    return await supabase.functions.invoke("request-ride", { body, signal: controller.signal });',
      "  } catch (error) {",
      '    if (controller.signal.aborted) throw new Error("request_timeout");',
      "    throw error;",
      "  } finally {",
      "    clearTimeout(timeoutId);",
      "  }",
      "}"
    ].join("\n");
    const updated = src.slice(0, begin) + safe + src.slice(end);
    writeFileSync(timeoutPath, updated, "utf8");
  }
}

patch("supabase/functions/request-ride/index.ts", (s) => {
  s = replaceOnce(s,
    "  estimated_price?: number | null;",
    "  estimated_price?: number | null;\n  expected_price_cents?: number;",
    "tipar preco esperado no RequestBody");
  const anchor = "    const estimatedPrice = fare.total;";
  return replaceOnce(s, anchor,
    anchor + '\n    // APOIS_PASSENGER_AUDIT_PRICE_V1: server recomputes; client cents only verify.\n    const expectedPriceCents = body?.expected_price_cents;\n    const authoritativePriceCents = Math.round(estimatedPrice * 100);\n    if (expectedPriceCents !== undefined) {\n      if (typeof expectedPriceCents !== "number" || !Number.isSafeInteger(expectedPriceCents) || expectedPriceCents <= 0) {\n        return json({ ok: false, error_code: "invalid_expected_price", message: "Valor de confirmação inválido." }, 422);\n      }\n      if (expectedPriceCents !== authoritativePriceCents) {\n        return json({ ok: false, error_code: "price_changed", message: "O valor da corrida mudou. Revise antes de confirmar.", estimated_price: estimatedPrice, fare_amount_cents: authoritativePriceCents }, 409);\n      }\n    }',
    "validação de preço no backend gerado");
}, ["APOIS_PASSENGER_AUDIT_PRICE_V1", "expected_price_cents", "price_changed"]);

console.log("[OK] Passageiro: auditoria de fluxo, preço, adicionais, GPS e timeout aplicada somente à cópia descartável.");
