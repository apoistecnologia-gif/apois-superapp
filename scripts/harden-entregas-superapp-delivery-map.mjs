import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const path = resolve('.work/entregas/src/components/CustomerDeliveryMap.tsx');
let source = readFileSync(path, 'utf8');

source = source.replace(
  'import { Bike, KeyRound, Loader2, MapPin, Navigation } from "lucide-react";',
  'import { Bike, Loader2, MapPin, Navigation } from "lucide-react";',
);
source = source.replace('  const [confirmationPin, setConfirmationPin] = useState<string | null>(null);\n', '');

const pinEffectStart = '  useEffect(() => {\n    if (!job?.id || job.status !== "arrived_destination") {';
const pinEffectEnd = '  }, [job?.id, job?.status]);\n\n';
if (source.includes(pinEffectStart)) {
  const start = source.indexOf(pinEffectStart);
  const end = source.indexOf(pinEffectEnd, start);
  if (end < 0) throw new Error('Mapa Entregas: fim do efeito duplicado de PIN não encontrado.');
  source = source.slice(0, start) + source.slice(end + pinEffectEnd.length);
}

const pinUiStart = '      {job.status === "arrived_destination" ? (\n        <div className="border-t border-zinc-900 p-4">';
const pinUiEnd = '      ) : null}\n    </section>';
if (source.includes(pinUiStart)) {
  const start = source.indexOf(pinUiStart);
  const end = source.indexOf(pinUiEnd, start);
  if (end < 0) throw new Error('Mapa Entregas: fechamento estrutural do cartão duplicado de PIN não encontrado.');
  source = source.slice(0, start) + '    </section>' + source.slice(end + pinUiEnd.length);
}

// defaultCenter/defaultZoom só são lidos na montagem do Google Map. Em uma entrega
// real o marcador do entregador continuaria andando enquanto a câmera ficava na
// posição antiga. O mapa do cliente deve acompanhar a localização corrente.
source = source.replace(
  '              defaultCenter={\n                location\n                  ? { lat: Number(location.latitude), lng: Number(location.longitude) }\n                  : target!\n              }\n              defaultZoom={14}',
  '              center={\n                location\n                  ? { lat: Number(location.latitude), lng: Number(location.longitude) }\n                  : target!\n              }\n              zoom={14}',
);
source = source.replace(
  '<div className="h-64 w-full bg-zinc-900">',
  '<div className="h-[clamp(15rem,34dvh,20rem)] min-h-60 w-full bg-zinc-900">',
);

for (const forbidden of ['confirmationPin', 'setConfirmationPin', 'KeyRound', 'defaultCenter=', 'defaultZoom=']) {
  if (source.includes(forbidden)) throw new Error(`Mapa Entregas ainda contém estado/viewport legado: ${forbidden}`);
}
for (const marker of [
  'Acompanhe seu entregador',
  'center={',
  'zoom={14}',
  'h-[clamp(15rem,34dvh,20rem)]',
  'gestureHandling="greedy"',
]) {
  if (!source.includes(marker)) throw new Error(`Mapa Entregas perdeu hardening visual: ${marker}`);
}
if (!source.includes('</section>\n  );\n}')) {
  throw new Error('Mapa Entregas: JSX final perdeu o fechamento da section.');
}

writeFileSync(path, source, 'utf8');
console.log('[OK] Entregas: mapa acompanha o entregador em tempo real, adapta altura ao celular e PIN continua exibido uma única vez na tela do pedido.');
