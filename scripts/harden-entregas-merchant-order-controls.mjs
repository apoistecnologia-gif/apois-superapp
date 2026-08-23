import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const path = resolve('.work/entregas/src/components/MerchantOrderControlCenter.tsx');
let source = readFileSync(path, 'utf8');

// O atalho amarelo fixo "SOLICITAR ENTREGADOR · PEDIDO #..." cobria qualquer
// tela do painel (Financeiro, Configurações etc.). A solicitação continua existindo
// dentro da Central de pedidos, junto do pedido correto, mas nunca como CTA global.
const readyMemoPattern = /\n  const readyDeliveryOrder = useMemo\([\s\S]*?\n  \);\n\n  const transition/;
if (readyMemoPattern.test(source)) {
  source = source.replace(readyMemoPattern, '\n\n  const transition');
}

const floatingCourierPattern = /\n\s*\{readyDeliveryOrder\s*\?\s*\([\s\S]*?SOLICITAR ENTREGADOR[\s\S]*?<\/Button>\s*\)\s*:\s*null\}\s*/;
if (floatingCourierPattern.test(source)) {
  source = source.replace(floatingCourierPattern, '\n');
}

if (source.includes('SOLICITAR ENTREGADOR')) {
  throw new Error('[FAIL] Entregas: CTA global SOLICITAR ENTREGADOR ainda permanece no painel.');
}
if (source.includes('readyDeliveryOrder')) {
  console.error('[DEBUG] readyMemoPattern.test:', readyMemoPattern.test(source));
  console.error('[DEBUG] floatingCourierPattern.test:', floatingCourierPattern.test(source));
  const allLines = source.split('\n');
  const matchedLineNumbers = [];
  console.error('[DEBUG] todas as linhas com readyDeliveryOrder:');
  allLines.forEach((line, index) => {
    if (line.includes('readyDeliveryOrder')) {
      matchedLineNumbers.push(index + 1);
      console.error(`[DEBUG] linha ${index + 1}: ${line.trim()}`);
    }
  });
  const firstLine = matchedLineNumbers[0] ?? 1;
  const windowStart = Math.max(0, firstLine - 10);
  const windowEnd = Math.min(allLines.length, firstLine + 40);
  console.error(`[DEBUG] bloco completo (linhas ${windowStart + 1}-${windowEnd}):`);
  console.error(
    allLines
      .slice(windowStart, windowEnd)
      .map((line, i) => `${windowStart + i + 1}: ${line}`)
      .join('\n'),
  );
  throw new Error('[FAIL] Entregas: estado do atalho global de entregador ainda permanece.');
}
if (!source.includes('void requestCourier(order.id)')) {
  throw new Error('[FAIL] Entregas: ação de solicitar entregador dentro do pedido foi removida indevidamente.');
}
if (!source.includes('Central de pedidos')) {
  throw new Error('[FAIL] Entregas: Central de pedidos não encontrada após ajuste.');
}

writeFileSync(path, source, 'utf8');
console.log('[OK] Entregas: solicitar entregador fica somente dentro da Central de pedidos; CTA amarelo global removido.');
