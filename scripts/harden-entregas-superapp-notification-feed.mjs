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

patch('.work/entregas/src/routes/notificacoes.tsx', (source) => {
  if (!source.includes('import { AppBottomNav } from "@/components/AppBottomNav";')) {
    source = `import { AppBottomNav } from "@/components/AppBottomNav";\n${source}`;
  }
  source = replaceRequired(
    source,
    'onClick={() =>\n            window.history.length > 1 ? window.history.back() : navigate({ to: "/perfil" })\n          }',
    'onClick={() => void navigate({ to: "/inicio", replace: true })}',
    'Central de notificações: voltar não depende do histórico físico',
  );
  source = replaceRequired(
    source,
    'className="sticky top-0 z-40 flex items-center gap-3 border-b border-zinc-900 bg-black/90 p-4 backdrop-blur"',
    'className="sticky top-0 z-40 flex items-center gap-3 border-b border-zinc-900 bg-black/90 px-4 pb-4 pt-[max(env(safe-area-inset-top),1rem)] backdrop-blur"',
    'Central de notificações: safe area superior',
  );
  source = replaceRequired(
    source,
    'className="mx-auto w-full max-w-2xl flex-1 p-4 pb-24"',
    'className="mx-auto w-full max-w-2xl flex-1 overflow-y-auto p-4 pb-32"',
    'Central de notificações: espaço para rodapé fixo',
  );
  if (!source.includes('<AppBottomNav activeTab="perfil" />')) {
    const closing = '\n    </div>\n  );\n}';
    const index = source.lastIndexOf(closing);
    if (index < 0) throw new Error('Central de notificações: fechamento da página não encontrado');
    source = `${source.slice(0, index)}\n      <AppBottomNav activeTab="perfil" />${source.slice(index)}`;
  }
  if (source.includes('window.history.back()')) {
    throw new Error('Central de notificações: histórico físico ainda presente');
  }
  return source;
}, 'Entregas: central de notificações pronta para Push e navegação no APK');

patch('.work/entregas/src/routes/perfil/index.tsx', (source) => {
  source = replaceRequired(
    source,
    '{ icon: Bell, label: "Notificações", path: "/perfil/notificacoes" },',
    '{ icon: Bell, label: "Central de notificações", path: "/notificacoes" },\n      { icon: Bell, label: "Preferências de notificações", path: "/perfil/notificacoes" },',
    'Perfil: diferencia feed de notificações das preferências',
  );
  return source;
}, 'Entregas: perfil expõe central e preferências de notificações separadamente');
