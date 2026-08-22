import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
const workspace = process.env.APOIS_MOTORISTA_WORKSPACE || '.work/partner-motorista';
const path = resolve(root, workspace, 'src/routes/motorista.app.tsx');
let source = readFileSync(path, 'utf8');

// A avaliação é uma etapa pós-corrida, não pode funcionar como barreira para a
// próxima corrida já reservada. Fechar o modal também limpa ratingRef de forma
// síncrona; depois um evento interno força resync sem depender de Realtime.
const dismissBefore = `  function dismissRating() {\n    setRatingRide(null);\n    setRatingSubmitted(false);\n    setRatingError(null);\n    setRatingComment(\"\");\n    setStars(5);\n  }`;
const dismissAfter = `  function dismissRating() {\n    ratingRef.current = null;\n    setRatingRide(null);\n    setRatingSubmitted(false);\n    setRatingError(null);\n    setRatingComment(\"\");\n    setStars(5);\n    window.setTimeout(() => {\n      window.dispatchEvent(new CustomEvent(\"apois:driver-push\", { detail: { event: \"rating.closed\" } }));\n    }, 0);\n  }`;
if (source.includes(dismissBefore)) source = source.replace(dismissBefore, dismissAfter);

// Homologação com a mesma conta: não persiste autoavaliação, mas deve fechar a
// etapa normalmente e liberar a próxima corrida em vez de deixar uma tela de
// sucesso intermediária prendendo o motorista.
source = source.replace(
  `      ratedRidesRef.current.add(ratingRide.id);\n      setRatingError(null);\n      setRatingSubmitted(true);\n      toast.info(\"Avaliação de teste concluída\", {`,
  `      ratedRidesRef.current.add(ratingRide.id);\n      setRatingError(null);\n      toast.info(\"Avaliação de teste concluída\", {`,
);
source = source.replace(
  `        duration: 5500,\n      });\n      return;`,
  `        duration: 5500,\n      });\n      dismissRating();\n      return;`,
);

// Se a corrida já consta como avaliada localmente, simplesmente encerra a tela
// e ressincroniza. Não cria um segundo estado de "submitted" esperando clique.
source = source.replace(
  `    if (ratedRidesRef.current.has(ratingRide.id)) {\n      setRatingSubmitted(true);\n      return;\n    }`,
  `    if (ratedRidesRef.current.has(ratingRide.id)) {\n      dismissRating();\n      return;\n    }`,
);

// Sucesso real: grava a proteção contra duplicidade e fecha imediatamente. Em
// caso de erro, o modal continua aberto com Tentar novamente + Pular avaliação.
source = source.replace(
  `      await callRate({ data: { rideId: ratingRide.id, stars, comment: ratingComment || null } });\n      ratedRidesRef.current.add(ratingRide.id);\n      setRatingSubmitted(true);`,
  `      const ratedRideId = ratingRide.id;\n      await callRate({ data: { rideId: ratedRideId, stars, comment: ratingComment || null } });\n      ratedRidesRef.current.add(ratedRideId);\n      dismissRating();`,
);

for (const marker of [
  'ratingRef.current = null;',
  'event: "rating.closed"',
  'const ratedRideId = ratingRide.id;',
  'ratedRidesRef.current.add(ratedRideId);',
  'dismissRating();',
  'Tentar novamente',
  'Pular avaliação',
]) {
  if (!source.includes(marker)) throw new Error(`[FAIL] Motorista Parceiro: handoff da avaliação incompleto (${marker}).`);
}

// A avaliação não deve voltar a exigir uma confirmação adicional após sucesso.
if (source.includes('ratedRidesRef.current.add(ratingRide.id);\n      setRatingSubmitted(true);')) {
  throw new Error('[FAIL] Motorista Parceiro: avaliação ainda mantém tela intermediária após sucesso.');
}

writeFileSync(path, source, 'utf8');
console.log('[OK] Motorista Parceiro: avaliação fecha no sucesso/auto-homologação, erro permite retry/skip e próxima corrida é ressincronizada.');
