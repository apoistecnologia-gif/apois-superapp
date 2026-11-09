// RV-07 CV-023/024 — only presentation in disposable .work workspaces.
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const DRIVER_MARK = "APOIS_CV07_DRIVER_MEMBERSHIP_STATUS_V1";
export const MERCHANT_MARK = "APOIS_CV07_MERCHANT_STATUS_FALLBACK_V1";

function once(source, from, to, label) {
  const count = source.split(from).length - 1;
  if (count !== 1) throw new Error("[CV07] " + label + " expected one anchor, found " + count);
  return source.replace(from, to);
}

export function patchDriverSubscription(source) {
  if (source.includes(DRIVER_MARK)) {
    if (!source.includes("{visualSubscriptionLabel}") || !source.includes("visualMembershipConfirmed && operational")) {
      throw new Error("[CV07] partially transformed driver status");
    }
    return source;
  }
  for (const marker of [
    'const subscription = normalizeStatus(driver?.subscription_status || "inactive");',
    'const operational = paidActive || homologation;',
    'Pagamento eletrônico temporariamente indisponível',
    'Tentar novamente',
  ]) {
    if (!source.includes(marker)) throw new Error("[CV07] driver baseline changed: " + marker);
  }
  let output = once(source,
    '  const operational = paidActive || homologation;',
    [
      '  const operational = paidActive || homologation;',
      '  // ' + DRIVER_MARK + ': presentation only; do not change eligibility or persisted status.',
      '  const visualMembershipConfirmed = Boolean(driver && !error && !loading);',
      '  const visualSubscriptionLabel = !visualMembershipConfirmed',
      '    ? (loading ? "Consultando mensalidade…" : "Situação da mensalidade indisponível")',
      '    : paidActive ? "Mensalidade ativa"',
      '    : homologation ? "Homologação ativa"',
      '    : ["pending", "pendente"].includes(subscription) ? "Pagamento pendente"',
      '    : ["processing", "processando"].includes(subscription) ? "Pagamento em processamento"',
      '    : ["inactive", "inativa", "inativo"].includes(subscription) ? "Mensalidade inativa"',
      '    : "Situação da mensalidade indisponível";',
    ].join('\n'),
    'driver display-only status mapping');
  output = once(output,
    'className={\`h-2 w-2 shrink-0 rounded-full \${operational ? "bg-emerald-400" : "bg-zinc-600"}\`}',
    'className={\`h-2 w-2 shrink-0 rounded-full \${visualMembershipConfirmed && operational ? "bg-emerald-400" : "bg-zinc-600"}\`}',
    'driver neutral visual indicator on lookup failure');
  output = once(output,
    '<span>{paidActive ? "Mensalidade ativa" : homologation ? "Homologação ativa" : "Mensalidade inativa"}</span>',
    '<span className="min-w-0 break-words">{visualSubscriptionLabel}</span>',
    'driver chip presentation');
  output = once(output,
    '        {!approved ? (',
    [
      '        {(!driver || error || loading) ? (',
      '          <DSCard className="min-w-0 border-white/10 bg-[#0D0F11] p-5" role="status">',
      '            <p className="text-sm font-black text-white">Situação da mensalidade indisponível</p>',
      '            <p className="mt-2 break-words text-xs leading-5 text-zinc-400">',
      '              {loading ? "Atualizando os dados da mensalidade…" : "Não foi possível confirmar sua situação agora. Use a opção de tentar novamente, quando disponível."}',
      '            </p>',
      '          </DSCard>',
      '        ) : !approved ? (',
    ].join('\n'),
    'driver status card when lookup unavailable');
  if (!output.includes('contractMonthlyFee === null') && source.includes('APOIS_DRIVER_NEW_MONTHLY_FEE_5990_V1')) {
    throw new Error('[CV07] driver price contract marker drifted');
  }
  return output;
}

export function patchMerchantSubscription(source) {
  if (source.includes(MERCHANT_MARK)) {
    if (source.includes('Status: \${value}') || !source.includes('return "Situação da mensalidade indisponível";')) {
      throw new Error("[CV07] partially transformed merchant status");
    }
    return source;
  }
  for (const marker of ['function statusLabel(value:', 'case "paid":', 'case "authorized":',
    'case "pending":', 'case "paused":', 'case "cancelled":', 'case "canceled":',
    'Pagamento eletrônico temporariamente indisponível']) {
    if (!source.includes(marker)) throw new Error("[CV07] merchant dictionary changed: " + marker);
  }
  return once(source,
    '    default:\n      return value ? \`Status: \${value}\` : "Mensalidade ainda não ativada";',
    [
      '    default:',
      '      // ' + MERCHANT_MARK + ': unknown/absent provider codes are never payment confirmations.',
      '      return "Situação da mensalidade indisponível";',
    ].join('\n'),
    'merchant safe unknown status');
}

export function applyVisual07(kind, root = process.cwd()) {
  const rel = kind === 'motorista'
    ? 'src/routes/motorista.assinatura.tsx'
    : kind === 'merchant' ? 'src/components/MerchantSubscriptionGate.tsx' : null;
  if (!rel) throw new Error('[CV07] expected motorista or merchant');
  const workspace = kind === 'motorista'
    ? (process.env.APOIS_MOTORISTA_WORKSPACE || '.work/partner-motorista')
    : '.work/entregas';
  const target = resolve(root, workspace, rel);
  const before = readFileSync(target, 'utf8');
  const after = kind === 'motorista' ? patchDriverSubscription(before) : patchMerchantSubscription(before);
  if (before !== after) writeFileSync(target, after, 'utf8');
  return { kind, changed: before !== after, target };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  const result = applyVisual07(process.argv[2]);
  console.log('[OK] RV-07 ' + result.kind + ': visual status ' + (result.changed ? 'updated' : 'already applied'));
}
