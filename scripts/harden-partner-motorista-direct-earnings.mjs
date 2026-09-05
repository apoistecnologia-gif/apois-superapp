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

patch('src/routes/motorista.carteira.tsx', (source) => {
  let next = source;

  // A carteira é uma superfície legada. O redirect não depende de useNavigate,
  // useEffect ou Loader2 porque hardeners anteriores podem remover imports que
  // ficaram sem uso antes desta etapa. A rota Hash é relativa ao módulo Motorista
  // já hospedado dentro do shell Parceiro e não encerra a sessão.
  if (!next.includes('function PartnerDirectEarningsRedirect()')) {
    const routeMarker = 'export const Route = createFileRoute("/motorista/carteira")({';
    if (!next.includes(routeMarker)) {
      throw new Error('[FAIL] motorista.carteira.tsx: rota /motorista/carteira não encontrada');
    }

    const redirect = `function PartnerDirectEarningsRedirect() {\n  if (typeof window !== \"undefined\" && window.location.hash !== \"#/motorista/ganhos\") {\n    window.location.hash = \"#/motorista/ganhos\";\n  }\n  return (\n    <div className=\"flex min-h-[100dvh] items-center justify-center bg-[#050607] px-4 text-white\" role=\"status\" aria-live=\"polite\">\n      <div className=\"max-w-sm text-center\">\n        <div className=\"mx-auto h-7 w-7 animate-spin rounded-full border-2 border-[#F6BE1C]/25 border-t-[#F6BE1C] motion-reduce:animate-none\" aria-hidden=\"true\" />\n        <p className=\"mt-3 text-sm font-black\">Abrindo seus ganhos...</p>\n        <p className=\"mt-1 text-xs font-medium leading-5 text-zinc-500\">No APOIS Parceiro, os recebimentos da corrida são diretos ao motorista. A carteira antiga não é usada para retiradas manuais.</p>\n      </div>\n    </div>\n  );\n}\n\n`;
    next = next.replace(routeMarker, redirect + routeMarker);
  }

  const routeStart = next.indexOf('export const Route = createFileRoute("/motorista/carteira")({');
  if (routeStart < 0) throw new Error('[FAIL] motorista.carteira.tsx: rota legada não encontrada após hardening');
  const routeEnd = next.indexOf('});', routeStart);
  if (routeEnd < 0) throw new Error('[FAIL] motorista.carteira.tsx: configuração da rota legada incompleta');
  const routeBlock = next.slice(routeStart, routeEnd + 3);
  const componentMatch = routeBlock.match(/component:\s*[A-Za-z_$][\w$]*\s*,/);
  if (!componentMatch) {
    throw new Error('[FAIL] motorista.carteira.tsx: componente da rota legada não encontrado');
  }
  if (componentMatch[0] !== 'component: PartnerDirectEarningsRedirect,') {
    const hardenedRouteBlock = routeBlock.replace(componentMatch[0], 'component: PartnerDirectEarningsRedirect,');
    next = next.slice(0, routeStart) + hardenedRouteBlock + next.slice(routeEnd + 3);
  }

  next = next.replaceAll('Solicitar saque', 'Fluxo legado indisponível');
  next = next.replaceAll('Saque Pix', 'Repasse legado');
  next = next.replaceAll('Estorno de saque', 'Estorno de repasse legado');

  const finalRouteStart = next.indexOf('export const Route = createFileRoute("/motorista/carteira")({');
  const finalRouteEnd = next.indexOf('});', finalRouteStart);
  const finalRouteBlock = next.slice(finalRouteStart, finalRouteEnd + 3);
  if (!finalRouteBlock.includes('component: PartnerDirectEarningsRedirect,')) {
    throw new Error('[FAIL] motorista.carteira.tsx: rota legada não aponta para Ganhos');
  }
  if (!next.includes('window.location.hash = "#/motorista/ganhos"')) {
    throw new Error('[FAIL] motorista.carteira.tsx: destino Ganhos ausente');
  }
  return next;
}, 'motorista: carteira legada redirecionada para ganhos diretos');

patch('src/routes/motorista.ganhos.tsx', (source) => {
  let next = source;

  next = next.replaceAll('Carteira e corridas', 'Corridas e recebimentos');
  next = next.replaceAll('Saldo disponível', 'Ganhos registrados');
  next = next.replaceAll('Carteira APOIS', 'Crédito registrado');
  next = next.replaceAll('Solicitar saque', 'Fluxo legado indisponível');
  next = next.replaceAll(
    'As transferências ainda estão em homologação. Nenhum valor será reservado enquanto o saque não estiver liberado.',
    'Os recebimentos das corridas são diretos ao motorista. A APOIS não disponibiliza retirada manual desta tela.',
  );

  // Neutralização funcional, independente da forma do JSX. Tanto a condição
  // visual quanto qualquer guarda no handler deixam de consultar payoutEnabled.
  // Isso evita depender de "? (", "&& (" ou de espaços produzidos por outros hardeners.
  next = next.replace(/dashboard\?\.payoutEnabled/g, 'false');
  next = next.replace(/dashboard\.payoutEnabled/g, 'false');
  next = next.replace(
    'if (!false || withdrawing) return;',
    'if (!dashboard || !false || withdrawing) return;',
  );

  // O ramo visual de saque fica deliberadamente inacessível, mas o TypeScript
  // ainda analisa callbacks internos e não preserva o narrowing do ternário.
  // Limitar a asserção ao ramo morto evita contaminar a UI financeira ativa.
  const legacyBranchStart = next.indexOf('{false ? (');
  const legacyBranchEnd = legacyBranchStart >= 0 ? next.indexOf(') : (', legacyBranchStart) : -1;
  if (legacyBranchStart >= 0 && legacyBranchEnd > legacyBranchStart) {
    const legacyBranch = next.slice(legacyBranchStart, legacyBranchEnd).replaceAll('dashboard.', 'dashboard!.');
    next = next.slice(0, legacyBranchStart) + legacyBranch + next.slice(legacyBranchEnd);
  }

  if (!next.includes('Recebimento direto ao motorista')) {
    const mainMatch = next.match(/<main\b[^>]*>/);
    if (!mainMatch || mainMatch.index == null) {
      throw new Error('[FAIL] motorista.ganhos.tsx: <main> não encontrado para inserir aviso de recebimento direto');
    }
    const insertAt = mainMatch.index + mainMatch[0].length;
    const notice = `\n        <section className="min-w-0 rounded-2xl border border-[#F6BE1C]/15 bg-[#111315] p-4" aria-label="Recebimento direto ao motorista">\n          <p className="text-[11px] font-black uppercase tracking-[0.12em] text-[#F6BE1C]">Recebimento direto ao motorista</p>\n          <p className="mt-1 text-xs font-medium leading-5 text-zinc-400">Dinheiro e cartão são recebidos diretamente pelo motorista. Pagamentos digitais seguem o fluxo direto homologado, sem saldo custodial da APOIS.</p>\n        </section>`;
    next = next.slice(0, insertAt) + notice + next.slice(insertAt);
  }

  if (!next.includes('Recebimento direto ao motorista')) {
    throw new Error('[FAIL] motorista.ganhos.tsx: aviso de recebimento direto não foi aplicado');
  }
  if (/dashboard\??\.payoutEnabled/.test(next)) {
    throw new Error('[FAIL] motorista.ganhos.tsx: payoutEnabled legado ainda controla retirada');
  }
  if (next.includes('Solicitar saque')) {
    throw new Error('[FAIL] motorista.ganhos.tsx: rótulo legado Solicitar saque permaneceu');
  }
  if (!next.includes('sem saldo custodial da APOIS')) {
    throw new Error('[FAIL] motorista.ganhos.tsx: política de recebimento direto não ficou explícita');
  }
  return next;
}, 'motorista: ganhos exibem recebimento direto e ocultam retirada legada');

console.log(`[OK] hardening financeiro direto do Motorista concluído em ${workspace}`);
