import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
const workspace = process.env.APOIS_ENTREGAS_WORKSPACE || '.work/partner-entregador';
const target = resolve(root, workspace, 'src/components/CourierActiveDeliveryOverlay.tsx');
let source = readFileSync(target, 'utf8');

const oldRpc = `const rpc = supabase.rpc as unknown as RpcCaller;`;
const newRpc = `const rpcBase = supabase.rpc as unknown as RpcCaller;

function courierDeliveryError(raw: unknown, fallback: string) {
  const message = String((raw as { message?: string } | null)?.message ?? raw ?? "").trim();
  const normalized = message.toLowerCase();
  const known: Array<[string, string]> = [
    ["active account required", "Sua conta precisa estar ativa para continuar a entrega."],
    ["eligible courier required", "Seu cadastro de entregador precisa estar aprovado e ativo."],
    ["delivery job not assigned to courier", "Esta entrega não está mais vinculada à sua conta. Atualize a tela."],
    ["invalid delivery transition", "A etapa da entrega mudou. Atualize a tela e tente novamente."],
    ["courier must arrive at destination first", "Marque primeiro que chegou ao destino antes de confirmar a entrega."],
    ["delivery confirmation secret not found", "O PIN desta entrega ainda não está disponível. Atualize a tela ou acione o suporte."],
    ["jwt", "Sua sessão expirou. Entre novamente para continuar."],
    ["unauthorized", "Sua sessão expirou. Entre novamente para continuar."],
  ];
  const match = known.find(([needle]) => normalized.includes(needle));
  return match?.[1] ?? (message && !/^edge function/i.test(message) ? message : fallback);
}

const rpc: RpcCaller = async (name, args) => {
  try {
    return await rpcBase(name, args);
  } catch (error) {
    return { data: null, error: { message: courierDeliveryError(error, "Falha de conexão. Verifique a internet e tente novamente.") } };
  }
};`;
if (source.includes(oldRpc)) source = source.replace(oldRpc, newRpc);

source = source
  .replace(
    'toast.error(error.message || "Não foi possível atualizar a etapa.");',
    'toast.error(courierDeliveryError(error, "Não foi possível atualizar a etapa."));',
  )
  .replace(
    'toast.error(error.message || "Não foi possível concluir a entrega.");',
    'toast.error(courierDeliveryError(error, "Não foi possível concluir a entrega."));',
  )
  .replace(
    'toast.error(error.message || "Não foi possível abrir o chamado.");',
    'toast.error(courierDeliveryError(error, "Não foi possível abrir o chamado."));',
  );

// O número do endereço pode vir como number no JSON de geocodificação.
source = source.replace(
  'const number = typeof address["number"] === "string" ? address["number"] : null;',
  'const number = typeof address["number"] === "string" || typeof address["number"] === "number" ? String(address["number"]) : null;',
);

for (const marker of [
  'function courierDeliveryError(',
  'const rpc: RpcCaller = async',
  'Falha de conexão. Verifique a internet e tente novamente.',
  'A etapa da entrega mudou. Atualize a tela e tente novamente.',
  'Marque primeiro que chegou ao destino antes de confirmar a entrega.',
  'typeof address["number"] === "number"',
]) {
  if (!source.includes(marker)) {
    throw new Error(`Entregador Parceiro: hardening da entrega ativa incompleto (${marker}).`);
  }
}

writeFileSync(target, source, 'utf8');
console.log('[OK] Entregador Parceiro: etapas da entrega não travam em exceção de rede e erros do backend ficam acionáveis.');
