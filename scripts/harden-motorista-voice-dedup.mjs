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
  (source) => {
    let next = source.replace(
      '        setRouteSteps(nextSteps);\n        resetSpokenCache();\n        const firstInstruction =',
      '        setRouteSteps(nextSteps);\n        const firstInstruction =',
    );

    // O modal de oferta já possui o ciclo correto de ringtone. Removemos a fala
    // adicional injetada em presentOffer para não ouvir "Nova corrida" duas vezes.
    next = next.replace(
      `      setIncoming(r);\n      setCountdown(computeOfferCountdown(r));\n      const pickupVoice = String((r as any).pickup_short_label || (r as any).pickup_label || r.origin_name || "").trim();\n      const offerVoice = pickupVoice\n        ? \`Nova corrida. Embarque em \${pickupVoice}. Verifique os detalhes para aceitar.\`\n        : "Nova corrida. Verifique os detalhes para aceitar.";\n      void speak(offerVoice, { dedupKey: \`\${r.id}:new-offer\`, interrupt: true });\n      if (navigator.vibrate) navigator.vibrate([280, 120, 280, 120, 280]);`,
      `      setIncoming(r);\n      setCountdown(computeOfferCountdown(r));\n      if (navigator.vibrate) navigator.vibrate([280, 120, 280, 120, 280]);`,
    );

    // Mantém uma única fala no próprio modal, junto do toque de chamada.
    next = next.replace(
      `  // Toque de chamada + voz "Nova corrida" enquanto a oferta estiver visível.\n  useEffect(() => {\n    startRideRingtone();\n    void speak("Nova corrida", { interrupt: true });\n    return () => { stopRideRingtone(); };\n  }, []);`,
      `  // Toque de chamada + uma única voz contextual enquanto a oferta estiver visível.\n  useEffect(() => {\n    startRideRingtone();\n    const pickupVoice = String((ride as any).pickup_short_label || (ride as any).pickup_label || ride.origin_name || "").trim();\n    const offerVoice = pickupVoice\n      ? \`Nova corrida. Embarque em \${pickupVoice}. Verifique os detalhes para aceitar.\`\n      : "Nova corrida. Verifique os detalhes para aceitar.";\n    void speak(offerVoice, { dedupKey: \`\${ride.id}:new-offer\`, interrupt: true });\n    return () => { stopRideRingtone(); };\n  }, [ride.id]);`,
    );

    return next;
  },
  (source) =>
    source.includes('setRouteSteps(nextSteps);\n        const firstInstruction =') &&
    !source.includes('setRouteSteps(nextSteps);\n        resetSpokenCache();\n        const firstInstruction =') &&
    source.includes('Nova corrida. Embarque em') &&
    source.includes('${ride.id}:new-offer') &&
    !source.includes('${r.id}:new-offer'),
  'motorista: recálculo não repete falas e nova corrida é anunciada uma única vez',
);

console.log(`[OK] deduplicação da orientação por voz concluída em ${workspace}`);
