import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const path = resolve('.work/entregas/src/routes/perfil/dados-pessoais.tsx');
let source = readFileSync(path, 'utf8');

if (!source.includes('import { AppBottomNav } from "@/components/AppBottomNav";')) {
  source = `import { AppBottomNav } from "@/components/AppBottomNav";\n${source}`;
}

if (!source.includes('<AppBottomNav activeTab="perfil" />')) {
  const closing = '\n    </div>\n  );\n}';
  const index = source.lastIndexOf(closing);
  if (index < 0) throw new Error('Dados pessoais: fechamento da página não encontrado para inserir rodapé.');
  source = `${source.slice(0, index)}\n      <AppBottomNav activeTab="perfil" />${source.slice(index)}`;
}

if (!source.includes('pb-[calc(env(safe-area-inset-bottom)+7rem)]') && !source.includes('pb-[calc(env(safe-area-inset-bottom)+9rem)]')) {
  throw new Error('Dados pessoais: área inferior segura esperada não encontrada.');
}

writeFileSync(path, source, 'utf8');
console.log('[OK] Entregas: Dados Pessoais mantém navegação inferior e reserva safe area.');
