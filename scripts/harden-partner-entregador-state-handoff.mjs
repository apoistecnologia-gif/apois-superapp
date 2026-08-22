import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
const workspace = process.env.APOIS_ENTREGAS_WORKSPACE || '.work/partner-entregador';
const path = resolve(root, workspace, 'src/routes/courier.tsx');
let source = readFileSync(path, 'utf8');

// Ao aceitar uma entrega, nenhuma outra oferta pode continuar visível: o backend
// já garante uma única entrega ativa e get_courier_incoming_offers retorna vazio
// enquanto houver job ativo.
source = source.replace(
  'setOffers((current) => current.filter((offer: any) => offer.id !== acceptedOfferId));',
  'setOffers([]);',
);

if (!source.includes('const activeJobIdentity = activeJob?.id ?? null;')) {
  const anchor = `  const [currentPosition, setCurrentPosition] = useState<CourierPosition | null>(null);`;
  if (!source.includes(anchor)) throw new Error('Entregador Parceiro: estado de posição não encontrado.');
  source = source.replace(
    anchor,
    `${anchor}\n  const activeJobIdentity = activeJob?.id ?? null;`,
  );

  const effectAnchor = `  useEffect(() => {\n    void loadAll();\n  }, [loadAll]);`;
  if (!source.includes(effectAnchor)) throw new Error('Entregador Parceiro: efeito inicial não encontrado.');
  source = source.replace(
    effectAnchor,
    `${effectAnchor}\n\n  useEffect(() => {\n    // PIN e suporte pertencem a uma entrega específica. Nunca carregue rascunho\n    // da entrega anterior para um novo job recebido por Realtime/Push/resume.\n    setPin(\"\");\n    setSupportOpen(false);\n    setSupportDescription(\"\");\n    if (activeJobIdentity) setOffers([]);\n  }, [activeJobIdentity]);`,
  );
}

const oldDone = `<CourierCompletionSheet job={completedJob} onDone={() => setCompletedJob(null)} />`;
const newDone = `<CourierCompletionSheet\n              job={completedJob}\n              onDone={() => {\n                setCompletedJob(null);\n                setPin(\"\");\n                setSupportOpen(false);\n                setSupportDescription(\"\");\n                if (courier?.id) void loadCourierOperations(courier.id);\n              }}\n            />`;
if (source.includes(oldDone)) source = source.replace(oldDone, newDone);

for (const marker of [
  'const activeJobIdentity = activeJob?.id ?? null;',
  'setPin("");',
  'if (activeJobIdentity) setOffers([]);',
  'setSupportDescription("");',
  'if (courier?.id) void loadCourierOperations(courier.id);',
  'setOffers([]);',
]) {
  if (!source.includes(marker)) throw new Error(`[FAIL] Entregador Parceiro: handoff de estado incompleto (${marker}).`);
}

writeFileSync(path, source, 'utf8');
console.log('[OK] Entregador Parceiro: troca/conclusão de entrega limpa PIN, suporte e ofertas antigas e força reconciliação ao voltar para a fila.');
