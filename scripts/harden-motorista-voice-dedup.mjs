import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
const workspace = process.env.APOIS_MOTORISTA_WORKSPACE || '.work/motorista-test';

function patch(relativePath, transform, verify, label) {
  const path = resolve(root, workspace, relativePath);
  const before = readFileSync(path, 'utf8');
  const after = transform(before);
  if (!verify(after)) throw new Error(`[FAIL] ${label}: ${relativePath}`);
  if (after !== before) writeFileSync(path, after, 'utf8');
  console.log(`[OK] ${label}${after === before ? ' (já aplicado)' : ''}`);
}

patch(
  'src/lib/voiceNav.ts',
  (source) => source.replace(
    '    const preKey = `${rideId}:${i}:pre`;\n    const nowKey = `${rideId}:${i}:now`;',
    '    const instructionKey = cleanVoiceInstruction(step.instruction).toLocaleLowerCase("pt-BR");\n    const preKey = `${rideId}:${instructionKey}:pre`;\n    const nowKey = `${rideId}:${instructionKey}:now`;',
  ),
  (source) => source.includes('const instructionKey = cleanVoiceInstruction(step.instruction)') && source.includes('${rideId}:${instructionKey}:pre'),
  'motorista: deduplicação da voz usa a instrução/rua, não o índice da rota',
);

patch(
  'src/routes/motorista.app.tsx',
  (source) => source.replace(
    '        setRouteSteps(nextSteps);\n        resetSpokenCache();\n        const firstInstruction =',
    '        setRouteSteps(nextSteps);\n        const firstInstruction =',
  ),
  (source) => source.includes('setRouteSteps(nextSteps);\n        const firstInstruction =') && !source.includes('setRouteSteps(nextSteps);\n        resetSpokenCache();\n        const firstInstruction ='),
  'motorista: recálculo de rota não repete todas as falas já emitidas',
);

console.log(`[OK] deduplicação da orientação por voz concluída em ${workspace}`);
