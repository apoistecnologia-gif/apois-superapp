import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
const workspace = process.env.APOIS_ENTREGAS_WORKSPACE || '.work/partner-entregador';
const routePath = resolve(root, workspace, 'src/routes/courier.tsx');
const viewsPath = resolve(root, workspace, 'src/components/CourierPremiumViews.tsx');

let route = readFileSync(routePath, 'utf8');

if (!route.includes('const leaveInitialApplication = async () => {')) {
  const anchor = '  const submitApplication = async (event: React.FormEvent<HTMLFormElement>) => {';
  if (!route.includes(anchor)) throw new Error('[FAIL] Entregador Parceiro: submitApplication não encontrado.');
  const helper = `  const leaveInitialApplication = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      toast.error("Não foi possível trocar de conta agora. Tente novamente.");
      return;
    }
    window.location.replace("../../index.html");
  };

`;
  route = route.replace(anchor, helper + anchor);
}

route = route.replace(
  '        onBack={() => void logout()}\n',
  '        onBack={() => void leaveInitialApplication()}\n',
);
route = route.replace(
  `        onBack={() => window.location.replace('../../index.html')}\n`,
  '        onBack={() => void leaveInitialApplication()}\n',
);

for (const marker of [
  'const leaveInitialApplication = async () => {',
  'await supabase.auth.signOut();',
  'window.location.replace("../../index.html");',
  'onBack={() => void leaveInitialApplication()}',
]) {
  if (!route.includes(marker)) {
    throw new Error(`[FAIL] Entregador Parceiro: troca de conta no cadastro inicial incompleta (${marker}).`);
  }
}
writeFileSync(routePath, route, 'utf8');

let views = readFileSync(viewsPath, 'utf8');
if (!views.includes('data-apois-courier-review-switch')) {
  const anchor = `        <p className="px-3 text-center text-xs leading-5 text-zinc-600">\n          {blocked\n            ? "Entre em contato com o suporte APOIS para entender ou revisar o bloqueio."\n            : "Depois da aprovação, o modo Online e as ofertas de entrega serão liberados automaticamente."}\n        </p>`;
  if (!views.includes(anchor)) throw new Error('[FAIL] Entregador Parceiro: rodapé do estado de análise não encontrado.');
  const replacement = `${anchor}\n        <button\n          data-apois-courier-review-switch\n          type="button"\n          onClick={() => window.location.replace('../../index.html')}\n          className="w-full rounded-2xl border border-primary/25 bg-primary/10 p-4 text-sm font-black text-primary active:scale-[0.99]"\n        >\n          Trocar perfil de parceiro\n        </button>`;
  views = views.replace(anchor, replacement);
}

for (const marker of [
  'data-apois-courier-review-switch',
  'Trocar perfil de parceiro',
  "window.location.replace('../../index.html')",
]) {
  if (!views.includes(marker)) throw new Error(`[FAIL] Entregador Parceiro: seletor ausente no onboarding/revisão (${marker}).`);
}
writeFileSync(viewsPath, views, 'utf8');

console.log('[OK] Entregador Parceiro: cadastro inicial encerra somente a sessão Entregas ao voltar; análise/recusa/bloqueio pode voltar ao seletor preservando a sessão.');
