import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
const workspace = process.env.APOIS_CORRIDAS_WORKSPACE || '.work/corridas';
const servicePath = resolve(root, workspace, 'src/services/payments/payment-service.ts');
let service = readFileSync(servicePath, 'utf8');

if (!service.includes('const isDirectToDriver = code === "cash" || code === "credit";')) {
  service = service.replace(
    '      const isActive = method.is_active === true;\n      return [',
    '      const isActive = method.is_active === true;\n      const isDirectToDriver = code === "cash" || code === "credit";\n      const providerReady = code !== "debit";\n      const enabled = isActive && providerReady;\n      const description = code === "cash"\n        ? "Pague diretamente ao motorista ao final da corrida."\n        : code === "credit"\n          ? "Pague diretamente ao motorista com cartão de crédito."\n          : code === "debit"\n            ? "Indisponível até a homologação deste meio de pagamento."\n            : method.description;\n      return [',
  );
  service = service.replace(
    '          description: method.description,\n          icon: method.icon,\n          isActive,\n          enabled: isActive,',
    '          description,\n          icon: method.icon,\n          isActive,\n          enabled,',
  );
}

for (const marker of [
  'const isDirectToDriver = code === "cash" || code === "credit";',
  'const providerReady = code !== "debit";',
  'Pague diretamente ao motorista ao final da corrida.',
  'Pague diretamente ao motorista com cartão de crédito.',
  'Indisponível até a homologação deste meio de pagamento.',
  'enabled,',
]) {
  if (!service.includes(marker)) throw new Error(`Corridas Superapp: política de pagamento incompleta (${marker}).`);
}
writeFileSync(servicePath, service, 'utf8');

const hookPath = resolve(root, workspace, 'src/hooks/use-payment-methods.tsx');
const hook = readFileSync(hookPath, 'utf8');
if (hook.includes('method.code === "pix"')) {
  throw new Error('Corridas Superapp: hook voltou a restringir formas de pagamento somente a PIX.');
}

const selectorPath = resolve(root, workspace, 'src/components/payments/PaymentMethodSelector.tsx');
const selector = readFileSync(selectorPath, 'utf8');
if (!selector.includes('method.description')) {
  throw new Error('Corridas Superapp: seletor não exibe descrição da forma de pagamento.');
}

console.log('[OK] Corridas Superapp: PIX permanece digital; Dinheiro/Crédito ficam diretos ao motorista e Débito segue bloqueado até homologação.');
