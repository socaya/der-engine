import type { ReactNode } from 'react';

export interface ScreenCardProps {
  readonly title?: ReactNode;
  readonly actions?: ReactNode;
  readonly children: ReactNode;
  readonly dataTest?: string;
}

/**
 * Standard wrapper for every content screen in the device client
 * (C-UI-4). 24 px padding, 1 px border, white surface, minimal
 * radius — matches the flat/soft treatment used by the shell chrome
 * and sign-in panel.
 *
 * Section sub-headings inside the card use `.der-section-heading`
 * (14 px uppercase muted + 1 px underline rule).
 */
export function ScreenCard(
  { title, actions, children, dataTest }: ScreenCardProps,
): JSX.Element {
  const hasHead = Boolean(title) || Boolean(actions);
  return (
    <section className="der-screen-card" data-test={dataTest ?? 'der-screen-card'}>
      {hasHead && (
        <header className="der-screen-card__head">
          {title ? <h1 className="der-screen-card__title">{title}</h1> : <span />}
          {actions && <div className="der-screen-card__actions">{actions}</div>}
        </header>
      )}
      <div className="der-screen-card__body">{children}</div>
    </section>
  );
}

export interface StatusPillProps {
  readonly tone: 'success' | 'warning' | 'danger' | 'info' | 'neutral';
  readonly children: ReactNode;
  readonly dataTest?: string;
}

/**
 * Unified status pill. `tone` picks the colour token; copy sits on
 * a soft-tinted background with a 1 px border matching the palette
 * (flat per project rule — no shadows, minimal radius).
 */
export function StatusPill(
  { tone, children, dataTest }: StatusPillProps,
): JSX.Element {
  return (
    <span className={`der-status-pill der-status-pill--${tone}`}
          data-test={dataTest ?? `der-status-pill-${tone}`}>
      {children}
    </span>
  );
}
