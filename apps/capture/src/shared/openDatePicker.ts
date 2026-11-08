/**
 * Open the native date picker as soon as the operator clicks
 * anywhere on the input — not just the tiny calendar icon on the
 * right. Chromium ≥ 99 exposes {@code HTMLInputElement.showPicker()}
 * for exactly this; we wrap it so the whole field becomes a
 * one-click target.
 *
 * <p>Firefox/Safari don't implement {@code showPicker} yet; we
 * silently fall through to the browser default (click the icon).
 * The try/catch handles the "not a user gesture" rejection that
 * showPicker throws when fired outside an event handler.</p>
 */
export function openDatePicker(
  e: { currentTarget: HTMLInputElement },
): void {
  const el = e.currentTarget as HTMLInputElement
    & { showPicker?: () => void };
  if (typeof el.showPicker === 'function') {
    try { el.showPicker(); } catch { /* no-op */ }
  }
}

/**
 * Focus-triggered variant: use as {@code onFocus} on a date / time
 * input so Tab-ing or arrow-navigating into the cell pops the
 * calendar immediately — matches Excel / Google Sheets grid
 * behaviour where the cell editor opens when the cell gains focus.
 *
 * <p>Schedules {@code showPicker} on the next microtask so the
 * browser's focus transition completes first (otherwise showPicker
 * can throw NotAllowedError on the same tick).</p>
 */
export function openDatePickerOnFocus(
  e: { currentTarget: HTMLInputElement },
): void {
  const el = e.currentTarget as HTMLInputElement
    & { showPicker?: () => void };
  if (typeof el.showPicker !== 'function') return;
  // queueMicrotask / setTimeout(0) — either works; the former is
  // slightly earlier and avoids a visible flash before the picker.
  queueMicrotask(() => {
    try { el.showPicker(); } catch { /* no-op */ }
  });
}
