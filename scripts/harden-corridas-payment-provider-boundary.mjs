import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
const workspace = process.env.APOIS_CORRIDAS_WORKSPACE || '.work/corridas';
const servicePath = resolve(root, workspace, 'src/services/payments/payment-service.ts');
let service = readFileSync(servicePath, 'utf8');

const oldBlock = `      const isActive = method.is_active === true;\n      return [\n        {\n          id: method.id,\n          code,\n          name: method.name,\n          label: method.name,\n          description: method.description,\n          icon: method.icon,\n          isActive,\n          enabled: isActive,\n          sortOrder: method.sort_order ?? 0,\n          requiresBalance: method.requires_balance === true,\n        } satisfies PaymentMethod,\n      ];`;

const directBlock = `      const isActive = method.is_active === true;\n      const isDirectToDriver = code === "cash" || code === "credit";\n      if (!isActive || !isDirectToDriver) return [];\n      const description =\n        code === "cash"\n          ? "Pague diretamente ao motorista em dinheiro ao final da corrida."\n          : "Pague diretamente ao motorista no cartão de crédito, usando o meio aceito pelo próprio motorista.";\n      return [\n        {\n          id: method.id,\n          code,\n          name: method.name,\n          label: method.name,\n          description,\n          icon: method.icon,\n          isActive: true,\n          enabled: true,\n          sortOrder: method.sort_order ?? 0,\n          requiresBalance: false,\n        } satisfies PaymentMethod,\n      ];`;

if (!service.includes(directBlock)) {
  if (!service.includes(oldBlock)) {
    // Compatibilidade com a versão anterior do hardener: substitua o bloco
    // já expandido, mas nunca mantenha PIX/débito/wallet ativos.
    const start = service.indexOf('      const isActive = method.is_active === true;');
    const endMarker = '      ];';
    const end = service.indexOf(endMarker, start);
    if (start < 0 || end < 0) {
      throw new Error('Corridas: bloco de métodos de pagamento mudou e não pôde ser endurecido.');
    }
    service = service.slice(0, start) + directBlock + service.slice(end + endMarker.length);
  } else {
    service = service.replace(oldBlock, directBlock);
  }
}

for (const marker of [
  'const isDirectToDriver = code === "cash" || code === "credit";',
  'if (!isActive || !isDirectToDriver) return [];',
  'Pague diretamente ao motorista em dinheiro ao final da corrida.',
  'Pague diretamente ao motorista no cartão de crédito',
  'requiresBalance: false',
]) {
  if (!service.includes(marker)) throw new Error(`Corridas: boundary de pagamento incompleto (${marker}).`);
}
writeFileSync(servicePath, service, 'utf8');

service = readFileSync(servicePath, 'utf8');
if (!service.includes('APOIS_DIRECT_PAYMENT_FALLBACK_V1')) {
  service = service.replace(
    '    return (data ?? []).flatMap((method) => {',
    '    // APOIS_DIRECT_PAYMENT_FALLBACK_V1\n    const directMethods = (data ?? []).flatMap((method) => {',
  );
  service = service.replace(
    '    });\n  }\n\n  async getCancellationFees',
    `    });\n\n    const fallbackMethods: PaymentMethod[] = [\n      { id: "direct-cash", code: "cash", name: "Dinheiro", label: "Dinheiro", description: "Pague diretamente ao motorista em dinheiro ao final da corrida.", icon: null, isActive: true, enabled: true, sortOrder: 10, requiresBalance: false },\n      { id: "direct-credit", code: "credit", name: "Cartão de crédito", label: "Cartão de crédito", description: "Pague diretamente ao motorista no cartão de crédito, usando o meio aceito pelo próprio motorista.", icon: null, isActive: true, enabled: true, sortOrder: 20, requiresBalance: false },\n    ];\n    for (const fallback of fallbackMethods) {\n      if (!directMethods.some((method) => method.code === fallback.code)) directMethods.push(fallback);\n    }\n    return directMethods.sort((a, b) => a.sortOrder - b.sortOrder);\n  }\n\n  async getCancellationFees`,
  );
}
for (const marker of [
  'APOIS_DIRECT_PAYMENT_FALLBACK_V1',
  'id: "direct-cash"',
  'id: "direct-credit"',
  'return directMethods.sort((a, b) => a.sortOrder - b.sortOrder);',
]) {
  if (!service.includes(marker)) throw new Error(`Corridas: fallback visual/operacional de pagamento direto incompleto (${marker}).`);
}
writeFileSync(servicePath, service, 'utf8');

const hookPath = resolve(root, workspace, 'src/hooks/use-payment-methods.tsx');
const hook = readFileSync(hookPath, 'utf8');
if (!hook.includes('paymentService.getPaymentMethods()')) {
  throw new Error('Corridas: hook de métodos deixou de delegar ao PaymentService.');
}

const selectorPath = resolve(root, workspace, 'src/components/payments/PaymentMethodSelector.tsx');
const selector = readFileSync(selectorPath, 'utf8');
if (!selector.includes('method.description')) {
  throw new Error('Corridas: seletor não exibe a descrição do pagamento direto.');
}

console.log('[OK] Corridas: somente Dinheiro/Crédito direto ao motorista permanecem ativos; nenhum PIX eletrônico é processado pela APOIS.');
