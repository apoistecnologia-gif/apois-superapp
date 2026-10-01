import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
const workspace = process.env.APOIS_CORRIDAS_WORKSPACE || '.work/corridas';

function patch(relativePath, transform, verify, label) {
  const path = resolve(root, workspace, relativePath);
  const before = readFileSync(path, 'utf8');
  const after = transform(before);
  if (!verify(after)) throw new Error(`[FAIL] ${label}: contrato final não confirmado`);
  if (after !== before) writeFileSync(path, after, 'utf8');
  console.log(`[OK] ${label}${after === before ? ' (já aplicado)' : ''}`);
}

patch(
  'src/components/ui/bottom-sheet/BottomSheet.tsx',
  (source) => {
    let next = source;

    if (!next.includes('keyboardStable?: boolean;')) {
      next = next.replace(
        '  /** Limite de altura opcional. */\n  maxHeight?: string;\n}',
        '  /** Limite de altura opcional. */\n  maxHeight?: string;\n  /** Mantém o painel estável quando o teclado virtual altera o viewport. */\n  keyboardStable?: boolean;\n}',
      );
    }

    if (!next.includes('keyboardStable = false,')) {
      next = next.replace(
        '  height,\n  maxHeight,\n}) => {',
        '  height,\n  maxHeight,\n  keyboardStable = false,\n}) => {',
      );
    }

    next = next.replace(
      '            initial={{ y: "100%" }}\n            animate={controls}\n            exit={{ y: "100%" }}',
      '            initial={keyboardStable ? false : { y: "100%" }}\n            animate={keyboardStable ? { y: 0 } : controls}\n            exit={keyboardStable ? undefined : { y: "100%" }}',
    );

    next = next.replace(
      '              "fixed bottom-0 left-1/2 z-[60] flex w-full max-w-[430px] -translate-x-1/2 flex-col",',
      '              keyboardStable\n                ? "fixed top-[max(var(--app-safe-top),0px)] left-1/2 z-[60] flex w-full max-w-[430px] -translate-x-1/2 flex-col"\n                : "fixed bottom-0 left-1/2 z-[60] flex w-full max-w-[430px] -translate-x-1/2 flex-col",',
    );

    next = next.replace(
      '              height: isPersistentMapSheet ? "calc(100dvh - 168px)" : height,\n              maxHeight: isPersistentMapSheet\n                ? "calc(100dvh - 148px)"\n                : maxHeight ?? "calc(100dvh - max(16px, var(--app-safe-top)) - 8px)",',
      '              height: keyboardStable\n                ? "85svh"\n                : isPersistentMapSheet\n                  ? "calc(100dvh - 168px)"\n                  : height,\n              maxHeight: keyboardStable\n                ? "85svh"\n                : isPersistentMapSheet\n                  ? "calc(100dvh - 148px)"\n                  : maxHeight ?? "calc(100dvh - max(16px, var(--app-safe-top)) - 8px)",',
    );

    return next;
  },
  (source) =>
    source.includes('keyboardStable?: boolean;') &&
    source.includes('keyboardStable = false') &&
    source.includes('initial={keyboardStable ? false : { y: "100%" }}') &&
    source.includes('animate={keyboardStable ? { y: 0 } : controls}') &&
    source.includes('keyboardStable') &&
    source.includes('"85svh"'),
  'Corridas: BottomSheet suporta modo estável com teclado sem reposicionar a tela',
);

patch(
  'src/features/destination/DestinationSearchScreen.tsx',
  (source) => {
    let next = source;

    next = next.replace(
      '        preventClose={isSelecting || isResolvingMap}\n      >',
      '        preventClose={isSelecting || isResolvingMap}\n        keyboardStable\n      >',
    );

    return next;
  },
  (source) =>
    source.includes('<BottomSheet') &&
    source.includes('keyboardStable') &&
    source.includes('className="relative flex min-h-0 flex-1 flex-col overflow-hidden') &&
    source.includes('className="app-scroll mt-2 min-h-0 flex-1 pb-4"'),
  'Corridas: busca de destino usa BottomSheet estável durante digitação',
);

console.log('[OK] Corridas: tela de endereço estabilizada para teclado Android sem alterar o source protegido.');
