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
  // O snapshot fixado agora envolve o retorno em um Fragment para também
  // renderizar os diálogos assíncronos de cancelamento (confirmDialog/
  // promptDialog) como irmãos do container principal, então o fechamento já
  // não é mais imediatamente seguido por `);\n}`. Ancoramos no fechamento do
  // <main>, que continua estável, e inserimos o rodapé como último filho do
  // container externo antes dele fechar.
  const marker = '      </main>\n    </div>';
  const index = source.indexOf(marker);
  if (index < 0) throw new Error('Pedido: fechamento da página não encontrado para inserir rodapé.');
  const insertAt = index + '      </main>\n    </div>'.length;
  source = `${source.slice(0, insertAt)}\n      <AppBottomNav activeTab="pedidos" />${source.slice(insertAt)}`;
}

// O container já evoluiu de h-screen para h-dvh (viewport dinâmico do Android),
// que é o comportamento correto. Aceitamos os dois formatos em vez de reprovar.
const container = source.includes('relative flex h-dvh w-full flex-col overflow-hidden')
  ? 'relative flex h-dvh w-full flex-col overflow-hidden'
  : 'relative flex h-screen w-full flex-col overflow-hidden';

for (const marker of [
  'import { AppBottomNav } from "@/components/AppBottomNav";',
  container,
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
