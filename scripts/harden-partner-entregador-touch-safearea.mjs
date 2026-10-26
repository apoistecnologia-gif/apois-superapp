import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
const workspace = process.env.APOIS_ENTREGAS_WORKSPACE || '.work/partner-entregador';

function patch(relativePath, transform, verify, label) {
  const path = resolve(root, workspace, relativePath);
  const before = readFileSync(path, 'utf8');
  const after = transform(before);
  const result = verify(after);
  if (result !== true) {
    const detail = typeof result === 'string' && result ? ` (${result})` : '';
    throw new Error(`[FAIL] ${label}: contrato esperado não encontrado em ${relativePath}${detail}`);
  }
  if (after !== before) writeFileSync(path, after, 'utf8');
  console.log(`[OK] ${label}${after === before ? ' (já aplicado)' : ''}`);
}

function normalizeClassList(classes) {
  return String(classes).replace(/\s+/g, ' ').trim();
}

function ensureClasses(classes, required) {
  const current = normalizeClassList(classes).split(' ').filter(Boolean);
  const set = new Set(current);
  for (const item of required) set.add(item);
  return [...set].join(' ');
}

function replaceClassToken(classes, from, to) {
  return normalizeClassList(classes)
    .split(' ')
    .filter(Boolean)
    .map((token) => (token === from ? to : token))
    .join(' ');
}

function removeClassTokens(classes, tokens) {
  const blocked = new Set(tokens);
  return normalizeClassList(classes)
    .split(' ')
    .filter((token) => token && !blocked.has(token))
    .join(' ');
}

patch(
  'src/components/CourierPremiumViews.tsx',
  (source) => source
    .replace(
      'className={`relative h-9 w-[4.15rem] shrink-0 rounded-full border transition active:scale-95 disabled:opacity-50 ${online ?',
      'className={`relative h-12 w-[4.8rem] shrink-0 rounded-full border transition active:scale-95 disabled:opacity-50 ${online ?',
    )
    .replace(
      'className={`absolute top-1 grid h-7 w-7 place-items-center rounded-full shadow-lg transition-all ${online ? "left-[2.08rem] bg-black text-primary" : "left-1 bg-zinc-600 text-zinc-300"}`}',
      'className={`absolute top-1.5 grid h-9 w-9 place-items-center rounded-full shadow-lg transition-all ${online ? "left-[2.25rem] bg-black text-primary" : "left-1.5 bg-zinc-600 text-zinc-300"}`}',
    )
    .replace(
      'className="grid h-10 w-10 place-items-center rounded-full border border-zinc-800 bg-black text-zinc-400 active:scale-95"',
      'className="grid h-11 w-11 place-items-center rounded-full border border-zinc-800 bg-black text-zinc-400 active:scale-95"',
    ),
  (source) =>
    /relative\s+h-12\s+w-\[4\.8rem\]/.test(source) &&
    /top-1\.5\s+grid\s+h-9\s+w-9/.test(source) &&
    /grid\s+h-11\s+w-11\s+place-items-center\s+rounded-full/.test(source),
  'entregador: controles principais respeitam alvo de toque mínimo',
);

patch(
  'src/components/CourierPanels.tsx',
  (source) => {
    let next = source;
    next = next.replace('{ id: "history", label: "Corridas", icon: Bike, onClick: onHistory },', '{ id: "history", label: "Entregas", icon: Bike, onClick: onHistory },');
    next = next.replace('      <PanelHeader title="Corridas" onClose={onClose} />', '      <PanelHeader title="Entregas" onClose={onClose} />');
    next = next.replace('          <h1 className="mt-1 text-2xl font-black">Corridas</h1>', '          <h1 className="mt-1 text-2xl font-black">Entregas</h1>');

    next = next.replace(/<nav\b([\s\S]{0,900}?)className="([^"]*)"([\s\S]{0,200}?)>/g, (tag, before, classes, after) => {
      if (!classes.includes('fixed') || !classes.includes('bottom-0') || (!classes.includes('grid') && !classes.includes('border-t'))) return tag;
      let value = replaceClassToken(classes, 'pb-[max(0.65rem,env(safe-area-inset-bottom))]', 'pb-[max(44px,env(safe-area-inset-bottom))]');
      value = replaceClassToken(value, 'pt-2', 'pt-2.5');
      return `<nav${before}className="${value}"${after}>`;
    });

    next = next.replace(/className="([^"]*mx-auto[^"]*grid-cols-4[^"]*)"/g, (_match, classes) => {
      const value = ensureClasses(classes, ['min-h-[82px]']);
      return `className="${value}"`;
    });

    next = next.replace(/className=\{`([^`]*relative flex[^`]*)`\}/g, (match, classes) => {
      if (!classes.includes('flex-col') || !classes.includes('items-center')) return match;
      let value = replaceClassToken(classes, 'min-h-[3.7rem]', 'min-h-[64px]');
      value = replaceClassToken(value, 'text-[10px]', 'text-xs');
      value = ensureClasses(value, ['min-w-0', 'px-1']);
      return `className={\`${value}\`}`;
    });

    next = next.replace(/className=\{`([^`]*grid[^`]*place-items-center[^`]*)`\}/g, (match, classes) => {
      if (!classes.includes('rounded-xl') || !classes.includes('transition')) return match;
      let value = replaceClassToken(classes, 'h-8', 'h-9');
      value = replaceClassToken(value, 'w-10', 'w-11');
      return `className={\`${value}\`}`;
    });

    next = next.replace(/className=\{`([^`]*h-5[^`]*w-5[^`]*)`\}/g, (_match, classes) => {
      let value = replaceClassToken(classes, 'h-5', 'h-6');
      value = replaceClassToken(value, 'w-5', 'w-6');
      return `className={\`${value}\`}`;
    });

    next = next.replace(/className="([^"]*sticky\s+top-0\s+z-40[^"]*)"/g, (match, classes) => {
      if (!classes.includes('grid-cols-[2.75rem_1fr_2.75rem]')) return match;
      let value = replaceClassToken(classes, 'min-h-20', 'min-h-[5.25rem]');
      value = replaceClassToken(value, 'pt-[env(safe-area-inset-top)]', 'pt-[max(env(safe-area-inset-top),0.65rem)]');
      value = ensureClasses(value, ['pb-2']);
      return `className="${value}"`;
    });
    return next;
  },
  (source) => {
    const failures = [];
    if (!/label:\s*"Entregas"/.test(source)) failures.push('nomenclatura Entregas');
    if (!/<PanelHeader\s+title="Entregas"/.test(source)) failures.push('cabeçalho Entregas');
    if (!/min-h-\[82px\]/.test(source)) failures.push('altura do rodapé');
    if (!/min-h-\[64px\]/.test(source)) failures.push('alvo dos itens');
    if (!/h-9\s+w-11|w-11\s+h-9/.test(source)) failures.push('alvo do ícone');
    if (!/h-6\s+w-6|w-6\s+h-6/.test(source)) failures.push('ícone do rodapé');
    const panelHeader = source.match(/<header\b[\s\S]{0,900}?grid-cols-\[2\.75rem_1fr_2\.75rem\][\s\S]{0,900}?>/)?.[0] ?? '';
    if (!panelHeader || !panelHeader.includes('pt-[max(env(safe-area-inset-top),0.65rem)]')) failures.push('safe-area do painel');
    if (!/pb-\[max\(44px,env\(safe-area-inset-bottom\)\)\]/.test(source)) failures.push('safe-area do rodapé');
    return failures.length ? failures.join(', ') : true;
  },
  'entregador: rodapé usa nomenclatura Entregas, alvos confortáveis e safe-area correta',
);

patch(
  'src/components/CourierRouteMap.tsx',
  (source) => {
    let next = source;
    const routeButtonMatch = next.match(/<button\b[\s\S]{0,900}?onClick=\{openNavigation\}[\s\S]{0,900}?<\/button>/);
    if (routeButtonMatch) {
      const original = routeButtonMatch[0];
      const updated = original.replace(/className="([^"]*)"/, (_m, classes) => {
        let value = normalizeClassList(classes)
          .replace(/\bh-10\b/g, '')
          .replace(/\bmin-h-10\b/g, '')
          .replace(/\bpx-3\b/g, 'px-3.5')
          .replace(/text-\[11px\]/g, 'text-xs');
        value = normalizeClassList(value);
        if (!/\b(?:min-h-11|h-11|h-12)\b/.test(value)) value = ensureClasses(value, ['min-h-11']);
        if (!/\b(?:inline-flex|flex|grid)\b/.test(value)) value = ensureClasses(value, ['inline-flex']);
        return `className="${value}"`;
      });
      next = next.replace(original, updated);
    }

    next = next
      .replace(
        'expanded ? "h-[36rem] min-h-[72vh] max-h-[44rem]" : "h-[29rem] min-h-[62vh] max-h-[36rem]"',
        'expanded ? "h-[clamp(24rem,62dvh,36rem)]" : "h-[clamp(21rem,54dvh,31rem)]"',
      )
      .replace(/grid h-10 w-10 place-items-center rounded-full border border-accent\/40/g, 'grid h-11 w-11 place-items-center rounded-full border border-accent/40')
      .replace(/className="([^"]*)"(?=[^>]*aria-label="Recentralizar mapa")/g, (_m, classes) => {
        let value = replaceClassToken(classes, 'h-10', 'h-11');
        value = replaceClassToken(value, 'w-10', 'w-11');
        value = ensureClasses(value, ['h-11', 'w-11']);
        return `className="${value}"`;
      });
    return next;
  },
  (source) => {
    const routeButton = source.match(/<button\b[\s\S]{0,900}?onClick=\{openNavigation\}[\s\S]{0,900}?<\/button>/)?.[0] ?? '';
    const recenterButton = source.match(/<button\b[\s\S]{0,900}?aria-label="Recentralizar mapa"[\s\S]{0,900}?<\/button>/)?.[0] ?? '';
    const failures = [];
    if (!routeButton) failures.push('botão Rotas');
    else if (!/\b(?:min-h-11|h-11|h-12)\b/.test(routeButton)) failures.push('alvo do botão Rotas');
    if (!source.includes('h-[clamp(24rem,62dvh,36rem)]')) failures.push('altura expandida');
    if (!source.includes('h-[clamp(21rem,54dvh,31rem)]')) failures.push('altura compacta');
    if (!recenterButton) failures.push('botão Recentralizar');
    else if (!/\bh-11\b/.test(recenterButton) || !/\bw-11\b/.test(recenterButton)) failures.push('alvo do Recentralizar');
    return failures.length ? failures.join(', ') : true;
  },
  'entregador: mapa de rota adapta altura à tela e controles de rota/recentralizar têm alvo tocável',
);

patch(
  'src/routes/courier.tsx',
  (source) => {
    let next = source;

    next = next.replace(/className="([^"]*\bmin-h-dvh\b[^"]*\bplace-items-center\b[^"]*)"/g, (_match, classes) => {
      let value = removeClassTokens(classes, [
        'p-5',
        'pt-[max(env(safe-area-inset-top),1.25rem)]',
        'pb-[max(env(safe-area-inset-bottom),1.25rem)]',
      ]);
      value = ensureClasses(value, [
        'px-5',
        'pt-[max(env(safe-area-inset-top),1.25rem)]',
        'pb-[max(env(safe-area-inset-bottom),1.25rem)]',
      ]);
      return `className="${value}"`;
    });

    next = next.replace(/className="([^"]*\bsticky\b[^\"]*\btop-0\b[^\"]*\bz-40\b[^\"]*)"/g, (match, classes) => {
      if (!classes.includes('grid-cols-[3rem_1fr_3rem]')) return match;
      let value = replaceClassToken(classes, 'min-h-20', 'min-h-[5.25rem]');
      value = replaceClassToken(value, 'pt-[env(safe-area-inset-top)]', 'pt-[max(env(safe-area-inset-top),0.65rem)]');
      value = ensureClasses(value, ['pb-2']);
      return `className="${value}"`;
    });

    next = next
      .replace(/if\s*\(historyOpen\s*\)\s*\{/g, 'if (historyOpen && !activeJob) {')
      .replace(/if\s*\(financeOpen\s*\)\s*\{/g, 'if (financeOpen && !activeJob) {')
      .replace(/if\s*\(profileOpen\s*\)\s*\{/g, 'if (profileOpen && !activeJob) {');

    const mainIndex = next.indexOf('<main');
    if (mainIndex > 0) {
      const beforeMain = next.slice(0, mainIndex);
      const afterMain = next.slice(mainIndex);
      const profileButtonPattern = /<button\b[\s\S]{0,900}?(?:aria-label=(?:"Abrir perfil"|\{[^}]*Perfil[^}]*\})|onClick=\{\(\) =>[^}]*setProfileOpen\(true\)[^}]*\})[\s\S]{0,900}?<\/button>/;
      const profileButton = beforeMain.match(profileButtonPattern)?.[0] ?? '';
      let guardedBeforeMain = beforeMain;

      if (profileButton) {
        let updated = profileButton;
        if (/onClick=\{\(\) => setProfileOpen\(true\)\}/.test(updated)) {
          updated = updated.replace(
            'onClick={() => setProfileOpen(true)}',
            'onClick={() => { if (!activeJob && !completedJob) setProfileOpen(true); }}',
          );
        } else if (/onClick=\{\(\) => !activeJob && setProfileOpen\(true\)\}/.test(updated)) {
          updated = updated.replace(
            'onClick={() => !activeJob && setProfileOpen(true)}',
            'onClick={() => { if (!activeJob && !completedJob) setProfileOpen(true); }}',
          );
        }

        if (/disabled=\{Boolean\(activeJob\)\}/.test(updated)) {
          updated = updated.replace('disabled={Boolean(activeJob)}', 'disabled={Boolean(activeJob || completedJob)}');
        } else if (!/disabled=\{Boolean\(activeJob\s*\|\|\s*completedJob\)\}/.test(updated)) {
          updated = updated.replace(/onClick=\{[^\n]+\}/, '$&\n          disabled={Boolean(activeJob || completedJob)}');
        }

        if (/aria-label="Abrir perfil"/.test(updated)) {
          updated = updated.replace(
            'aria-label="Abrir perfil"',
            'aria-label={activeJob || completedJob ? "Perfil indisponível durante a entrega" : "Abrir perfil"}',
          );
        }

        updated = updated.replace(/className="([^"]*)"/, (_m, classes) => {
          const value = ensureClasses(classes, ['disabled:cursor-not-allowed', 'disabled:opacity-40']);
          return `className="${value}"`;
        });
        guardedBeforeMain = beforeMain.replace(profileButton, updated);
      }
      next = guardedBeforeMain + afterMain;
    }

    next = next.replace(/<main\b([^>]*)>/, (tag, attrs) => {
      let updatedAttrs = attrs;
      if (!/data-active-job=/.test(updatedAttrs)) {
        updatedAttrs = ` data-active-job={activeJob ? "true" : "false"}${updatedAttrs}`;
      }
      updatedAttrs = updatedAttrs.replace(/className="([^"]*)"/, (_m, classes) => {
        let value = normalizeClassList(classes);
        if (!value.includes('data-[active-job=true]:pb-[max(52px,env(safe-area-inset-bottom))]')) {
          value = ensureClasses(value, ['data-[active-job=true]:pb-[max(52px,env(safe-area-inset-bottom))]']);
        }
        return `className="${value}"`;
      });
      return `<main${updatedAttrs}>`;
    });

    const homeNav = /\n\s*<CourierBottomNav\s+[\s\S]{0,1400}?active="home"[\s\S]{0,1800}?\/>/;
    const navMatch = next.match(homeNav)?.[0] ?? '';
    if (navMatch && !/\{!activeJob(?:\s*&&\s*!completedJob)?\s*\?\s*\(/.test(next.slice(Math.max(0, next.indexOf(navMatch) - 80), next.indexOf(navMatch) + navMatch.length + 80))) {
      next = next.replace(navMatch, `\n      {!activeJob && !completedJob ? (${navMatch.trim()}\n      ) : null}`);
    }

    return next;
  },
  (source) => {
    const failures = [];
    const hasLoadingSafeArea = /min-h-dvh[^\"]*pt-\[max\(env\(safe-area-inset-top\),1\.25rem\)\][^\"]*pb-\[max\(env\(safe-area-inset-bottom\),1\.25rem\)\]|min-h-dvh[^\"]*pb-\[max\(env\(safe-area-inset-bottom\),1\.25rem\)\][^\"]*pt-\[max\(env\(safe-area-inset-top\),1\.25rem\)\]/.test(source);
    if (!hasLoadingSafeArea) failures.push('safe-area dos estados de tela');
    if (!/grid-cols-\[3rem_1fr_3rem\][^\"]*pt-\[max\(env\(safe-area-inset-top\),0\.65rem\)\]|pt-\[max\(env\(safe-area-inset-top\),0\.65rem\)\][^\"]*grid-cols-\[3rem_1fr_3rem\]/.test(source)) failures.push('safe-area do cabeçalho');
    if (!/if\s*\(historyOpen\s*&&\s*!activeJob\)/.test(source)) failures.push('guard do histórico');
    if (!/if\s*\(financeOpen\s*&&\s*!activeJob\)/.test(source)) failures.push('guard financeiro');
    if (!/if\s*\(profileOpen\s*&&\s*!activeJob\)/.test(source)) failures.push('guard do perfil');
    const hasStrongProfileGuard = /disabled=\{Boolean\(activeJob\s*\|\|\s*completedJob\)\}/.test(source) && /if\s*\(!activeJob\s*&&\s*!completedJob\)\s*setProfileOpen\(true\)/.test(source);
    const hasBasicProfileGuard = /disabled=\{Boolean\(activeJob\)\}/.test(source) && /!activeJob\s*&&\s*setProfileOpen\(true\)/.test(source);
    if (!hasStrongProfileGuard && !hasBasicProfileGuard) failures.push('bloqueio do perfil durante entrega');
    if (!/data-active-job=\{activeJob\s*\?\s*"true"\s*:\s*"false"\}/.test(source)) failures.push('estado estrutural do main');
    if (!/data-\[active-job=true\]:pb-\[max\(52px,env\(safe-area-inset-bottom\)\)\]/.test(source)) failures.push('safe-area inferior da entrega ativa');
    if (!/\{!activeJob(?:\s*&&\s*!completedJob)?\s*\?\s*\([\s\S]{0,1800}?<CourierBottomNav[\s\S]{0,1400}?active="home"/.test(source)) failures.push('rodapé HOME condicionado à ausência de entrega ativa');
    return failures.length ? failures.join(', ') : true;
  },
  'entregador: tela principal respeita safe-area e não abre painéis/rodapé durante entrega ativa',
);

patch(
  'src/components/CourierCompletionSupport.tsx',
  (source) => source
    .replace(
      'className="w-full max-w-lg rounded-[2rem] border border-accent/30 bg-[#090909] p-4 pb-[max(env(safe-area-inset-bottom),1rem)] text-white shadow-[0_-20px_70px_rgba(0,0,0,0.75)]"',
      'className="max-h-[calc(100dvh-max(env(safe-area-inset-top),12px))] w-full max-w-lg overflow-y-auto overscroll-contain rounded-[2rem] border border-accent/30 bg-[#090909] px-4 pt-4 pb-[max(52px,env(safe-area-inset-bottom))] text-white shadow-[0_-20px_70px_rgba(0,0,0,0.75)]"',
    ),
  (source) =>
    source.includes('max-h-[calc(100dvh-max(env(safe-area-inset-top),12px))]') &&
    source.includes('overflow-y-auto overscroll-contain') &&
    source.includes('pb-[max(52px,env(safe-area-inset-bottom))]'),
  'entregador: suporte durante entrega permanece utilizável com teclado e barra Android',
);

console.log(`[OK] ergonomia, foco operacional, mapas, nomenclatura e safe-area do Entregador Parceiro endurecidas em ${workspace}`);
