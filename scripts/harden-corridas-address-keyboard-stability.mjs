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
  (_source) => `import React, { useEffect, useState } from "react";
import { AnimatePresence, motion, useAnimation, useDragControls } from "framer-motion";
import { cn } from "@/lib/utils";

interface BottomSheetProps {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
  title?: string;
  preventClose?: boolean;
  showBackdrop?: boolean;
  height?: string;
  maxHeight?: string;
  keyboardStable?: boolean;
}

export const BottomSheet: React.FC<BottomSheetProps> = ({
  isOpen,
  onClose,
  children,
  preventClose = false,
  showBackdrop = true,
  height,
  maxHeight,
  keyboardStable = false,
}) => {
  const controls = useAnimation();
  const dragControls = useDragControls();
  const [isClosing, setIsClosing] = useState(false);
  const isPersistentMapSheet = preventClose && !showBackdrop;

  useEffect(() => {
    if (isOpen) {
      setIsClosing(false);
      void controls.start({ y: 0 });
    }
  }, [isOpen, controls]);

  const handleDragEnd = async (_event: unknown, info: { offset: { y: number }; velocity: { y: number } }) => {
    if (keyboardStable) return;
    const shouldClose = info.offset.y > 100 || info.velocity.y > 500;
    if (shouldClose && !preventClose) {
      setIsClosing(true);
      await controls.start({ y: "100%" });
      onClose();
      return;
    }
    void controls.start({ y: 0 });
  };

  return (
    <AnimatePresence>
      {isOpen ? (
        <>
          {showBackdrop ? (
            <motion.button
              type="button"
              aria-label="Fechar painel"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={!preventClose ? onClose : undefined}
              className="fixed inset-0 z-40 bg-black/60"
            />
          ) : null}

          <motion.div
            initial={keyboardStable ? false : { y: "100%" }}
            animate={keyboardStable ? { y: 0 } : controls}
            exit={keyboardStable ? undefined : { y: "100%" }}
            transition={{ type: "spring", damping: 28, stiffness: 240 }}
            drag={keyboardStable ? false : "y"}
            dragControls={dragControls}
            dragListener={false}
            dragConstraints={{ top: 0 }}
            dragElastic={0.2}
            onDragEnd={handleDragEnd}
            className={cn(
              keyboardStable
                ? "fixed top-[max(env(safe-area-inset-top),0px)] left-1/2 z-[60] flex w-full max-w-[430px] -translate-x-1/2 flex-col"
                : "fixed bottom-0 left-1/2 z-[60] flex w-full max-w-[430px] -translate-x-1/2 flex-col",
              "overflow-hidden rounded-t-[28px] border-x border-t border-white/5 bg-[#121212] shadow-[0_-12px_40px_rgba(0,0,0,0.6)]",
            )}
            style={{
              height: keyboardStable
                ? "85svh"
                : isPersistentMapSheet
                  ? "calc(100dvh - 168px)"
                  : height,
              maxHeight: keyboardStable
                ? "85svh"
                : isPersistentMapSheet
                  ? "calc(100dvh - 148px)"
                  : maxHeight ?? "calc(100dvh - max(16px, var(--app-safe-top)) - 8px)",
              paddingBottom: keyboardStable
                ? "max(env(safe-area-inset-bottom), 12px)"
                : "max(12px, var(--app-safe-bottom))",
            }}
            aria-busy={isClosing}
          >
            <div
              className="flex w-full shrink-0 justify-center py-2.5"
              aria-hidden="true"
              onPointerDown={(event) => {
                if (!keyboardStable) dragControls.start(event);
              }}
            >
              <div className="h-1 w-9 rounded-full bg-gray-600" />
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3.5 pb-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {children}
            </div>
          </motion.div>
        </>
      ) : null}
    </AnimatePresence>
  );
};
`,
  (source) =>
    source.includes('keyboardStable?: boolean;') &&
    source.includes('keyboardStable = false') &&
    source.includes('initial={keyboardStable ? false : { y: "100%" }}') &&
    source.includes('drag={keyboardStable ? false : "y"}') &&
    source.includes('"85svh"') &&
    source.includes('if (!keyboardStable) dragControls.start(event);'),
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

      // A rota pinada já mudou de forma algumas vezes. Em vez de depender da
      // ordem exata das classes Tailwind, aplicamos apenas contratos estruturais.
      next = next.replace(
        /<div className="[^"]*min-h-screen[^"]*bg-transparent[^"]*relative[^"]*">/,
        '<div className="relative flex h-[100svh] min-h-0 flex-col overflow-hidden bg-transparent">',
      );

      // Adiciona o modo estável ao primeiro BottomSheet da jornada, preservando
      // todas as demais props, inclusive se outros hardeners já as alteraram.
      next = next.replace(
        /<BottomSheet\b([^>]*?)>/,
        (match, props) => /\bkeyboardStable\b/.test(props)
          ? match
          : `<BottomSheet${props} keyboardStable>`,
      );

      // Container interno precisa poder encolher quando o teclado abre.
      next = next.replace(
        /<div className="flex flex-col h-full">/,
        '<div className="flex h-full min-h-0 flex-col overflow-hidden">',
      );

      // A lista de resultados rola dentro do sheet, sem deslocar o viewport.
      next = next.replace(
        /<div className="flex-1 mt-2">/,
        '<div className="mt-2 min-h-0 flex-1 overflow-y-auto overscroll-contain">',
      );

      return next;
    },
    (source) => {
      const hasStableSheet =
        /<BottomSheet\b[^>]*\bkeyboardStable\b[^>]*>/.test(source);
      const hasStableViewport =
        source.includes('h-[100svh]') &&
        source.includes('min-h-0') &&
        source.includes('overflow-hidden');
      const hasInternalScroll =
        source.includes('overflow-y-auto') &&
        source.includes('overscroll-contain');

      return hasStableSheet && hasStableViewport && hasInternalScroll;
    },
    'Corridas: busca de destino fica estável durante digitação e abertura do teclado',
  );
}

console.log('[OK] Corridas: tela de endereço estabilizada para teclado Android sem alterar o source protegido.');
