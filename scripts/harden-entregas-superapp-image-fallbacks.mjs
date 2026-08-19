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

const hideBrokenImage = 'onError={(event) => { event.currentTarget.style.display = "none"; }}';

function addImageFallbacks(source, expressions, label) {
  let changed = 0;
  for (const expression of expressions) {
    const token = `src={${expression}}`;
    const hardened = `${token}\n                                ${hideBrokenImage}`;
    if (source.includes(hardened) || source.includes(`${token} ${hideBrokenImage}`)) continue;
    if (!source.includes(token)) continue;
    source = source.split(token).join(hardened);
    changed += 1;
  }
  if (changed === 0 && !source.includes(hideBrokenImage)) {
    throw new Error(`${label}: nenhuma imagem remota esperada encontrada`);
  }
  return source;
}

patch('.work/entregas/src/routes/inicio.tsx', (source) => {
  return addImageFallbacks(source, ['avatarUrl', 'cat.image_url', 'merchant.logo_url'], 'Home');
}, 'Entregas: Home não exibe ícones quebrados de imagens remotas');

patch('.work/entregas/src/routes/buscar.tsx', (source) => {
  return addImageFallbacks(source, ['category.image_url', 'product.image_url', 'merchant.logo_url'], 'Busca');
}, 'Entregas: Busca não exibe imagens remotas quebradas');

patch('.work/entregas/src/routes/favoritos.tsx', (source) => {
  return addImageFallbacks(source, ['merchant.logo_url'], 'Favoritos');
}, 'Entregas: Favoritos não exibe logo remota quebrada');

patch('.work/entregas/src/routes/sacola.tsx', (source) => {
  return addImageFallbacks(source, ['merchant.logo'], 'Sacola');
}, 'Entregas: Sacola não exibe logo remota quebrada');

patch('.work/entregas/src/routes/perfil/index.tsx', (source) => {
  return addImageFallbacks(source, ['profile?.avatar_url'], 'Perfil');
}, 'Entregas: perfil não exibe avatar remoto quebrado');

patch('.work/entregas/src/routes/perfil/dados-pessoais.tsx', (source) => {
  return addImageFallbacks(source, ['avatarSrc'], 'Dados pessoais');
}, 'Entregas: edição de perfil não exibe avatar remoto quebrado');

patch('.work/entregas/src/components/ProductCustomizationSheet.tsx', (source) => {
  source = addImageFallbacks(source, ['product.image_url'], 'Personalização do produto');
  const oldFooter = 'className="absolute bottom-0 left-0 right-0 bg-zinc-950 border-t border-zinc-900 p-4 pt-6 flex flex-row items-center gap-4 sm:justify-between"';
  const newFooter = 'className="absolute bottom-0 left-0 right-0 bg-zinc-950 border-t border-zinc-900 px-4 pt-6 pb-[max(env(safe-area-inset-bottom),1.25rem)] flex flex-row items-center gap-4 sm:justify-between"';
  if (!source.includes(newFooter)) {
    if (!source.includes(oldFooter)) throw new Error('Personalização: rodapé esperado não encontrado');
    source = source.replace(oldFooter, newFooter);
  }
  return source;
}, 'Entregas: personalização usa fallback de imagem e safe area inferior');

patch('.work/entregas/src/routes/estabelecimento.$merchantId.tsx', (source) => {
  source = addImageFallbacks(
    source,
    ['merchant.cover_url', 'merchant.logo_url', 'product.image_url'],
    'Estabelecimento',
  );
  const legacyBack = 'onClick={() => window.history.back()}';
  const safeBack = 'onClick={() => void navigate({ to: "/inicio", replace: true })}';
  if (source.includes(legacyBack)) source = source.split(legacyBack).join(safeBack);
  if (source.includes('window.history.back()')) throw new Error('Estabelecimento: histórico físico ainda presente');
  if (!source.includes(safeBack)) throw new Error('Estabelecimento: navegação segura para início não aplicada');
  return source;
}, 'Entregas: estabelecimento usa fallback de imagens e retorno interno seguro');
