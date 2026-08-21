import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
const workspace = process.env.APOIS_ENTREGAS_WORKSPACE || '.work/partner-entregador';
const path = resolve(root, workspace, 'src/components/CourierPremiumViews.tsx');
let source = readFileSync(path, 'utf8');

source = source
  .replace('Saldo disponível', 'Ganhos registrados')
  .replace('Saldo total', 'Total registrado')
  .replace('Reservado', 'Em processamento')
  .replace(
    'Ela será criada automaticamente após a primeira entrega liquidada.',
    'Seus ganhos serão registrados automaticamente após a primeira entrega concluída.',
  );

const startMarker = `            <section className="rounded-[1.6rem] border border-zinc-800 bg-zinc-950 p-4">
              <div className="flex items-center gap-2">
                <CircleDollarSign className="h-5 w-5 text-primary" />
                <h2 className="font-black">Recebimento via PIX</h2>`;
const endMarker = `            <FinanceList
              title="Histórico de saques"`;

if (!source.includes('Recebimento direto em homologação')) {
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start);
  if (start < 0 || end < 0 || end <= start) {
    throw new Error('[FAIL] Entregador Parceiro: bloco legado de recebimento/saque não encontrado.');
  }
  const replacement = `            <section className="rounded-[1.6rem] border border-primary/25 bg-[linear-gradient(145deg,rgba(250,204,21,0.08),#090909_60%)] p-4">
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-5 w-5 text-primary" />
                <h2 className="font-black">Recebimento direto em homologação</h2>
              </div>
              <p className="mt-3 text-sm leading-6 text-zinc-300">
                Seus ganhos ficam registrados por entrega concluída. A APOIS não libera saque manual enquanto o repasse direto ao entregador pelo provedor financeiro não estiver homologado.
              </p>
              <div className="mt-3 rounded-2xl border border-primary/15 bg-black/55 p-3 text-[11px] leading-5 text-zinc-500">
                Nenhuma chave PIX ou valor de saque é solicitado nesta fase. Isso evita criar uma transferência sem lastro ou cobrar a APOIS por um valor que deve ser destinado diretamente ao entregador.
              </div>
            </section>

`;
  source = source.slice(0, start) + replacement + source.slice(end);
}

for (const marker of [
  'Ganhos registrados',
  'Total registrado',
  'Em processamento',
  'Recebimento direto em homologação',
  'A APOIS não libera saque manual',
  'Nenhuma chave PIX ou valor de saque é solicitado nesta fase.',
]) {
  if (!source.includes(marker)) {
    throw new Error(`[FAIL] Entregador Parceiro: hardening financeiro incompleto (${marker}).`);
  }
}

for (const forbidden of [
  '<h2 className="font-black">Recebimento via PIX</h2>',
  '<h2 className="font-black">Solicitar saque</h2>',
  '>Salvar chave PIX<',
]) {
  if (source.includes(forbidden)) {
    throw new Error(`[FAIL] Entregador Parceiro: UI financeira legada permaneceu (${forbidden}).`);
  }
}

writeFileSync(path, source, 'utf8');
console.log('[OK] Entregador Parceiro: carteira virou registro de ganhos; chave PIX e saque manual ficam ocultos até o marketplace direto estar homologado.');
