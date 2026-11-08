import { useEffect, useRef } from 'react';
import type { CaptureFormSection } from './model';

/**
 * Focus the first editable field inside the form on open
 * (requirements doc §DER-STYLE-004 — 'When users open a stage
 * or event, focus the first editable relevant field and
 * minimize navigation chrome'). Only fires once per
 * {@code openKey} change so typing in one field doesn't
 * get hijacked by rule-driven re-renders.
 *
 * @param sections  The current (effective) form sections.
 * @param openKey   A string that changes only on true "open a
 *                  new/different form" events. Used to gate the
 *                  one-shot autofocus.
 */
export function useAutofocusFirstField(
  sections: readonly CaptureFormSection[],
  openKey: string,
): void {
  const lastKey = useRef<string | null>(null);
  useEffect(() => {
    if (sections.length === 0) return;
    if (lastKey.current === openKey) return;
    lastKey.current = openKey;
    // Defer to microtask so the DOM has the just-rendered form.
    queueMicrotask(() => {
      const first = document.querySelector<HTMLElement>(
        '.cap-form-section input:not([readonly]):not([disabled]),'
        + '.cap-form-section select:not([readonly]):not([disabled]),'
        + '.cap-form-section textarea:not([readonly]):not([disabled])');
      if (first) first.focus();
    });
  }, [sections, openKey]);
}
