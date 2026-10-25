import type { ReactNode } from 'react';

/**
 * Flat page header: H1 + one-line muted subtitle on the left,
 * primary action buttons on the right. No card background, no
 * badges (DER/DHIS2 version lives in the topbar / system-info),
 * no OU chip (lives only on the topbar). This is the single
 * screen-title primitive — individual screens don't need to
 * re-implement the headline row.
 *
 * `version`, `centralVersion`, `lastFetched` are kept in the type
 * for callers that still pass them, but intentionally not rendered.
 */
export interface HeroHeaderProps {
  readonly title: string;
  readonly subtitle: string;
  readonly version?: string;
  readonly centralVersion?: string;
  readonly lastFetched?: Date | null;
  readonly actions?: ReactNode;
}

export function HeroHeader({ title, actions }: HeroHeaderProps): JSX.Element {
  return (
    <header className="ea-hero" data-test="hero-header">
      <div className="ea-hero-body">
        <h1 className="ea-hero-title" data-test="ea01-header">{title}</h1>
      </div>
      {actions && <div className="ea-hero-actions">{actions}</div>}
    </header>
  );
}
