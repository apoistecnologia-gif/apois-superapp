import { useEffect, useRef } from "react";

// APOIS_CV09_DELETION_FOCUS_V1
// Containment and background isolation for the two pre-existing custom deletion dialogs.
// This hook does not submit, call RPCs, alter sessions, or change navigation.
const FOCUSABLE = [
  'a[href]', 'button:not([disabled])', 'input:not([disabled])',
  'select:not([disabled])', 'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(",");

export function useApoisDeletionDialogFocus(open: boolean) {
  const dialogRef = useRef<HTMLElement | null>(null);
  const cancelRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const dialog = dialogRef.current;
    const cancel = cancelRef.current;
    if (!dialog || !cancel) return;
    const opener = document.activeElement instanceof HTMLElement
      ? document.activeElement : null;

    // Focus a safe, non-destructive action BEFORE hiding the background.
    cancel.focus({ preventScroll: true });
    const hidden: Array<{ element: HTMLElement; wasInert: boolean; previousAria: string | null }> = [];
    let current: HTMLElement = dialog;
    while (current.parentElement) {
      const parent: HTMLElement = current.parentElement;
      for (const sibling of Array.from(parent.children)) {
        if (sibling === current || !(sibling instanceof HTMLElement)) continue;
        hidden.push({
          element: sibling,
          wasInert: sibling.hasAttribute("inert"),
          previousAria: sibling.getAttribute("aria-hidden"),
        });
        sibling.setAttribute("inert", "");
        sibling.setAttribute("aria-hidden", "true");
      }
      if (parent === document.body) break;
      current = parent;
    }

    const getFocusable = () => Array.from(dialog.querySelectorAll<HTMLElement>(FOCUSABLE))
      .filter((el) => !el.hasAttribute("disabled") &&
        el.getAttribute("aria-hidden") !== "true" &&
        el.getClientRects().length > 0);

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        // Never close or submit while Cancel is disabled during processing.
        if (!cancel.disabled) {
          event.preventDefault();
          cancel.click();
        }
        return;
      }
      if (event.key !== "Tab") return;
      const focusable = getFocusable();
      if (!focusable.length) {
        event.preventDefault();
        dialog.focus({ preventScroll: true });
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement;
      if (!dialog.contains(active)) {
        event.preventDefault();
        (event.shiftKey ? last : first).focus({ preventScroll: true });
      } else if (event.shiftKey && active === first) {
        event.preventDefault();
        last.focus({ preventScroll: true });
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus({ preventScroll: true });
      }
    };

    const handleFocusIn = (event: FocusEvent) => {
      if (event.target instanceof Node && !dialog.contains(event.target)) {
        const first = getFocusable()[0] ?? cancel;
        if (!first.disabled) first.focus({ preventScroll: true });
        else dialog.focus({ preventScroll: true });
      }
    };

    document.addEventListener("keydown", handleKeyDown, true);
    document.addEventListener("focusin", handleFocusIn, true);
    return () => {
      document.removeEventListener("keydown", handleKeyDown, true);
      document.removeEventListener("focusin", handleFocusIn, true);
      for (const item of hidden.reverse()) {
        if (!item.wasInert) item.element.removeAttribute("inert");
        if (item.previousAria === null) item.element.removeAttribute("aria-hidden");
        else item.element.setAttribute("aria-hidden", item.previousAria);
      }
      if (opener?.isConnected) opener.focus({ preventScroll: true });
    };
  }, [open]);

  return { dialogRef, cancelRef };
}
