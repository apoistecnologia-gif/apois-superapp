import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
const workspace = process.env.APOIS_MOTORISTA_WORKSPACE || '.work/motorista-test';
const path = resolve(root, workspace, 'src/routes/motorista.app.tsx');
let source = readFileSync(path, 'utf8');

const marker = 'Motorista e passageiro usam o mesmo perfil';

if (!source.includes(marker)) {
  const needle = `  async function submitRating() {\n    if (!ratingRide) return;\n    if (submittingRating || ratingSubmitted) return;`;
  if (!source.includes(needle)) {
    throw new Error('[FAIL] motorista rating: submitRating não encontrado');
  }

  const replacement = `  async function submitRating() {\n    if (!ratingRide) return;\n\n    // Homologação pode usar a mesma conta nos dois aparelhos. Nesse cenário\n    // a nota não pode ser persistida porque seria uma autoavaliação, mas o\n    // fluxo de encerramento precisa continuar sem exibir erro falso ao motorista.\n    if (userId && ratingRide.passenger_id === userId) {\n      ratedRidesRef.current.add(ratingRide.id);\n      setRatingError(null);\n      setRatingSubmitted(true);\n      toast.info(\"Avaliação de teste concluída\", {\n        description: \"Motorista e passageiro usam o mesmo perfil. A nota não altera a reputação.\",\n        duration: 5500,\n      });\n      return;\n    }\n\n    if (submittingRating || ratingSubmitted) return;`;

  source = source.replace(needle, replacement);
}

for (const required of [
  'ratingRide.passenger_id === userId',
  'Avaliação de teste concluída',
  marker,
  'setRatingSubmitted(true)',
]) {
  if (!source.includes(required)) {
    throw new Error(`[FAIL] motorista rating: contrato ausente (${required})`);
  }
}

writeFileSync(path, source, 'utf8');
console.log('[OK] Motorista: autoavaliação de homologação não quebra o encerramento nem altera reputação.');
