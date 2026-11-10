import { useId, type ReactNode } from 'react';
import { useFocusTrap } from './useFocusTrap';
import { UiIcon } from './UiIcon';

/**
 * UX-C canonical modal dialog wrapper.
 *
 * Owns the overlay + focus-trap + aria-modal plumbing so individual
 * dialogs (OnboardingTour, KeyboardShortcuts, payload drawers,
 * import dialogs) don't each roll their own. A dialog that renders
 * through this wrapper is keyboard-reachable on open, Tab-cycles
 * inside, Escape-dismissible, and returns focus to the opener on
 * close.
 *
 * The visual chrome (title bar, close X, body spacing) is also owned
 * here so every dialog reads with the same frame; callers only
 * supply `title`, `children` for the body, and optional `footer`.
 */
export interface DialogProps {
  readonly open: boolean;
  readonly onClose: () => void;
  readonly title: string;
  readonly children: ReactNode;
  readonly footer?: ReactNode;
  /** Optional width cap — defaults to 560px (standard dialog). */
  readonly maxWidth?: number;
  readonly testId?: string;
}

export function Dialog(
  { open, onClose, title, children, footer, maxWidth = 560,
    testId = 'dialog' }: DialogProps,
): JSX.Element | null {
  const ref = useFocusTrap<HTMLDivElement>({ active: open, onClose });
  const titleId = useId();
  if (!open) return null;
  return (
    <div className="ea-dialog-overlay"
         role="presentation"
         data-test={`${testId}-overlay`}
         onClick={onClose}>
      <div className="ea-dialog"
           ref={ref}
           role="dialog"
           aria-modal="true"
           aria-labelledby={titleId}
           data-test={testId}
           style={{ maxWidth }}
           onClick={(e) => e.stopPropagation()}>
        <header className="ea-dialog-head">
          <h2 id={titleId} className="ea-dialog-title">{title}</h2>
          <button type="button"
                  className="ea-dialog-close"
                  data-test={`${testId}-close`}
                  onClick={onClose}
                  aria-label="Close dialog">
            <UiIcon icon="close" size={16} />
          </button>
        </header>
        <div className="ea-dialog-body">{children}</div>
        {footer && <footer className="ea-dialog-foot">{footer}</footer>}
      </div>
    </div>
  );
}
