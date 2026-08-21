import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const path = resolve('.work/corridas/src/routes/_authenticated.corrida.$rideId.tsx');
let source = readFileSync(path, 'utf8');

function fail(message) {
  throw new Error(`[FAIL] passageiro terminal reset: ${message}`);
}

const imports = [
  'import { useDestination } from "@/hooks/use-destination";',
  'import { useRoute } from "@/hooks/use-route";',
  'import { useRideStops } from "@/hooks/rides/use-ride-stops";',
  'import { useRideRequest } from "@/hooks/rides/use-ride-request";',
  'import { usePricing } from "@/hooks/use-pricing";',
];

if (!source.includes(imports[0])) {
  const anchor = 'import { useActiveRide } from "@/hooks/rides/use-active-ride";';
  if (!source.includes(anchor)) fail('import useActiveRide não encontrado');
  source = source.replace(anchor, `${anchor}\n${imports.join('\n')}`);
}

const marker = 'APOIS_TERMINAL_TRIP_RESET_V1';
if (!source.includes(marker)) {
  const hookAnchor = '  } = useActiveRide();';
  if (!source.includes(hookAnchor)) fail('desestruturação useActiveRide não encontrada');

  const resetBlock = [
    '',
    '  const { clearDestination } = useDestination();',
    '  const { clearRoute } = useRoute();',
    '  const { clearStops } = useRideStops();',
    '  const { resetRequest } = useRideRequest();',
    '  const { setServiceDetails } = usePricing();',
    '',
    `  // ${marker}`,
    '  const resetPassengerTripDraft = () => {',
    '    clearRide();',
    '    resetRequest();',
    '    clearStops();',
    '    clearRoute();',
    '    clearDestination();',
    '    setServiceDetails({});',
    '  };',
  ].join('\n');
  source = source.replace(hookAnchor, `${hookAnchor}${resetBlock}`);
}

const oldBack = `  const handleBack = () => {\n    if (screenState === "completed") {\n      clearRide();\n      void navigate({ to: "/corridas/$rideId", params: { rideId } });\n      return;\n    }\n    if (screenState === "cancelled") clearRide();\n    void navigate({ to: "/inicio" });\n  };`;
const newBack = `  const handleBack = () => {\n    if (screenState === "completed") {\n      clearRide();\n      void navigate({ to: "/corridas/$rideId", params: { rideId } });\n      return;\n    }\n    if (screenState === "cancelled") {\n      resetPassengerTripDraft();\n      void navigate({ to: "/inicio", replace: true });\n      return;\n    }\n    void navigate({ to: "/inicio" });\n  };`;
if (source.includes(oldBack)) source = source.replace(oldBack, newBack);
else if (!source.includes('if (screenState === "cancelled") {\n      resetPassengerTripDraft();')) fail('handleBack não reconhecido');

const oldHome = `  const handleReturnHome = () => {\n    clearRide();\n    void navigate({ to: "/inicio" });\n  };`;
const newHome = `  const handleReturnHome = () => {\n    resetPassengerTripDraft();\n    void navigate({ to: "/inicio", replace: true });\n  };`;
if (source.includes(oldHome)) source = source.replace(oldHome, newHome);
else if (!source.includes('const handleReturnHome = () => {\n    resetPassengerTripDraft();')) fail('handleReturnHome não reconhecido');

// Todas as confirmações de cancelamento devem zerar também destino, rota,
// paradas, request e detalhes de serviço antes de voltar para Início.
source = source.replaceAll(
  `            clearRide();\n            void navigate({ to: "/inicio", replace: true });`,
  `            resetPassengerTripDraft();\n            void navigate({ to: "/inicio", replace: true });`,
);

for (const required of [
  marker,
  'clearDestination();',
  'clearRoute();',
  'clearStops();',
  'resetRequest();',
  'setServiceDetails({});',
  'const handleReturnHome = () => {\n    resetPassengerTripDraft();',
  'screenState === "cancelled"',
]) {
  if (!source.includes(required)) fail(`reset final incompleto: ${required}`);
}

// Se alguma rota de cancelamento ainda limpa só a corrida e navega para Início,
// o build deve falhar: isso recria a tela fotografada de categoria/rota antiga.
if (source.includes('clearRide();\n            void navigate({ to: "/inicio", replace: true });')) {
  fail('cancelamento ainda usa limpeza parcial');
}

writeFileSync(path, source, 'utf8');
console.log('[OK] Passageiro: finalizar/cancelar e Voltar ao início limpam todo o rascunho da corrida.');
