import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const path = resolve(process.cwd(), '.work/corridas/src/routes/_authenticated.corrida.$rideId.tsx');
let source = readFileSync(path, 'utf8');

function fail(message) {
  throw new Error('[FAIL] passageiro terminal reset: ' + message);
}

const marker = 'APOIS_TERMINAL_AUTO_HOME_V2';

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
  source = source.replace(anchor, anchor + '\n' + imports.join('\n'));
}

if (!source.includes(marker)) {
  const hookAnchor = '  } = useActiveRide();';
  if (!source.includes(hookAnchor)) fail('desestruturação useActiveRide não encontrada');

  const block = [
    '',
    '  const { clearDestination } = useDestination();',
    '  const { clearRoute } = useRoute();',
    '  const { clearStops } = useRideStops();',
    '  const { resetRequest } = useRideRequest();',
    '  const { setServiceDetails } = usePricing();',
    '',
    '  // ' + marker,
    '  const resetPassengerTripDraft = () => {',
    '    clearRide();',
    '    resetRequest();',
    '    clearStops();',
    '    clearRoute();',
    '    clearDestination();',
    '    setServiceDetails({});',
    '  };',
  ].join('\n');

  source = source.replace(hookAnchor, hookAnchor + block);
}

const loadEffect = `  useEffect(() => {
    if (rideId) void loadRide(rideId);
  }, [rideId, loadRide]);`;

if (!source.includes('APOIS_TERMINAL_AUTO_HOME_EFFECT_V2')) {
  if (!source.includes(loadEffect)) fail('efeito de carregamento da corrida não encontrado');

  const terminalEffect = `${loadEffect}

  // APOIS_TERMINAL_AUTO_HOME_EFFECT_V2
  useEffect(() => {
    if (screenState !== "completed" && screenState !== "cancelled") return;

    // Sai da jornada terminal sem manter mapa/rota antiga na tela.
    const timer = window.setTimeout(() => {
      resetPassengerTripDraft();
      void navigate({ to: "/inicio", replace: true });
    }, 450);

    return () => window.clearTimeout(timer);
  }, [screenState]); // reset/navigate são estáveis durante esta montagem`;

  source = source.replace(loadEffect, terminalEffect);
}

const oldBack = `  const handleBack = () => {
    if (screenState === "completed" || screenState === "cancelled") clearRide();
    void navigate({ to: "/inicio" });
  };`;
const newBack = `  const handleBack = () => {
    if (screenState === "completed" || screenState === "cancelled") {
      resetPassengerTripDraft();
      void navigate({ to: "/inicio", replace: true });
      return;
    }
    void navigate({ to: "/inicio" });
  };`;
if (source.includes(oldBack)) source = source.replace(oldBack, newBack);

const oldHome = `  const handleReturnHome = () => {
    clearRide();
    void navigate({ to: "/inicio" });
  };`;
const newHome = `  const handleReturnHome = () => {
    resetPassengerTripDraft();
    void navigate({ to: "/inicio", replace: true });
  };`;
if (source.includes(oldHome)) source = source.replace(oldHome, newHome);

for (const required of [
  marker,
  'APOIS_TERMINAL_AUTO_HOME_EFFECT_V2',
  'screenState !== "completed" && screenState !== "cancelled"',
  'resetPassengerTripDraft();',
  'clearDestination();',
  'clearRoute();',
  'clearStops();',
  'resetRequest();',
  'setServiceDetails({});',
  'navigate({ to: "/inicio", replace: true })',
]) {
  if (!source.includes(required)) fail('marcador final ausente: ' + required);
}

writeFileSync(path, source, 'utf8');
console.log('[OK] Passageiro: corrida concluída/cancelada limpa jornada e volta automaticamente ao Início.');
