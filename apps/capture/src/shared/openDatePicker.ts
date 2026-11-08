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
