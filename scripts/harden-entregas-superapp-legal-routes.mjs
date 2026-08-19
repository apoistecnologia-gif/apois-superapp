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
  return replaceRequired(
    source,
    'mapas e geolocalização Google Maps e processamento de PIX Mercado Pago, dentro da finalidade de cada integração.',
    'mapas e geolocalização e processamento de PIX por fornecedores integrados, dentro da finalidade de cada integração.',
    'Privacidade: política não fixa provedor financeiro diferente do configurado em produção',
  );
}, 'Entregas: política de privacidade não cita gateway financeiro obsoleto');
