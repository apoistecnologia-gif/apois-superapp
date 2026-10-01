import { existsSync, readFileSync, writeFileSync } from 'node:fs';
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
      if (next.includes('  maxHeight?: string;\n}')) {
        next = next.replace(
          '  maxHeight?: string;\n}',
          '  maxHeight?: string;\n  keyboardStable?: boolean;\n}',
        );
      } else {
        next = next.replace(
          '  showBackdrop?: boolean;\n}',
          '  showBackdrop?: boolean;\n  keyboardStable?: boolean;\n}',
        );
      }
    }

    if (!next.includes('keyboardStable = false,')) {
      if (next.includes('  height,\n  maxHeight,\n}) => {')) {
        next = next.replace(
          '  height,\n  maxHeight,\n}) => {',
          '  height,\n  maxHeight,\n  keyboardStable = false,\n}) => {',
        );
      } else {
        next = next.replace(
          '  showBackdrop = true,\n}) => {',
          '  showBackdrop = true,\n  keyboardStable = false,\n}) => {',
        );
      }
    }

    next = next.replace(
      '            initial={{ y: "100%" }}\n            animate={controls}\n            exit={{ y: "100%" }}',
      '            initial={keyboardStable ? false : { y: "100%" }}\n            animate={keyboardStable ? { y: 0 } : controls}\n            exit={keyboardStable ? undefined : { y: "100%" }}',
    );

    next = next.replace(
      '            drag="y"\n            dragControls={dragControls}\n            dragListener={false}',
      '            drag={keyboardStable ? false : "y"}\n            dragControls={dragControls}\n            dragListener={false}',
    );

    next = next.replace(
      '              "fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[430px] z-[60]",',
      '              keyboardStable\n                ? "fixed top-[max(env(safe-area-inset-top),0px)] left-1/2 -translate-x-1/2 w-full max-w-[430px] z-[60]"\n                : "fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[430px] z-[60]",',
    );

    next = next.replace(
      '              "fixed bottom-0 left-1/2 z-[60] flex w-full max-w-[430px] -translate-x-1/2 flex-col",',
      '              keyboardStable\n                ? "fixed top-[max(var(--app-safe-top),0px)] left-1/2 z-[60] flex w-full max-w-[430px] -translate-x-1/2 flex-col"\n                : "fixed bottom-0 left-1/2 z-[60] flex w-full max-w-[430px] -translate-x-1/2 flex-col",',
    );

    next = next.replace(
      '              "h-auto max-h-[85vh]",',
      '              keyboardStable ? "h-[85svh] max-h-[85svh]" : "h-auto max-h-[85vh]",',
    );

    next = next.replace(
      '              height: isPersistentMapSheet ? "calc(100dvh - 168px)" : height,\n              maxHeight: isPersistentMapSheet\n                ? "calc(100dvh - 148px)"\n                : maxHeight ?? "calc(100dvh - max(16px, var(--app-safe-top)) - 8px)",',
      '              height: keyboardStable\n                ? "85svh"\n                : isPersistentMapSheet\n                  ? "calc(100dvh - 168px)"\n                  : height,\n              maxHeight: keyboardStable\n                ? "85svh"\n                : isPersistentMapSheet\n                  ? "calc(100dvh - 148px)"\n                  : maxHeight ?? "calc(100dvh - max(16px, var(--app-safe-top)) - 8px)",',
    );

    next = next.replace(
      '            style={{ paddingBottom: "calc(72px + env(safe-area-inset-bottom))" }}',
      '            style={{ paddingBottom: keyboardStable ? "max(env(safe-area-inset-bottom), 12px)" : "calc(72px + env(safe-area-inset-bottom))" }}',
    );

    next = next.replace(
      '              onPointerDown={(e) => dragControls.start(e)}',
      '              onPointerDown={(e) => { if (!keyboardStable) dragControls.start(e); }}',
    );

    return next;
  },
  (source) =>
    source.includes('keyboardStable?: boolean;') &&
    source.includes('keyboardStable = false') &&
    source.includes('initial={keyboardStable ? false : { y: "100%" }}') &&
    source.includes('animate={keyboardStable ? { y: 0 } : controls}') &&
    (source.includes('h-[85svh] max-h-[85svh]') || source.includes('"85svh"')),
  'Corridas: BottomSheet suporta modo estável com teclado sem reposicionar a tela',
);

const modernScreen = resolve(root, workspace, 'src/features/destination/DestinationSearchScreen.tsx');

if (existsSync(modernScreen)) {
  patch(
    'src/features/destination/DestinationSearchScreen.tsx',
    (source) => {
      let next = source;
      if (!next.includes('        keyboardStable\n')) {
        next = next.replace(
          '        preventClose={isSelecting || isResolvingMap}\n      >',
          '        preventClose={isSelecting || isResolvingMap}\n        keyboardStable\n      >',
        );
      }
      return next;
    },
    (source) =>
      source.includes('<BottomSheet') &&
      source.includes('keyboardStable') &&
      source.includes('min-h-0') &&
      source.includes('overflow-hidden'),
    'Corridas: busca de destino usa BottomSheet estável durante digitação',
  );
} else {
  patch(
    'src/routes/_authenticated.buscar-destino.tsx',
    (source) => {
      let next = source;

      next = next.replace(
        '<div className="flex flex-col min-h-screen bg-transparent relative">',
        '<div className="flex h-[100svh] min-h-0 flex-col overflow-hidden bg-transparent relative">',
      );

      next = next.replace(
        '<BottomSheet isOpen={isBottomSheetOpen} onClose={handleClose} preventClose={isSelecting}>',
        '<BottomSheet isOpen={isBottomSheetOpen} onClose={handleClose} preventClose={isSelecting} keyboardStable>',
      );

      next = next.replace(
        '<div className="flex flex-col h-full">',
        '<div className="flex h-full min-h-0 flex-col overflow-hidden">',
      );

      next = next.replace(
        '<div className="flex-1 mt-2">',
        '<div className="flex-1 min-h-0 mt-2 overflow-y-auto overscroll-contain">',
      );

      next = next.replace(
        'className="w-full h-14 pl-12 pr-12 bg-[#2a2a2a] border-2 border-yellow-500/30 focus:border-yellow-500 outline-none rounded-xl text-lg font-medium text-white placeholder:text-gray-500 transition-all"',
        'className="w-full h-14 pl-12 pr-12 bg-[#2a2a2a] border-2 border-yellow-500/30 focus:border-yellow-500 outline-none rounded-xl text-lg font-medium text-white placeholder:text-gray-500 transition-colors"',
      );

      return next;
    },
    (source) =>
      source.includes('h-[100svh]') &&
      source.includes('keyboardStable') &&
      source.includes('overflow-y-auto overscroll-contain') &&
      source.includes('transition-colors'),
    'Corridas: busca de destino fica estável durante digitação e abertura do teclado',
  );
}

console.log('[OK] Corridas: tela de endereço estabilizada para teclado Android sem alterar o source protegido.');
