import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const manifest = JSON.parse(readFileSync(resolve(root, '.apois/modules.json'), 'utf8'));
const selected = process.argv.slice(2);
const names = selected.length ? selected : Object.keys(manifest.modules);

function replaceWorkspaceRequired(path, search, replacement, label) {
  const full = resolve(root, path);
  const before = readFileSync(full, 'utf8');
  if (before.includes(replacement)) {
    console.log(`[OK] ${label} (já aplicado)`);
    return;
  }
  if (!before.includes(search)) {
    console.error(`[FAIL] ${label}: padrão protegido esperado não encontrado em ${path}`);
    process.exit(1);
  }
  writeFileSync(full, before.replace(search, replacement));
  console.log(`[OK] ${label}`);
}

for (const name of names) {
  const config = manifest.modules[name];
  if (!config) {
    console.error(`Módulo desconhecido: ${name}`);
    process.exitCode = 1;
    continue;
  }

  const source = resolve(root, config.source);
  const workspace = resolve(root, config.workspace);
  if (!existsSync(source)) {
    console.error(`[FAIL] ${name}: fonte não inicializada em ${config.source}`);
    console.error('Execute: git submodule update --init --recursive');
    process.exitCode = 1;
    continue;
  }

  rmSync(workspace, { recursive: true, force: true });
  mkdirSync(dirname(workspace), { recursive: true });
  cpSync(source, workspace, {
    recursive: true,
    filter: (src) => !src.includes('/.git/') && !src.endsWith('/.git') && !src.includes('/node_modules/'),
  });
  console.log(`[OK] ${name}: snapshot copiado para ${config.workspace}`);

  if (name === 'corridas') {
    // As formas ativas da fonte são preservadas na cópia de trabalho. O hardener
    // específico de pagamentos decide disponibilidade: PIX é eletrônico;
    // Dinheiro e Cartão de crédito são recebimentos diretos ao motorista.
    const paymentMethodsPath = resolve(root, '.work/corridas/src/hooks/use-payment-methods.tsx');
    const paymentMethodsSource = readFileSync(paymentMethodsPath, 'utf8');
    if (!paymentMethodsSource.includes('(method) => method.isActive && method.enabled')) {
      console.error('[FAIL] corridas: filtro base de formas de pagamento não foi encontrado');
      process.exit(1);
    }
    if (paymentMethodsSource.includes('method.code === "pix"')) {
      console.error('[FAIL] corridas: cópia de trabalho voltou a restringir o passageiro somente a PIX');
      process.exit(1);
    }
    console.log('[OK] corridas: métodos ativos permanecem disponíveis para a política PIX + Dinheiro + Cartão direto');

    // O snapshot protegido ainda invoca passenger-ride-request diretamente.
    // No Superapp a criação deve passar pelo roteador request-ride, que escolhe
    // a política financeira conforme a forma de pagamento selecionada.
    replaceWorkspaceRequired(
      '.work/corridas/src/hooks/rides/use-ride-request.tsx',
      '        const { data, error } = await supabase.functions.invoke("passenger-ride-request", {',
      '        const { data, error } = await supabase.functions.invoke("request-ride", {',
      'corridas: solicitação passa pelo roteador financeiro request-ride',
    );
  }
}
