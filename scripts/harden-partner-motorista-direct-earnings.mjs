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

  // A rota de carteira é somente uma superfície legada no APOIS Parceiro. Não
  // dependemos mais do nome histórico DriverWalletPage, porque hardeners/fontes
  // anteriores podem renomear o componente sem alterar a rota. A autoridade é
  // createFileRoute('/motorista/carteira') e o componente final deve sempre ser
  // o redirect seguro para Ganhos.
  if (!next.includes('function PartnerDirectEarningsRedirect()')) {
    const routeMarker = 'export const Route = createFileRoute("/motorista/carteira")({';
    if (!next.includes(routeMarker)) {
      throw new Error('[FAIL] motorista.carteira.tsx: rota /motorista/carteira não encontrada');
    }

    if (!next.includes('useNavigate')) {
      next = next.replace(
        'from "@tanstack/react-router";',
        'from "@tanstack/react-router";',
      );
      throw new Error('[FAIL] motorista.carteira.tsx: useNavigate ausente; fonte incompatível com redirect seguro');
    }
    if (!next.includes('useEffect')) {
      throw new Error('[FAIL] motorista.carteira.tsx: useEffect ausente; fonte incompatível com redirect seguro');
    }
    if (!next.includes('Loader2')) {
      throw new Error('[FAIL] motorista.carteira.tsx: Loader2 ausente; fonte incompatível com redirect seguro');
    }

    const redirect = `function PartnerDirectEarningsRedirect() {\n  const navigate = useNavigate();\n  useEffect(() => {\n    void navigate({ to: "/motorista/ganhos", replace: true });\n  }, [navigate]);\n  return (\n    <div className="flex min-h-[100dvh] items-center justify-center bg-[#050607] px-4 text-white" role="status" aria-live="polite">\n      <div className="max-w-sm text-center">\n        <Loader2 className="mx-auto h-7 w-7 animate-spin text-[#F6BE1C] motion-reduce:animate-none" aria-hidden="true" />\n        <p className="mt-3 text-sm font-black">Abrindo seus ganhos...</p>\n        <p className="mt-1 text-xs font-medium leading-5 text-zinc-500">No APOIS Parceiro, os recebimentos da corrida são diretos ao motorista. A carteira antiga não é usada para retiradas manuais.</p>\n      </div>\n    </div>\n  );\n}\n\n`;
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
  if (!next.includes('to: "/motorista/ganhos"')) {
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
  next = next.replace('dashboard.payoutEnabled ? (', 'false ? (');
  next = next.replace(
    'As transferências ainda estão em homologação. Nenhum valor será reservado enquanto o saque não estiver liberado.',
    'Os recebimentos das corridas são diretos ao motorista. A APOIS não disponibiliza retirada manual desta tela.',
  );

  const sectionMarker = '<section className="min-w-0 rounded-[28px] border border-[#F6BE1C]/20 bg-gradient-to-br from-[#2A2108] via-[#121416] to-[#090A0B] p-4 sm:p-5" aria-label="Saldo da carteira">';
  if (next.includes(sectionMarker) && !next.includes('Recebimento direto ao motorista')) {
    next = next.replace(
      sectionMarker,
      `${sectionMarker}\n              <div className="mb-4 rounded-2xl border border-[#F6BE1C]/15 bg-black/25 px-3 py-3">\n                <p className="text-[11px] font-black uppercase tracking-[0.12em] text-[#F6BE1C]">Recebimento direto ao motorista</p>\n                <p className="mt-1 text-xs font-medium leading-5 text-zinc-400">Dinheiro e cartão são recebidos diretamente pelo motorista. Pagamentos digitais seguem o fluxo direto homologado, sem saldo custodial da APOIS.</p>\n              </div>`,
    );
  }

  if (!next.includes('Recebimento direto ao motorista')) {
    throw new Error('[FAIL] motorista.ganhos.tsx: aviso de recebimento direto não foi aplicado');
  }
  if (!next.includes('false ? (')) {
    throw new Error('[FAIL] motorista.ganhos.tsx: formulário legado de retirada não foi neutralizado');
  }
  if (next.includes('Solicitar saque')) {
    throw new Error('[FAIL] motorista.ganhos.tsx: rótulo legado Solicitar saque permaneceu');
  }
  return next;
}, 'motorista: ganhos exibem recebimento direto e ocultam retirada legada');

console.log(`[OK] hardening financeiro direto do Motorista concluído em ${workspace}`);
