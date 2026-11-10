import { useEffect, useRef, type RefObject } from 'react';

/**
 * UX-C focus-trap for admin-ui modal dialogs.
 *
 * Attach the returned ref to the dialog's outermost focusable
 * container. While `active` is true the hook:
 *
 *   • moves focus to the first focusable descendant on mount,
 *   • intercepts Tab / Shift+Tab so focus cycles inside the
 *     dialog instead of leaking back to the page,
 *   • calls `onClose` on Escape,
 *   • restores focus to the element that was focused before the
 *     dialog opened when the dialog unmounts.
 *
 * WCAG 2.2 §2.1.2 (no-keyboard-trap, inverse — a *managed* trap
 * on a modal is required to keep assistive tech inside the modal
 * surface until it's dismissed) and §2.4.11 (focus not obscured).
 *
 * Pre-UX-C every admin-ui dialog relied on an Escape listener
 * alone; Tab could land on controls behind the backdrop. This
 * hook closes that gap without pulling in a focus-trap library.
 */
export interface FocusTrapOptions {
  readonly active: boolean;
  readonly onClose?: () => void;
  /** If true, the initial focus skips the first focusable element
   *  and lands on the container itself. Useful for dialogs whose
   *  first child is a close button — operators landing there and
   *  hitting Enter would dismiss the dialog they just opened. */
  readonly focusContainer?: boolean;
}

const FOCUSABLE =
  'a[href], area[href], button:not([disabled]), input:not([disabled]), ' +
  'select:not([disabled]), textarea:not([disabled]), ' +
  '[tabindex]:not([tabindex="-1"])';

export function useFocusTrap<T extends HTMLElement>(
  { active, onClose, focusContainer = false }: FocusTrapOptions,
): RefObject<T> {
  const ref = useRef<T>(null);
  const restoreRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!active) return undefined;
    const container = ref.current;
    if (!container) return undefined;

    // Remember where focus was so we can hand it back when the
    // dialog closes.
    restoreRef.current = (document.activeElement instanceof HTMLElement)
      ? document.activeElement
      : null;

    if (focusContainer) {
      // Make the container itself focusable without exposing it to
      // sequential Tab (tabindex -1 does both).
      if (!container.hasAttribute('tabindex')) {
        container.setAttribute('tabindex', '-1');
      }
      container.focus();
    } else {
      const first = container.querySelector<HTMLElement>(FOCUSABLE);
      if (first) first.focus();
      else container.focus();
    }

    function onKey(e: KeyboardEvent): void {
      if (e.key === 'Escape' && onClose) {
        e.stopPropagation();
        onClose();
        return;
      }
      if (e.key !== 'Tab') return;
      if (!container) return;
      const items = Array.from(
        container.querySelectorAll<HTMLElement>(FOCUSABLE))
        .filter((el) => !el.hasAttribute('data-focus-skip'));
      if (items.length === 0) {
        e.preventDefault();
        return;
      }
      const first = items[0];
      const last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }

    container.addEventListener('keydown', onKey);
    return () => {
      container.removeEventListener('keydown', onKey);
      // Return focus to the opener if it's still in the document.
      const prev = restoreRef.current;
      if (prev && document.contains(prev)) prev.focus();
    };
  }, [active, onClose, focusContainer]);

  return ref;
}
