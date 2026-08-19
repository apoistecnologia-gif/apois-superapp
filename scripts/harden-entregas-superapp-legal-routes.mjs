import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

function patch(path, transform, label) {
  const full = resolve(path);
  const before = readFileSync(full, 'utf8');
  const after = transform(before);
  if (after === before) {
    console.log(`[OK] ${label} (já aplicado)`);
    return;
  }
  writeFileSync(full, after, 'utf8');
  console.log(`[OK] ${label}`);
}

function replaceRequired(source, search, replacement, label) {
  if (source.includes(replacement)) return source;
  if (!source.includes(search)) throw new Error(`${label}: padrão esperado não encontrado`);
  return source.replace(search, replacement);
}

for (const path of [
  '.work/entregas/src/routes/termos.tsx',
  '.work/entregas/src/routes/privacidade.tsx',
]) {
  patch(path, (source) => {
    source = replaceRequired(
      source,
      'onClick={() =>\n            window.history.length > 1 ? window.history.back() : navigate({ to: "/" })\n          }',
      'onClick={() => void navigate({ to: "/", replace: true })}',
      'Legal: voltar permanece dentro do módulo Entregas',
    );
    source = replaceRequired(
      source,
      'className="sticky top-0 z-30 flex items-center gap-3 border-b border-zinc-900 bg-black/90 p-4 backdrop-blur"',
      'className="sticky top-0 z-30 flex items-center gap-3 border-b border-zinc-900 bg-black/90 px-4 pb-4 pt-[max(env(safe-area-inset-top),1rem)] backdrop-blur"',
      'Legal: cabeçalho respeita safe area superior',
    );
    source = replaceRequired(
      source,
      'className="mx-auto max-w-3xl space-y-5 p-5 pb-12"',
      'className="mx-auto max-w-3xl space-y-5 px-5 pt-5 pb-[max(env(safe-area-inset-bottom),3rem)]"',
      'Legal: conteúdo respeita safe area inferior',
    );
    if (source.includes('window.history.back()')) {
      throw new Error(`Legal: histórico físico ainda presente em ${path}`);
    }
    return source;
  }, `${path}: navegação e safe areas ajustadas`);
}

patch('.work/entregas/src/routes/privacidade.tsx', (source) => {
  source = replaceRequired(
    source,
    'mapas e geolocalização Google Maps e processamento de PIX Mercado Pago, dentro da finalidade de cada integração.',
    'mapas e geolocalização e processamento de PIX por fornecedores integrados, dentro da finalidade de cada integração.',
    'Privacidade: política não fixa provedor financeiro diferente do configurado em produção',
  );
  source = replaceRequired(
    source,
    'A desativação da conta interrompe o acesso e as novas operações da conta, mas não implica apagamento automático de registros que devam ser conservados legitimamente. Solicitações relacionadas a eliminação ou outros direitos podem ser encaminhadas pelo suporte.',
    'O cliente pode solicitar a exclusão da própria conta em Perfil > Dados pessoais > Excluir minha conta. A solicitação abrange a conta e os dados pessoais associados, ressalvados somente os registros que precisem ser conservados por obrigação legal ou regulatória, segurança, prevenção de fraude, auditoria, solução de disputas ou exercício regular de direitos.',
    'Privacidade: política descreve caminho interno de exclusão',
  );
  source = replaceRequired(
    source,
    'O canal operacional disponível é Ajuda e Suporte dentro da plataforma. O pedido deve identificar de forma suficiente a conta e o direito que se pretende exercer. O atendimento poderá solicitar informações adicionais estritamente necessárias para confirmar a identidade do titular.',
    'Além do caminho de exclusão disponível em Perfil > Dados pessoais, o canal Ajuda e Suporte pode ser usado para exercer direitos de privacidade. O atendimento poderá solicitar informações adicionais estritamente necessárias para confirmar a identidade do titular e proteger a conta contra solicitações fraudulentas.',
    'Privacidade: direitos apontam para exclusão no app e suporte',
  );
  return source;
}, 'Entregas: política de privacidade alinhada a gateway e exclusão de conta');
