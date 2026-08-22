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

  if (!next.includes('function PartnerDirectEarningsRedirect()')) {
    const marker = 'function DriverWalletPage() {';
    if (!next.includes(marker)) throw new Error('[FAIL] motorista.carteira.tsx: DriverWalletPage não encontrado');
    const redirect = `function PartnerDirectEarningsRedirect() {\n  const navigate = useNavigate();\n  useEffect(() => {\n    void navigate({ to: "/motorista/ganhos", replace: true });\n  }, [navigate]);\n  return (\n    <div className="flex min-h-[100dvh] items-center justify-center bg-[#050607] px-4 text-white" role="status" aria-live="polite">\n      <div className="max-w-sm text-center">\n        <Loader2 className="mx-auto h-7 w-7 animate-spin text-[#F6BE1C] motion-reduce:animate-none" aria-hidden="true" />\n        <p className="mt-3 text-sm font-black">Abrindo seus ganhos...</p>\n        <p className="mt-1 text-xs font-medium leading-5 text-zinc-500">No APOIS Parceiro, os recebimentos da corrida são diretos ao motorista. A carteira antiga não é usada para retiradas manuais.</p>\n      </div>\n    </div>\n  );\n}\n\n`;
    next = next.replace(marker, redirect + marker);
  }

  next = next.replace('component: DriverWalletPage,', 'component: PartnerDirectEarningsRedirect,');
  next = next.replaceAll('Solicitar saque', 'Fluxo legado indisponível');
  next = next.replaceAll('Saque Pix', 'Repasse legado');
  next = next.replaceAll('Estorno de saque', 'Estorno de repasse legado');
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
