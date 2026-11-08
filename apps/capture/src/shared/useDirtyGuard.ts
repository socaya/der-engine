import { useEffect, useRef } from 'react';

/**
 * Warn before abandoning uncommitted changes
 * (requirements doc §UI-005, §FR-006 — explicit Save draft must be
 * reliable; navigating away before it fires is the operator's
 * biggest footgun). Two guards:
 *
 *   • {@code beforeunload} listener — the browser's native prompt
 *     when the operator closes the tab or hits a browser-level
 *     back/forward.
 *   • {@link confirmLeave} — wrap in-app actions that would
 *     throw away values (Cancel, Back) in this check so the
 *     operator sees a modal {@code window.confirm}. Returns
 *     {@code true} when it's safe to proceed.
 *
 * The hook tracks {@code dirty} through a ref so the event
 * listener always reads the latest value without re-attaching on
 * every keystroke.
 */
export function useDirtyGuard(dirty: boolean): {
  confirmLeave: (message?: string) => boolean;
} {
  const dirtyRef = useRef(dirty);
  dirtyRef.current = dirty;

  useEffect(() => {
    const onBeforeUnload = (e: BeforeUnloadEvent): void => {
      if (!dirtyRef.current) return;
      // Spec says only preventDefault + returnValue trigger the
      // browser-native prompt; the exact string is ignored by
      // modern browsers.
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, []);

  function confirmLeave(message?: string): boolean {
    if (!dirtyRef.current) return true;
    const prompt = message
      ?? 'You have unsaved changes. Leave anyway?';
    return window.confirm(prompt);
  }

  return { confirmLeave };
}
