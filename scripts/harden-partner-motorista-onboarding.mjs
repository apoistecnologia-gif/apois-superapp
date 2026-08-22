import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
const workspace = process.env.APOIS_MOTORISTA_WORKSPACE || '.work/partner-motorista';

function patch(relativePath, transform, label) {
  const path = resolve(root, workspace, relativePath);
  const before = readFileSync(path, 'utf8');
  const after = transform(before);
  if (after === before) {
    console.log(`[OK] ${label} (já aplicado/sem alteração)`);
    return;
  }
  writeFileSync(path, after, 'utf8');
  console.log(`[OK] ${label}`);
}

patch('src/routes/motorista.cadastro.tsx', (source) => {
  let next = source;

  next = next.replace(
    '    if (step === 1) {\n      navigate({ to: "/motorista/login" });\n      return;\n    }',
    '    if (step === 1) {\n      window.location.replace("../../index.html");\n      return;\n    }',
  );

  next = next.replace(
    '<button type="button" onClick={() => navigate({ to: "/motorista/login", replace: true })} className="flex min-h-12 w-full items-center justify-center rounded-[18px] border border-[#F6BE1C]/25 bg-transparent px-4 py-2 text-center text-[11px] font-black uppercase tracking-[0.12em] text-[#F6BE1C]">Sair</button>',
    '<button type="button" onClick={() => window.location.replace("../../index.html")} className="flex min-h-12 w-full items-center justify-center rounded-[18px] border border-[#F6BE1C]/25 bg-transparent px-4 py-2 text-center text-[11px] font-black uppercase tracking-[0.12em] text-[#F6BE1C]">Trocar perfil de parceiro</button>',
  );

  for (const marker of [
    'window.location.replace("../../index.html")',
    'Trocar perfil de parceiro',
    'navigate({ to: "/motorista/status", replace: true })',
  ]) {
    if (!next.includes(marker)) throw new Error(`Motorista Parceiro: onboarding incompleto (${marker}).`);
  }

  const previousStepStart = next.indexOf('function previousStep()');
  const previousStepEnd = previousStepStart >= 0 ? next.indexOf('\n  async function onSubmit', previousStepStart) : -1;
  if (previousStepStart < 0 || previousStepEnd < 0) throw new Error('Motorista Parceiro: bloco previousStep não encontrado.');
  const previousStepBlock = next.slice(previousStepStart, previousStepEnd);
  if (previousStepBlock.includes('navigate({ to: "/motorista/login"')) {
    throw new Error('Motorista Parceiro: voltar da primeira etapa ainda envia ao login em vez do seletor.');
  }

  return next;
}, 'motorista: cadastro/sucesso retornam ao seletor sem encerrar sessão');

patch('src/routes/motorista.status.tsx', (source) => {
  let next = source;
  next = next.replace(
    '                if (window.history.length > 1) window.history.back();\n                else void navigate({ to: "/motorista/login" });',
    '                if (window.history.length > 1) window.history.back();\n                else window.location.replace("../../index.html");',
  );

  if (!next.includes('window.location.replace("../../index.html")')) {
    throw new Error('Motorista Parceiro: status não possui fallback para o seletor Parceiro.');
  }
  // switchAccount é intencionalmente mantido: troca de conta deve realmente encerrar a sessão.
  if (!next.includes('async function switchAccount()') || !next.includes('await supabase.auth.signOut();')) {
    throw new Error('Motorista Parceiro: troca explícita de conta perdeu o signOut obrigatório.');
  }
  return next;
}, 'motorista: status volta ao seletor sem confundir retorno com troca de conta');

console.log('[OK] Motorista Parceiro: onboarding, sucesso e status preservam sessão ao trocar entre Motorista/Entregador; troca explícita de conta continua encerrando a sessão.');
