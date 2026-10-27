import type { ReactNode } from 'react';

/**
 * Thin wrapper over the standard `.ea-screen-header` layout.
 *
 * Historically this component rendered its own "hero" card; today it
 * delegates to the same markup as every other screen header so the
 * admin UI stays visually consistent across modules. `subtitle`
 * renders below the H1, `actions` sit to the right.
 *
 * `version`, `centralVersion`, `lastFetched` are kept in the type for
 * callers that still pass them, but intentionally not rendered — the
 * build/version pill lives in the topbar.
 */
export interface HeroHeaderProps {
  readonly title: string;
  readonly subtitle?: string;
  readonly version?: string;
  readonly centralVersion?: string;
  readonly lastFetched?: Date | null;
  readonly actions?: ReactNode;
}

export function HeroHeader({ title, subtitle, actions }: HeroHeaderProps): JSX.Element {
  return (
    <header className="ea-screen-header" data-test="hero-header">
      <div className="ea-screen-header-text">
        <h1 data-test="ea01-header"
            style={{ margin: 0, fontSize: 20, fontWeight: 600 }}>{title}</h1>
        {subtitle && (
          <div className="ea-screen-header-sub" style={{ fontSize: 12 }}>
            {subtitle}
          </div>
        )}
      </div>
      {actions && <div className="ea-screen-header-right">{actions}</div>}
    </header>
  );
}
