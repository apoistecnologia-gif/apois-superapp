import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const path = resolve('.work/corridas/src/routes/_authenticated.perfil.tsx');
let source = readFileSync(path, 'utf8');

source = source.replace(
  '<MenuLink icon={<Bell size={20} />} label="Notificações" />',
  '<MenuLink icon={<Bell size={20} />} label="Notificações" onClick={() => navigate({ to: "/notificacoes" })} />',
);
source = source.replace(
  '<MenuLink icon={<CreditCard size={20} />} label="Pagamentos" />',
  '<MenuLink icon={<CreditCard size={20} />} label="Pagamentos" onClick={() => navigate({ to: "/carteira" })} />',
);
source = source.replace(
  '<MenuLink icon={<Shield size={20} />} label="Segurança" />',
  '<MenuLink icon={<Shield size={20} />} label="Segurança" value="Proteção da conta ativa" />',
);

const oldComponent = `function MenuLink({\n  icon,\n  label,\n  value,\n}: {\n  icon: React.ReactNode;\n  label: string;\n  value?: string;\n}) {\n  return (\n    <button className="w-full flex items-center justify-between p-4 bg-[#121212] hover:bg-[#1a1a1a] rounded-xl transition-colors text-left group">\n      <div className="flex items-center gap-4">\n        <div className="text-yellow-500">{icon}</div>\n        <div>\n          <p className="text-sm font-medium">{label}</p>\n          {value && <p className="text-xs text-gray-500 truncate max-w-[200px]">{value}</p>}\n        </div>\n      </div>\n      <ChevronRight\n        size={18}\n        className="text-gray-700 group-hover:text-yellow-500 transition-colors"\n      />\n    </button>\n  );\n}`;

const newComponent = `function MenuLink({\n  icon,\n  label,\n  value,\n  onClick,\n}: {\n  icon: React.ReactNode;\n  label: string;\n  value?: string;\n  onClick?: () => void;\n}) {\n  const content = (\n    <>\n      <div className="flex min-w-0 items-center gap-4">\n        <div className="shrink-0 text-yellow-500">{icon}</div>\n        <div className="min-w-0">\n          <p className="text-sm font-medium">{label}</p>\n          {value && <p className="max-w-[220px] truncate text-xs text-gray-500">{value}</p>}\n        </div>\n      </div>\n      {onClick ? (\n        <ChevronRight size={18} className="shrink-0 text-gray-700 transition-colors group-hover:text-yellow-500" />\n      ) : null}\n    </>\n  );\n\n  if (!onClick) {\n    return (\n      <div className="flex min-h-[68px] w-full items-center justify-between rounded-2xl bg-[#121212] p-4 text-left">\n        {content}\n      </div>\n    );\n  }\n\n  return (\n    <button\n      type="button"\n      onClick={onClick}\n      className="group flex min-h-[68px] w-full items-center justify-between rounded-2xl bg-[#121212] p-4 text-left transition-colors hover:bg-[#1a1a1a] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-yellow-500"\n    >\n      {content}\n    </button>\n  );\n}`;

if (source.includes(oldComponent)) {
  source = source.replace(oldComponent, newComponent);
} else if (!source.includes('onClick?: () => void;')) {
  throw new Error('[FAIL] Corridas: componente MenuLink mudou; não é seguro aplicar ações automaticamente');
}

for (const marker of [
  'label="Notificações" onClick={() => navigate({ to: "/notificacoes" })}',
  'label="Pagamentos" onClick={() => navigate({ to: "/carteira" })}',
  'onClick?: () => void;',
  'if (!onClick)',
  '{onClick ? (',
]) {
  if (!source.includes(marker)) throw new Error(`[FAIL] Corridas perfil: ação incompleta (${marker})`);
}

if (/function MenuLink[\s\S]*return \(\s*<button className=/.test(source)) {
  throw new Error('[FAIL] Corridas perfil: MenuLink ainda transforma toda linha informativa em botão inerte');
}

writeFileSync(path, source, 'utf8');
console.log('[OK] Corridas: Perfil só exibe affordance de navegação onde existe ação real.');
