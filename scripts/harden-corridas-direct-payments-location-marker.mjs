import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();

function patch(path, transform, verify, label) {
  const full = resolve(root, path);
  const before = readFileSync(full, 'utf8');
  if (verify(before)) {
    console.log(`[OK] ${label} (já aplicado)`);
    return;
  }
  const after = transform(before);
  if (after === before || !verify(after)) {
    throw new Error(`[FAIL] ${label}: padrão esperado não encontrado em ${path}`);
  }
  writeFileSync(full, after, 'utf8');
  console.log(`[OK] ${label}`);
}

patch(
  '.work/corridas/src/services/payments/payment-service.ts',
  (source) => {
    const start = '    return (data ?? []).flatMap((method) => {';
    const end = '    });\n  }\n\n  async getCancellationFees';
    if (!source.includes(start) || !source.includes(end)) return source;

    const originalBodyStart = source.indexOf(start);
    const originalBodyEnd = source.indexOf(end, originalBodyStart);
    const original = source.slice(originalBodyStart, originalBodyEnd + '    });'.length);
    const providerBlock = original.replace(
      '    return (data ?? []).flatMap((method) => {',
      '    const providerMethods = (data ?? []).flatMap((method) => {',
    );

    const replacement = `${providerBlock}\n\n    // Dinheiro e cartão são pagos diretamente ao motorista. Não dependem da\n    // homologação do gateway eletrônico do aplicativo. O código \"credit\"\n    // representa cartão na maquininha do motorista (crédito ou débito).\n    const byCode = new Map<PaymentMethodCode, PaymentMethod>(\n      providerMethods\n        .filter((method) => method.code !== \"debit\")\n        .map((method) => [method.code, method]),\n    );\n\n    byCode.set(\"cash\", {\n      id: byCode.get(\"cash\")?.id ?? \"direct-cash\",\n      code: \"cash\",\n      name: \"Dinheiro\",\n      label: \"Dinheiro\",\n      description: \"Pagamento feito diretamente ao motorista ao final da corrida.\",\n      icon: byCode.get(\"cash\")?.icon ?? \"banknote\",\n      isActive: true,\n      enabled: true,\n      sortOrder: 20,\n      requiresBalance: false,\n    });\n\n    byCode.set(\"credit\", {\n      id: byCode.get(\"credit\")?.id ?? \"direct-card\",\n      code: \"credit\",\n      name: \"Cartão\",\n      label: \"Cartão\",\n      description: \"Crédito ou débito na maquininha do motorista. Pagamento direto ao motorista.\",\n      icon: byCode.get(\"credit\")?.icon ?? \"credit-card\",\n      isActive: true,\n      enabled: true,\n      sortOrder: 30,\n      requiresBalance: false,\n    });\n\n    return Array.from(byCode.values()).sort((a, b) => a.sortOrder - b.sortOrder);`;

    return source.slice(0, originalBodyStart) + replacement + source.slice(originalBodyEnd + '    });'.length);
  },
  (source) =>
    source.includes('name: "Dinheiro"') &&
    source.includes('name: "Cartão"') &&
    source.includes('direct-card') &&
    source.includes('Pagamento feito diretamente ao motorista'),
  'passageiro: Dinheiro e Cartão ficam disponíveis como pagamento direto ao motorista',
);

patch(
  '.work/corridas/src/routes/_authenticated.revisar-solicitacao.tsx',
  (source) => {
    let next = source
      .replace('  credit: "Cartão de crédito",', '  credit: "Cartão",')
      .replace('  credit_card: "Cartão de crédito",', '  credit_card: "Cartão",')
      .replace('  debit: "Cartão de débito",', '  debit: "Cartão",')
      .replace('  debit_card: "Cartão de débito",', '  debit_card: "Cartão",');

    const oldSubtitle = '<span className="mt-0.5 block text-[10px] text-zinc-500">Método selecionado para esta corrida</span>';
    const newSubtitle = '<span className="mt-0.5 block text-[10px] text-zinc-500">{selectedMethod === "cash" || selectedMethod === "credit" ? "Pagamento direto ao motorista" : "Pagamento pelo aplicativo"}</span>';
    next = next.replace(oldSubtitle, newSubtitle);
    return next;
  },
  (source) =>
    source.includes('credit: "Cartão"') &&
    source.includes('Pagamento direto ao motorista'),
  'passageiro: revisão explica quando o pagamento é direto ao motorista',
);

patch(
  '.work/corridas/src/routes/_authenticated.inicio.tsx',
  (source) => {
    const oldMarker = '<div className="pointer-events-none absolute left-1/2 top-[250px] z-20 -translate-x-1/2 rounded-full border border-apois-yellow/50 bg-black/85 px-4 py-2 text-[12px] font-black text-white shadow-xl backdrop-blur-md">Me buscar aqui</div>';
    const newMarker = '<div className="pointer-events-none absolute left-1/2 top-[228px] z-20 -translate-x-1/2" aria-hidden="true"><div className="relative flex h-[58px] w-[58px] items-center justify-center drop-shadow-[0_10px_18px_rgba(0,0,0,0.65)]"><MapPin size={58} strokeWidth={2.2} className="text-apois-yellow" fill="#080B11"/><span className="absolute left-1/2 top-[14px] -translate-x-1/2 text-[17px] font-black tracking-[-0.08em] text-apois-yellow">A</span></div><div className="mx-auto -mt-1 h-2 w-7 rounded-full bg-black/55 blur-[1px]" /></div>';
    return source.replace(oldMarker, newMarker);
  },
  (source) =>
    !source.includes('>Me buscar aqui</div>') &&
    source.includes('top-[228px]') &&
    source.includes('text-apois-yellow">A</span>'),
  'passageiro: marcador textual do centro vira pin de localização APOIS',
);

console.log('[OK] Corridas: pagamentos diretos e marcador APOIS aplicados somente em .work.');
