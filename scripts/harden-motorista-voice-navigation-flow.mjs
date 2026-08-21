import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
const workspace = process.env.APOIS_MOTORISTA_WORKSPACE || '.work/motorista-test';

function patch(relativePath, transform, verify, label) {
  const path = resolve(root, workspace, relativePath);
  const before = readFileSync(path, 'utf8');
  const after = transform(before);
  if (!verify(after)) {
    throw new Error(`[FAIL] ${label}: contrato esperado não encontrado em ${relativePath}`);
  }
  if (after !== before) writeFileSync(path, after, 'utf8');
  console.log(`[OK] ${label}${after === before ? ' (já aplicado)' : ''}`);
}

patch(
  'src/lib/voiceNav.ts',
  (source) => {
    let next = source;

    // Uma versão antiga podia deixar a preferência de voz gravada como false.
    // Fazemos UMA migração para reativar a orientação no primeiro uso desta
    // versão; depois disso o botão de voz continua respeitando a escolha do motorista.
    if (!next.includes('VOICE_PREF_MIGRATION_KEY')) {
      next = next.replace(
        'const VOICE_PREF_KEY = "apois:motorista:voice-enabled";',
        'const VOICE_PREF_KEY = "apois:motorista:voice-enabled";\nconst VOICE_PREF_MIGRATION_KEY = "apois:motorista:voice-guidance-v2";',
      );
      next = next.replace(
        'let enabled = readStoredVoicePreference();',
        `function migrateVoicePreferenceOnce(): void {\n  if (typeof window === "undefined") return;\n  try {\n    if (window.localStorage.getItem(VOICE_PREF_MIGRATION_KEY) === "1") return;\n    window.localStorage.setItem(VOICE_PREF_KEY, "true");\n    window.localStorage.setItem(VOICE_PREF_MIGRATION_KEY, "1");\n  } catch { /* noop */ }\n}\n\nmigrateVoicePreferenceOnce();\nlet enabled = readStoredVoicePreference();`,
      );
    }

    // Higieniza instruções recebidas da rota antes de falar nomes de ruas.
    if (!next.includes('function cleanVoiceInstruction')) {
      next = next.replace(
        '/** Anuncia manobras conforme o motorista se aproxima. Chamar a cada update de GPS. */',
        `function cleanVoiceInstruction(value: string): string {\n  return String(value ?? "")\n    .replace(/<[^>]+>/g, " ")\n    .replace(/&nbsp;/gi, " ")\n    .replace(/&amp;/gi, " e ")\n    .replace(/&quot;/gi, " ")\n    .replace(/&#39;/gi, " ")\n    .replace(/\\s+/g, " ")\n    .trim();\n}\n\n/** Anuncia manobras conforme o motorista se aproxima. Chamar a cada update de GPS. */`,
      );
      next = next.replace(
        '      void speak(step.instruction, { dedupKey: nowKey });',
        '      void speak(cleanVoiceInstruction(step.instruction), { dedupKey: nowKey });',
      );
      next = next.replace(
        '      void speak(`Em ${meters} metros, ${step.instruction}`, { dedupKey: preKey });',
        '      void speak(`Em ${meters} metros, ${cleanVoiceInstruction(step.instruction)}`, { dedupKey: preKey });',
      );
    }

    return next;
  },
  (source) =>
    source.includes('VOICE_PREF_MIGRATION_KEY') &&
    source.includes('migrateVoicePreferenceOnce();') &&
    source.includes('cleanVoiceInstruction(step.instruction)') &&
    source.includes('Em ${meters} metros'),
  'motorista: voz ativa por padrão e instruções de rua limpas',
);

patch(
  'src/routes/motorista.app.tsx',
  (source) => {
    let next = source;

    // Nova oferta precisa falar de verdade, e não apenas vibrar/mostrar modal.
    if (!next.includes(':new-offer`')) {
      next = next.replace(
        '      setIncoming(r);\n      setCountdown(computeOfferCountdown(r));\n      if (navigator.vibrate) navigator.vibrate([280, 120, 280, 120, 280]);',
        `      setIncoming(r);\n      setCountdown(computeOfferCountdown(r));\n      const pickupVoice = String((r as any).pickup_short_label || (r as any).pickup_label || r.origin_name || "").trim();\n      const offerVoice = pickupVoice\n        ? \`Nova corrida. Embarque em \${pickupVoice}. Verifique os detalhes para aceitar.\`\n        : "Nova corrida. Verifique os detalhes para aceitar.";\n      void speak(offerVoice, { dedupKey: \`\${r.id}:new-offer\`, interrupt: true });\n      if (navigator.vibrate) navigator.vibrate([280, 120, 280, 120, 280]);`,
      );
    }

    // Ao confirmar o Pix, a própria mudança para motorista_a_caminho abre a
    // navegação existente. A fala usa o endereço real do embarque.
    next = next.replace(
      '        void speak("Pagamento confirmado. Siga até o ponto de embarque.", { interrupt: true });',
      `        const pickupVoice = String((active as any).pickup_short_label || (active as any).pickup_label || active.origin_name || "").trim();\n        void speak(\n          pickupVoice\n            ? \`Pagamento efetuado. Siga até o embarque em \${pickupVoice}.\`\n            : "Pagamento efetuado. Siga até o embarque.",\n          { interrupt: true },\n        );`,
    );

    // Se o hardener de UI ainda estiver diante da frase fonte original, cobre-a também.
    next = next.replace(
      '        void speak("Corrida aceita. Siga até o ponto de embarque.", { interrupt: true });',
      `        const pickupVoice = String((active as any).pickup_short_label || (active as any).pickup_label || active.origin_name || "").trim();\n        void speak(\n          pickupVoice\n            ? \`Pagamento efetuado. Siga até o embarque em \${pickupVoice}.\`\n            : "Pagamento efetuado. Siga até o embarque.",\n          { interrupt: true },\n        );`,
    );

    // Fala a primeira orientação assim que a rota fica pronta, sem esperar o
    // motorista chegar a 220 m da primeira manobra. Depois tickNavigation assume.
    if (!next.includes(':route-ready`')) {
      next = next.replace(
        `        setRouteSteps(\n          (res.steps ?? []).map((s: DriverRouteStep) => ({\n            lat: s.lat, lng: s.lng,\n            distanceMeters: s.distanceMeters,\n            instruction: s.instruction,\n            maneuver: s.maneuver ?? undefined,\n          })),\n        );\n        resetSpokenCache();`,
        `        const nextSteps = (res.steps ?? []).map((s: DriverRouteStep) => ({\n          lat: s.lat, lng: s.lng,\n          distanceMeters: s.distanceMeters,\n          instruction: s.instruction,\n          maneuver: s.maneuver ?? undefined,\n        }));\n        setRouteSteps(nextSteps);\n        resetSpokenCache();\n        const firstInstruction = String(nextSteps[0]?.instruction ?? "").replace(/<[^>]+>/g, " ").replace(/\\s+/g, " ").trim();\n        if (firstInstruction && (active.status === "motorista_a_caminho" || active.status === "em_viagem")) {\n          void speak(firstInstruction, { dedupKey: \`\${active.id}:\${active.status}:route-ready\` });\n        }`,
      );
    }

    // Chegada só é anunciada como confirmada DEPOIS de o backend aceitar a ação.
    next = next.replace(
      `            // Fala sincronamente dentro do gesto do clique — alguns navegadores\n            // móveis bloqueiam SpeechSynthesis.speak depois de um await.\n            resetSpokenCache();\n            void speak("Você chegou ao ponto de embarque. Aguarde o passageiro.", { interrupt: true });\n            await callArrive({ data: { rideId: active.id } });\n            setActive((prev) => (prev && prev.id === active.id ? { ...prev, status: "motorista_chegou" } : prev));`,
      `            await callArrive({ data: { rideId: active.id } });\n            setActive((prev) => (prev && prev.id === active.id ? { ...prev, status: "motorista_chegou" } : prev));\n            resetSpokenCache();\n            void speak("Chegada informada. Aguarde o passageiro e solicite o PIN para iniciar a corrida.", { interrupt: true });`,
    );

    // O segundo caminho de chegada (painel expandido) recebe o mesmo contrato.
    next = next.replace(
      '            onArrive={async () => { await callArrive({ data: { rideId: active.id } }); }}',
      '            onArrive={async () => { await callArrive({ data: { rideId: active.id } }); resetSpokenCache(); void speak("Chegada informada. Aguarde o passageiro e solicite o PIN para iniciar a corrida.", { interrupt: true }); }}',
    );

    // Ao iniciar, informa destino e deixa o turn-by-turn assumir logo em seguida.
    next = next.replace(
      '        void speak("Viagem iniciada. Boa viagem.", { interrupt: true });',
      `        const destinationVoice = String(active.destination_name || "destino").trim();\n        void speak(\`Corrida iniciada. Siga a rota até \${destinationVoice}.\`, { interrupt: true });`,
    );

    // Chegando ao destino, a voz explica claramente a próxima ação.
    next = next.replace(
      '        void speak("Você chegou ao destino final.", { dedupKey: `${active.id}:destination-arrival` });',
      '        void speak("Você chegou ao destino final. Quando o passageiro desembarcar, toque em finalizar corrida.", { dedupKey: `${active.id}:destination-arrival` });',
    );

    // Finalização precisa falar mesmo se o Realtime limpar active imediatamente.
    next = next.replaceAll(
      `            await callComplete({ data: {\n              rideId: active.id,\n              final_price: active.estimated_price ? Number(active.estimated_price) : undefined,\n            } });`,
      `            await callComplete({ data: {\n              rideId: active.id,\n              final_price: active.estimated_price ? Number(active.estimated_price) : undefined,\n            } });\n            resetSpokenCache();\n            void speak("Corrida finalizada.", { interrupt: true });`,
    );

    const required = [
      'Nova corrida. Embarque em',
      ':new-offer',
      'Pagamento efetuado. Siga até o embarque',
      ':route-ready',
      'Chegada informada. Aguarde o passageiro e solicite o PIN',
      'Corrida iniciada. Siga a rota até',
      'toque em finalizar corrida',
      'tickNavigation',
    ];
    for (const marker of required) {
      if (!next.includes(marker)) throw new Error(`motorista.app.tsx sem contrato de voz/navegação: ${marker}`);
    }

    return next;
  },
  (source) =>
    source.includes('Nova corrida. Embarque em') &&
    source.includes('Pagamento efetuado. Siga até o embarque') &&
    source.includes('Chegada informada. Aguarde o passageiro e solicite o PIN') &&
    source.includes('Corrida iniciada. Siga a rota até') &&
    source.includes('toque em finalizar corrida'),
  'motorista: voz cobre oferta, Pix, rota, chegada, início e fim',
);

// No APK Motorista separado, fortalece o TTS nativo já existente na cópia .work.
patch(
  'android-motorista/app/src/main/java/com/apois/motorista/DriverVoicePlugin.java',
  (source) => source.replaceAll('900L', '2200L'),
  (source) => source.includes('@CapacitorPlugin(name = "DriverVoice")') && source.includes('2200L'),
  'motorista: TTS nativo aguarda inicialização com margem segura',
);

console.log(`[OK] fluxo de voz e navegação do Motorista reforçado em ${workspace}`);
