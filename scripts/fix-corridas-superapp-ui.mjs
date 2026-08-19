import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

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

replaceRequired(
  '.work/corridas/src/routes/_authenticated.inicio.tsx',
  'const categoryArtwork: Record<RideCategoryCode, string> = {\n  carros: "/assets/ride-categories/carros.svg",\n  motos: "/assets/ride-categories/motos.svg",\n  fretes: "/assets/ride-categories/fretes.svg",\n  guincho: "/assets/ride-categories/guincho.svg",\n  envios: "/assets/ride-categories/envios.svg",\n};',
  'const categoryArtwork: Record<RideCategoryCode, string> = {\n  carros: "./assets/ride-categories/carros.svg",\n  motos: "./assets/ride-categories/motos.svg",\n  fretes: "./assets/ride-categories/fretes.svg",\n  guincho: "./assets/ride-categories/guincho.svg",\n  envios: "./assets/ride-categories/envios.svg",\n};',
  'corridas: artes de categorias usam caminho relativo ao módulo do Superapp',
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
  '}: AppShellProps) {\n  const pathname = useLocation().pathname;\n  const navigate = useNavigate();\n  const showBottomNavigation =\n    pathname !== "/inicio" &&\n    !superappJourneyRoutesWithoutBottomNav.includes(pathname) &&\n    !pathname.startsWith("/corrida/");\n\n  return (',
  'corridas: AppShell decide onde manter rodapé sem invadir jornada ativa',
);

replaceRequired(
  '.work/corridas/src/components/layout/AppShell.tsx',
  '        </main>\n      </div>',
  '        </main>\n        {showBottomNavigation ? (\n          <nav\n            aria-label="Navegação inferior"\n            className="app-safe-x shrink-0 border-t border-white/10 bg-black/98 pt-2 shadow-[0_-12px_30px_rgba(0,0,0,.55)]"\n            style={{ paddingBottom: "max(8px, var(--app-safe-bottom))" }}\n          >\n            <div className="grid grid-cols-5 gap-1">\n              {superappBottomNavItems.map(({ label, icon: Icon, to }) => {\n                const isActive =\n                  pathname === to || (to === "/corridas" && pathname.startsWith("/corridas/"));\n                return (\n                  <button\n                    key={label}\n                    type="button"\n                    onClick={() => void navigate({ to })}\n                    aria-current={isActive ? "page" : undefined}\n                    className={cn(\n                      "app-pressable flex min-h-[58px] flex-col items-center justify-center gap-1 rounded-xl text-[9px] font-bold",\n                      isActive ? "text-apois-yellow" : "text-zinc-500",\n                    )}\n                  >\n                    <Icon size={21} />\n                    {label}\n                  </button>\n                );\n              })}\n            </div>\n          </nav>\n        ) : null}\n      </div>',
  'corridas: rodapé permanece em histórico, carteira, notificações, perfil e detalhes',
);

console.log('[OK] corridas: imagens de categorias e navegação inferior persistente corrigidas apenas em .work');
