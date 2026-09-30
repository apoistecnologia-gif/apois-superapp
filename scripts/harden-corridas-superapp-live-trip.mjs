import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();

function patch(relativePath, transform, verify, label) {
  const path = resolve(root, relativePath);
  const before = readFileSync(path, 'utf8');
  if (verify(before)) {
    console.log(`[OK] ${label} (já aplicado)`);
    return;
  }
  const after = transform(before);
  if (after === before || !verify(after)) {
    throw new Error(`[FAIL] ${label}: resultado esperado não encontrado em ${relativePath}`);
  }
  writeFileSync(path, after, 'utf8');
  console.log(`[OK] ${label}`);
}

patch(
  '.work/corridas/src/services/rides/active-ride-service.ts',
  (source) => source
    .replace(
      'if (!["motorista_a_caminho", "motorista_chegou"].includes(ride.status)) return ride;',
      'if (ride.status !== "motorista_chegou") return { ...ride, security_code: undefined };',
    )
    .replace(
      'if (!["motorista_a_caminho", "motorista_chegou"].includes(ride.status)) return { ...ride, security_code: null };',
      'if (ride.status !== "motorista_chegou") return { ...ride, security_code: undefined };',
    ),
  (source) => source.includes('if (ride.status !== "motorista_chegou")'),
  'passageiro: PIN só é consultado depois que o motorista confirma chegada',
);

patch(
  '.work/corridas/src/routes/_authenticated.corrida.$rideId.tsx',
  (source) => {
    let next = source;
    const currentRuntime = `                {["motorista_a_caminho", "motorista_chegou"].includes(status) && (
                  <SecurityCodeCard code={ride.security_code} />
                )}`;
    const originalSnapshot = `                {status === "motorista_a_caminho" && (
                  <SecurityCodeCard code={ride.security_code} />
                )}`;
    const desired = `                {status === "motorista_chegou" && (
                  <SecurityCodeCard code={ride.security_code} />
                )}`;

    if (next.includes(desired)) return next;
    if (next.includes(currentRuntime)) return next.replace(currentRuntime, desired);
    if (next.includes(originalSnapshot)) return next.replace(originalSnapshot, desired);

    throw new Error('[FAIL] passageiro: bloco SecurityCodeCard da corrida ativa não encontrado');
  },
  (source) => source.includes(`{status === "motorista_chegou" && (
                  <SecurityCodeCard code={ride.security_code} />
                )}`),
  'passageiro: cartão do PIN aparece somente quando motorista chegou',
);

patch(
  '.work/corridas/src/components/rides/active/SecurityCodeCard.tsx',
  (source) => source
    .replace('PIN de Segurança', 'PIN DE EMBARQUE')
    .replace(
      'Informe este código ao motorista para{" "}\n        <span className="text-white font-bold">iniciar a viagem com segurança.</span>',
      'Informe este PIN ao motorista somente depois de conferir o veículo.{" "}\n        <span className="text-white font-bold">Ele é necessário para iniciar a viagem.</span>',
    ),
  (source) => source.includes('PIN DE EMBARQUE') && source.includes('somente depois de conferir o veículo'),
  'passageiro: PIN de embarque fica destacado e com orientação correta',
);

console.log('[OK] fluxo vivo Corridas: PIN pós-chegada alinhado ao snapshot atual.');
