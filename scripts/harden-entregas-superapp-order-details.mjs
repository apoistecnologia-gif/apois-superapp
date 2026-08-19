import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const path = resolve('.work/entregas/src/routes/pedido/$orderId/index.tsx');
let source = readFileSync(path, 'utf8');

if (!source.includes('import { AppBottomNav } from "@/components/AppBottomNav";')) {
  const marker = 'import { CustomerDeliveryMap } from "@/components/CustomerDeliveryMap";';
  if (!source.includes(marker)) throw new Error('Pedido: import de CustomerDeliveryMap não encontrado.');
  source = source.replace(
    marker,
    `${marker}\nimport { AppBottomNav } from "@/components/AppBottomNav";`,
  );
}

if (source.includes('className="flex h-screen w-full flex-col overflow-hidden bg-black text-white"')) {
  source = source.replace(
    'className="flex h-screen w-full flex-col overflow-hidden bg-black text-white"',
    'className="relative flex h-screen w-full flex-col overflow-hidden bg-black text-white"',
  );
}

if (source.includes('className="flex-1 space-y-6 overflow-y-auto p-4 pb-20"')) {
  source = source.replace(
    'className="flex-1 space-y-6 overflow-y-auto p-4 pb-20"',
    'className="flex-1 space-y-6 overflow-y-auto p-4 pb-32"',
  );
}

const unsafeCancel = `    } catch (error: any) {\n      toast.error(error?.message || "Não foi possível cancelar este pedido.");\n    } finally {`;
const safeCancel = `    } catch (error) {\n      console.error("Erro ao cancelar pedido:", error);\n      toast.error("Não foi possível cancelar este pedido. Tente novamente.");\n    } finally {`;
if (source.includes(unsafeCancel)) source = source.replace(unsafeCancel, safeCancel);

if (!source.includes('<AppBottomNav activeTab="pedidos" />')) {
  const closing = '\n    </div>\n  );\n}';
  const index = source.lastIndexOf(closing);
  if (index < 0) throw new Error('Pedido: fechamento da página não encontrado para inserir rodapé.');
  source = `${source.slice(0, index)}\n      <AppBottomNav activeTab="pedidos" />${source.slice(index)}`;
}

for (const marker of [
  'import { AppBottomNav } from "@/components/AppBottomNav";',
  'relative flex h-screen w-full flex-col overflow-hidden',
  'overflow-y-auto p-4 pb-32',
  '<AppBottomNav activeTab="pedidos" />',
  'Não foi possível cancelar este pedido. Tente novamente.',
]) {
  if (!source.includes(marker)) throw new Error(`Pedido: hardening ausente: ${marker}`);
}
if (source.includes('toast.error(error?.message || "Não foi possível cancelar este pedido.")')) {
  throw new Error('Pedido: erro técnico de cancelamento ainda exposto ao cliente.');
}

writeFileSync(path, source, 'utf8');
console.log('[OK] Entregas: detalhes do pedido mantêm rodapé ancorado, safe area e erros públicos seguros.');
