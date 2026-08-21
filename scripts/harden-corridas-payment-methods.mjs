import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
const workspace = process.env.APOIS_CORRIDAS_WORKSPACE || '.work/corridas';
const servicePath = resolve(root, workspace, 'src/services/payments/payment-service.ts');
let service = readFileSync(servicePath, 'utf8');

// Cartão de crédito da corrida é pagamento externo/direto ao motorista (maquininha
// ou meio aceito pelo próprio motorista). Portanto não depende da homologação do
// provedor eletrônico da APOIS. Apenas PIX passa pelo fluxo Mercado Pago.
service = service.replace(
  'const NOT_YET_HOMOLOGATED_METHODS = new Set<PaymentMethodCode>(["credit", "debit"]);',
  'const NOT_YET_HOMOLOGATED_METHODS = new Set<PaymentMethodCode>(["debit"]);',
);

const oldProviderReady = `      const providerReady = isElectronicPending
        ? false
        : isElectronicHomologated
          ? electronicEnabled
          : true;`;
const newProviderReady = `      const isDirectToDriver = code === "cash" || code === "credit";
      const providerReady = isDirectToDriver
        ? true
        : isElectronicPending
          ? false
          : isElectronicHomologated
            ? electronicEnabled
            : true;`;
if (service.includes(oldProviderReady)) service = service.replace(oldProviderReady, newProviderReady);

const oldDescription = `          description:
            isElectronicPending
              ? "Indisponível até a homologação da integração de cartão."
              : isElectronicHomologated && !providerReady
                ? "Indisponível até a confirmação do provedor Pix da corrida."
                : method.description,`;
const newDescription = `          description:
            code === "cash"
              ? "Pague diretamente ao motorista ao final da corrida."
              : code === "credit"
                ? "Pague diretamente ao motorista com cartão de crédito."
                : isElectronicPending
                  ? "Indisponível até a homologação deste meio de pagamento."
                  : isElectronicHomologated && !providerReady
                    ? "Indisponível até a confirmação do provedor Pix da corrida."
                    : method.description,`;
if (service.includes(oldDescription)) service = service.replace(oldDescription, newDescription);

for (const marker of [
  'new Set<PaymentMethodCode>(["debit"])',
  'const isDirectToDriver = code === "cash" || code === "credit";',
  'Pague diretamente ao motorista ao final da corrida.',
  'Pague diretamente ao motorista com cartão de crédito.',
]) {
  if (!service.includes(marker)) throw new Error(`Corridas Superapp: política de pagamento direto incompleta (${marker}).`);
}
if (service.includes('new Set<PaymentMethodCode>(["credit", "debit"])')) {
  throw new Error('Corridas Superapp: cartão de crédito ainda está bloqueado como integração não homologada.');
}
writeFileSync(servicePath, service, 'utf8');

const selectorPath = resolve(root, workspace, 'src/components/payments/PaymentMethodSelector.tsx');
let selector = readFileSync(selectorPath, 'utf8');
if (!selector.includes('method.description')) {
  throw new Error('Corridas Superapp: seletor não exibe descrição da forma de pagamento.');
}
writeFileSync(selectorPath, selector, 'utf8');

console.log('[OK] Corridas Superapp: PIX permanece digital; Dinheiro e Cartão de crédito ficam disponíveis para pagamento direto ao motorista.');
