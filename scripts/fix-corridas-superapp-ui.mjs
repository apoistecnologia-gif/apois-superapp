import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const strictNativeConfig = process.env.APOIS_STRICT_NATIVE_CONFIG === '1';
const corridasPublicAppUrl = process.env.CORRIDAS_PUBLIC_APP_URL?.trim() || '';

function replaceRequired(path, search, replacement, label) {
  const full = resolve(root, path);
  const before = readFileSync(full, 'utf8');
  if (!before.includes(search)) {
    console.error(`[FAIL] ${label}: padrão esperado não encontrado em ${path}`);
    process.exit(1);
  }
  writeFileSync(full, before.replace(search, replacement));
  console.log(`[OK] ${label}`);
}

function validatePublicAppUrl(value) {
  if (!value) {
    if (strictNativeConfig) {
      console.error('[FAIL] corridas: CORRIDAS_PUBLIC_APP_URL é obrigatório na homologação final para compartilhamento de corrida');
      process.exit(1);
    }
    console.warn('[WARN] corridas: CORRIDAS_PUBLIC_APP_URL ausente; compartilhamento público continuará indisponível em build não estrito');
    return '';
  }
  let parsed;
  try {
    parsed = new URL(value);
  } catch {
    console.error('[FAIL] corridas: CORRIDAS_PUBLIC_APP_URL não é uma URL válida');
    process.exit(1);
  }
  if (!['https:', 'http:'].includes(parsed.protocol)) {
    console.error('[FAIL] corridas: CORRIDAS_PUBLIC_APP_URL deve usar http/https');
    process.exit(1);
  }
  if (strictNativeConfig && parsed.protocol !== 'https:') {
    console.error('[FAIL] corridas: CORRIDAS_PUBLIC_APP_URL deve usar HTTPS em homologação final');
    process.exit(1);
  }
  const normalized = value.replace(/\/#\/?$/, '').replace(/\/+$/, '');
  console.log(`[OK] corridas: acompanhamento público configurado em ${parsed.hostname}`);
  return normalized;
}

const normalizedPublicAppUrl = validatePublicAppUrl(corridasPublicAppUrl);

replaceRequired(
  '.work/corridas/src/routes/_authenticated.inicio.tsx',
  'const categoryArtwork: Record<RideCategoryCode, string> = {\n  carros: "/assets/ride-categories/carros.svg",\n  motos: "/assets/ride-categories/motos.svg",\n  fretes: "/assets/ride-categories/fretes.svg",\n  guincho: "/assets/ride-categories/guincho.svg",\n  envios: "/assets/ride-categories/envios.svg",\n};',
  'const categoryArtwork: Record<RideCategoryCode, string> = {\n  carros: "./assets/ride-categories/carros.svg",\n  motos: "./assets/ride-categories/motos.svg",\n  fretes: "./assets/ride-categories/fretes.svg",\n  guincho: "./assets/ride-categories/guincho.svg",\n  envios: "./assets/ride-categories/envios.svg",\n};',
  'corridas: artes de categorias usam caminho relativo ao módulo do Superapp',
);

if (normalizedPublicAppUrl) {
  replaceRequired(
    '.work/corridas/src/routes/_authenticated.corrida.$rideId.tsx',
    '  const configuredBase = String(import.meta.env.VITE_PUBLIC_APP_URL ?? "").trim();',
    `  const configuredBase = ${JSON.stringify(normalizedPublicAppUrl)};`,
    'corridas: link público de acompanhamento usa base HTTPS configurada no Superapp',
  );
}

replaceRequired(
  '.work/corridas/src/lib/auth/native-password-recovery.ts',
  'export const NATIVE_PASSWORD_RECOVERY_REDIRECT =\n  "apoispassageiro://auth/redefinir-senha";',
  'export const NATIVE_PASSWORD_RECOVERY_REDIRECT =\n  "br.com.apois.app://auth/corridas-reset";\n\nconst FORWARDED_RECOVERY_KEY = "apois-superapp:corridas-recovery-url";',
  'corridas: recuperação de senha usa esquema nativo único do Superapp',
);
replaceRequired(
  '.work/corridas/src/lib/auth/native-password-recovery.ts',
  '    url.protocol === "apoispassageiro:" &&\n    url.hostname === "auth" &&\n    url.pathname.replace(/\\/+$/, "") === "/redefinir-senha"',
  '    url.protocol === "br.com.apois.app:" &&\n    url.hostname === "auth" &&\n    url.pathname.replace(/\\/+$/, "") === "/corridas-reset"',
  'corridas: consumidor nativo reconhece callback de recuperação do Superapp',
);
replaceRequired(
  '.work/corridas/src/lib/auth/native-password-recovery.ts',
  '  const launchUrl = await App.getLaunchUrl();\n  if (launchUrl?.url) await handle({ url: launchUrl.url });\n\n  return async () => {',
  '  const launchUrl = await App.getLaunchUrl();\n  if (launchUrl?.url) await handle({ url: launchUrl.url });\n\n  // Se o deep link chegou enquanto o shell ou Entregas estava aberto, o\n  // Superapp o encaminha por sessionStorage antes de trocar para Corridas.\n  try {\n    const forwardedUrl = window.sessionStorage.getItem(FORWARDED_RECOVERY_KEY);\n    if (forwardedUrl) {\n      window.sessionStorage.removeItem(FORWARDED_RECOVERY_KEY);\n      await handle({ url: forwardedUrl });\n    }\n  } catch {\n    // O appUrlOpen/getLaunchUrl continua sendo a fonte principal.\n  }\n\n  return async () => {',
  'corridas: recuperação encaminhada pelo shell é consumida após troca de módulo',
);

// Home carried a private copy of the bottom navigation. It disappeared as soon
// as the same /inicio route switched into its destination-selected branch and
// also competed for vertical space with the shell footer. The Superapp owns a
// single footer in AppShell instead, so remove only this transient Home copy.
replaceRequired(
  '.work/corridas/src/routes/_authenticated.inicio.tsx',
  '  Bell,\n',
  '',
  'corridas: Home não importa sino apenas para rodapé duplicado',
);
replaceRequired(
  '.work/corridas/src/routes/_authenticated.inicio.tsx',
  '  User,\n',
  '',
  'corridas: Home não importa perfil apenas para rodapé duplicado',
);
replaceRequired(
  '.work/corridas/src/routes/_authenticated.inicio.tsx',
  '  const navItems = [\n    { label: "Início", icon: Home, to: "/inicio" },\n    { label: "Corridas", icon: Clock3, to: "/corridas" },\n    { label: "Carteira", icon: WalletCards, to: "/carteira" },\n    { label: "Notificações", icon: Bell, to: "/notificacoes" },\n    { label: "Perfil", icon: User, to: "/perfil" },\n  ] as const;\n\n',
  '',
  'corridas: remove definição do rodapé privado da Home',
);
replaceRequired(
  '.work/corridas/src/routes/_authenticated.inicio.tsx',
  '<section className="absolute inset-x-0 bottom-[82px] z-30 max-h-[54dvh] overflow-y-auto',
  '<section className="absolute inset-x-0 bottom-0 z-30 max-h-[54dvh] overflow-y-auto',
  'corridas: conteúdo da Home usa toda a área acima do rodapé global',
);
replaceRequired(
  '.work/corridas/src/routes/_authenticated.inicio.tsx',
  '\n      <nav className="app-safe-x absolute inset-x-0 bottom-0 z-40 border-t border-white/10 bg-black/98 pt-2 shadow-[0_-12px_30px_rgba(0,0,0,.55)]" style={{ paddingBottom: "max(8px, var(--app-safe-bottom))" }}>\n        <div className="grid grid-cols-5 gap-1">\n          {navItems.map(({ label, icon: Icon, to }) => (\n            <button key={label} type="button" onClick={() => void navigate({ to })} className={cn("app-pressable flex min-h-[58px] flex-col items-center justify-center gap-1 rounded-xl text-[9px] font-bold", label === "Início" ? "text-apois-yellow" : "text-zinc-500")}>\n              <Icon size={21} />{label}\n            </button>\n          ))}\n        </div>\n      </nav>',
  '',
  'corridas: remove rodapé privado da Home para evitar duplicidade',
);

replaceRequired(
  '.work/corridas/src/components/layout/AppShell.tsx',
  'import type { PropsWithChildren } from "react";\nimport { MainHamburgerMenu } from "@/components/navigation/MainHamburgerMenu";\nimport { cn } from "@/lib/utils";',
  'import type { PropsWithChildren } from "react";\nimport { Bell, Clock3, Home, User, WalletCards } from "lucide-react";\nimport { useLocation, useNavigate } from "@tanstack/react-router";\nimport { MainHamburgerMenu } from "@/components/navigation/MainHamburgerMenu";\nimport { cn } from "@/lib/utils";\n\nconst superappBottomNavItems = [\n  { label: "Início", icon: Home, to: "/inicio" },\n  { label: "Corridas", icon: Clock3, to: "/corridas" },\n  { label: "Carteira", icon: WalletCards, to: "/carteira" },\n  { label: "Notificações", icon: Bell, to: "/notificacoes" },\n  { label: "Perfil", icon: User, to: "/perfil" },\n] as const;\n\nconst superappJourneyRoutesWithoutBottomNav = ["/buscar-destino", "/revisar-solicitacao"];',
  'corridas: AppShell recebe navegação inferior persistente do Superapp',
);

replaceRequired(
  '.work/corridas/src/components/layout/AppShell.tsx',
  '}: AppShellProps) {\n  return (',
  '}: AppShellProps) {\n  const pathname = useLocation().pathname;\n  const navigate = useNavigate();\n  const showBottomNavigation =\n    !superappJourneyRoutesWithoutBottomNav.includes(pathname) &&\n    !pathname.startsWith("/corrida/");\n\n  return (',
  'corridas: AppShell mantém rodapé inclusive na Home e oculta apenas jornada ativa',
);

replaceRequired(
  '.work/corridas/src/components/layout/AppShell.tsx',
  '        </main>\n      </div>',
  '        </main>\n        {showBottomNavigation ? (\n          <nav\n            aria-label="Navegação inferior"\n            className="app-safe-x shrink-0 border-t border-white/10 bg-black/98 pt-2 shadow-[0_-12px_30px_rgba(0,0,0,.55)]"\n            style={{ paddingBottom: "max(8px, var(--app-safe-bottom))" }}\n          >\n            <div className="grid grid-cols-5 gap-1">\n              {superappBottomNavItems.map(({ label, icon: Icon, to }) => {\n                const isActive =\n                  pathname === to ||\n                  (to === "/corridas" && pathname.startsWith("/corridas/")) ||\n                  (to === "/perfil" && pathname.startsWith("/perfil/"));\n                return (\n                  <button\n                    key={label}\n                    type="button"\n                    onClick={() => void navigate({ to })}\n                    aria-current={isActive ? "page" : undefined}\n                    className={cn(\n                      "app-pressable flex min-h-[58px] flex-col items-center justify-center gap-1 rounded-xl text-[9px] font-bold",\n                      isActive ? "text-apois-yellow" : "text-zinc-500",\n                    )}\n                  >\n                    <Icon size={21} />\n                    {label}\n                  </button>\n                );\n              })}\n            </div>\n          </nav>\n        ) : null}\n      </div>',
  'corridas: rodapé único permanece em todas as telas normais e detalhes',
);

console.log('[OK] corridas: assets, compartilhamento, recuperação nativa encaminhável e rodapé global único corrigidos apenas em .work');
