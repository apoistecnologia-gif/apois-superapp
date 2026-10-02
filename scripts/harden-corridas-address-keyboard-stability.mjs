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
                ? "relative z-[60] flex h-full min-h-0 w-full flex-col"
                : "fixed bottom-0 left-1/2 z-[60] flex w-full max-w-[430px] -translate-x-1/2 flex-col",
              "overflow-hidden rounded-t-[28px] border-x border-t border-white/5 bg-[#121212] shadow-[0_-12px_40px_rgba(0,0,0,0.6)]",
            )}
            style={{
              height: keyboardStable
                ? "100%"
                : isPersistentMapSheet
                  ? "calc(100dvh - 168px)"
                  : height,
              maxHeight: keyboardStable
                ? "100%"
                : isPersistentMapSheet
                  ? "calc(100dvh - 148px)"
                  : maxHeight ?? "calc(100dvh - max(16px, var(--app-safe-top)) - 8px)",
              paddingBottom: keyboardStable
                ? 0
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

            <div
              className={cn(
                "min-h-0 flex-1 px-3.5 pb-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
                keyboardStable
                  ? "flex flex-col overflow-hidden"
                  : "overflow-y-auto overscroll-contain",
              )}
            >
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
    source.includes('? "100%"') &&
    source.includes('keyboardStable') &&
    source.includes('? "flex flex-col overflow-hidden"') &&
    source.includes(': "overflow-y-auto overscroll-contain"') &&
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
      // O BottomSheet canônico usa o viewport real da rota, sem camada fixed que
      // brigue com o adjustResize do Android. Na rota legada basta ativar esse modo.
      // Fazemos isso sem depender da ordem das props ou das classes Tailwind.
      if (/<BottomSheet\\b[^>]*\\bkeyboardStable\\b[^>]*>/.test(source)) {
        return source;
      }

      const next = source.replace(
        /<BottomSheet\\b([^>]*?)>/,
        (_match, props) => `<BottomSheet${props} keyboardStable>`,
      );

      // Alguns hardeners anteriores já convertem esta rota para um wrapper/
      // viewport estável e removem o BottomSheet local. Nesse caso, não force
      // uma estrutura antiga de volta; apenas preserve o contrato já aplicado.
      return next;
    },
    (source) => {
      const stableSheet = /<BottomSheet\\b[^>]*\\bkeyboardStable\\b[^>]*>/.test(source);
      const stableViewport =
        source.includes('relative min-h-0 flex-1 overflow-hidden') ||
        source.includes('h-[100svh]') ||
        source.includes('DestinationSearchScreen');
      return stableSheet || stableViewport;
    },
    'Corridas: busca de destino fica estável durante digitação e abertura do teclado',
  );
}

console.log('[OK] Corridas: tela de endereço estabilizada para teclado Android sem alterar o source protegido.');
