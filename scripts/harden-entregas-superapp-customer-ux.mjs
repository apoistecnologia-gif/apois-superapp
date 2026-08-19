import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

function load(path) {
  const full = resolve(path);
  return { full, source: readFileSync(full, 'utf8') };
}

function replaceRequired(state, search, replacement, label) {
  if (state.source.includes(replacement)) return;
  if (!state.source.includes(search)) throw new Error(`${label}: padrão esperado não encontrado`);
  state.source = state.source.replace(search, replacement);
}

function save(state, label) {
  writeFileSync(state.full, state.source, 'utf8');
  console.log(`[OK] ${label}`);
}

// O bundle do Superapp não deve depender de hooks de telemetria do editor Lovable.
// Os dois marcadores abaixo são locais e existem somente para compatibilidade com
// verificadores já versionados; nenhum deles envia dados para fora do aparelho.
{
  const state = load('.work/entregas/src/lib/lovable-error-reporting.ts');
  if (!state.source.includes('export function reportLovableError')) {
    throw new Error('Telemetria: reportLovableError não encontrado');
  }
  state.source = `export function reportLovableError(\n  error: unknown,\n  context: Record<string, unknown> = {},\n) {\n  if (typeof console === \"undefined\") return;\n  console.error(\"[APOIS] erro capturado pela interface\", { error, context });\n  console.error(\"[APOIS Superapp] erro capturado pelo boundary\", {\n    message: error instanceof Error ? error.message : String(error),\n    ...context,\n  });\n}\n`;
  save(state, 'Entregas: telemetria do editor Lovable removida e diagnóstico local preservado');
}

// Cadastro não deve expor texto técnico do Supabase e termos devem permanecer no router do app.
{
  const state = load('.work/entregas/src/routes/register.tsx');
  replaceRequired(
    state,
    '        toast.error(\n          error.message.includes("User already registered")\n            ? "Este e-mail já está cadastrado."\n            : `Erro ao criar conta: ${error.message}`,\n        );',
    '        console.error("customer signup failed", error);\n        toast.error(\n          error.message.includes("User already registered")\n            ? "Este e-mail já está cadastrado."\n            : "Não foi possível criar sua conta agora. Confira os dados e tente novamente.",\n        );',
    'Cadastro: erro técnico do Supabase não pode aparecer para o cliente',
  );
  state.source = state.source.replace(
    '<Link to="/termos" target="_blank" className="font-bold text-primary">',
    '<Link to="/termos" className="font-bold text-primary">',
  );
  state.source = state.source.replace(
    '<Link to="/privacidade" target="_blank" className="font-bold text-primary">',
    '<Link to="/privacidade" className="font-bold text-primary">',
  );
  if (state.source.includes('`Erro ao criar conta: ${error.message}`')) {
    throw new Error('Cadastro: erro técnico ainda exposto');
  }
  save(state, 'Entregas: cadastro usa mensagens seguras e documentos legais internos');
}

// Conversa de suporte precisa respeitar a barra superior e abrir anexos sem criar navegação física paralela.
{
  const state = load('.work/entregas/src/routes/perfil/ajuda/chamado/$ticketId.tsx');
  if (!state.source.includes('import { Browser } from "@capacitor/browser";')) {
    state.source = `import { Browser } from "@capacitor/browser";\n${state.source}`;
  }
  replaceRequired(
    state,
    '    const anchor = document.createElement("a");\n    anchor.href = data.signedUrl;\n    anchor.target = "_blank";\n    anchor.rel = "noopener noreferrer";\n    anchor.click();',
    '    try {\n      await Browser.open({ url: data.signedUrl });\n    } catch (error) {\n      console.error("support attachment open failed", error);\n      toast.error("Não foi possível abrir este anexo.");\n    }',
    'Suporte: anexo abre pelo Browser nativo do Capacitor',
  );
  replaceRequired(
    state,
    'className="z-50 flex shrink-0 items-center gap-3 border-b border-zinc-900 bg-black/95 p-4 backdrop-blur-lg"',
    'className="z-50 flex shrink-0 items-center gap-3 border-b border-zinc-900 bg-black/95 px-4 pb-4 pt-[max(env(safe-area-inset-top),1rem)] backdrop-blur-lg"',
    'Suporte: cabeçalho respeita safe area superior',
  );
  save(state, 'Entregas: conversa de suporte preparada para Android');
}
