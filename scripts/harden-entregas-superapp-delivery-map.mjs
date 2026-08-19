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

// O cartão contém outro ternário `) : null}` internamente. Por isso o fim
// precisa ser ancorado no fechamento da própria section, não no primeiro
// ternário encontrado após o início do cartão.
const pinUiStart = '      {job.status === "arrived_destination" ? (\n        <div className="border-t border-zinc-900 p-4">';
const pinUiEnd = '      ) : null}\n    </section>';
if (source.includes(pinUiStart)) {
  const start = source.indexOf(pinUiStart);
  const end = source.indexOf(pinUiEnd, start);
  if (end < 0) throw new Error('Mapa Entregas: fechamento estrutural do cartão duplicado de PIN não encontrado.');
  source = source.slice(0, start) + '    </section>' + source.slice(end + pinUiEnd.length);
}

for (const forbidden of ['confirmationPin', 'setConfirmationPin', 'KeyRound']) {
  if (source.includes(forbidden)) throw new Error(`Mapa Entregas ainda contém PIN duplicado: ${forbidden}`);
}
if (!source.includes('Acompanhe seu entregador')) {
  throw new Error('Mapa Entregas perdeu o conteúdo principal de rastreamento.');
}
if (!source.includes('</section>\n  );\n}')) {
  throw new Error('Mapa Entregas: JSX final perdeu o fechamento da section.');
}

writeFileSync(path, source, 'utf8');
console.log('[OK] Entregas: mapa fica dedicado ao rastreamento; PIN é exibido uma única vez na tela do pedido.');
