import { useEffect, useState, type ReactNode } from 'react';
import { UiIcon } from './UiIcon';

/**
 * UX-B canonical page header.
 *
 * Supersedes the pre-UX-B split between ScreenHeader and HeroHeader.
 * Every admin-ui screen renders exactly this at the top of the main
 * area — title + optional subtitle on the left, optional staleness
 * label + Refresh button + action slot on the right.
 *
 * Call-sites that only need title + actions can omit `lastFetched`
 * and `onRefresh` entirely; the right rail stays empty and the
 * component collapses to a single h1 row.
 *
 * `testId` lets a parent scope assertions to a specific header when
 * two live on the same route (rare — only cluster screens do this).
 *
 * Exception — `.ea-dash-hero` remains in use on exactly three welcome
 * screens (Dashboard, Workspace, SystemOverview) where the richer
 * eyebrow + hero graphic + meta row is intentional. Every other screen
 * uses PageHeader. Anything else is a bug.
 */
export interface PageHeaderProps {
  /** Plain string or ReactNode — a handful of screens (sync status
   *  bar, drift summary) embed a status chip beside the title. */
  readonly title: string | ReactNode;
  /** Plain string or ReactNode — Metadata / Compliance / drift
   *  screens use rich subtitle markup (chips, sync tone meta row). */
  readonly subtitle?: ReactNode;
  readonly lastFetched?: Date | null;
  readonly onRefresh?: () => void | Promise<void>;
  readonly actions?: ReactNode;
  readonly testId?: string;
}

function fmtAgo(from: Date, now: Date): string {
  const sec = Math.max(0, Math.round((now.getTime() - from.getTime()) / 1000));
  if (sec < 60) return `updated ${sec}s ago`;
  if (sec < 3600) return `updated ${Math.round(sec / 60)}m ago`;
  if (sec < 86_400) return `updated ${Math.round(sec / 3600)}h ago`;
  return `updated ${Math.round(sec / 86_400)}d ago`;
}

export function PageHeader({
  title,
  subtitle,
  lastFetched,
  onRefresh,
  actions,
  testId = 'page-header',
}: PageHeaderProps): JSX.Element {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (!lastFetched) return undefined;
    const t = setInterval(() => setTick((n) => n + 1), 15_000);
    return () => clearInterval(t);
  }, [lastFetched]);
  const stale = lastFetched ? fmtAgo(lastFetched, new Date()) : null;
  return (
    <header className="ea-screen-header" data-test={testId}>
      <div className="ea-screen-header-text">
        <h1>{title}</h1>
        {subtitle && <p className="ea-screen-header-sub">{subtitle}</p>}
      </div>
      <div className="ea-screen-header-right">
        {stale && (
          <span
            className="ea-screen-header-stale"
            data-test={`${testId}-stale`}
            title={lastFetched?.toISOString()}
          >
            <span style={{ display: 'none' }}>{tick}</span>
            {stale}
          </span>
        )}
        {onRefresh && (
          <button type="button" className="ea-btn ea-btn--ghost ea-btn--sm"
                  onClick={() => void onRefresh()}>
            <UiIcon icon="refresh" size={14} />
            <span>Refresh</span>
          </button>
        )}
        {actions}
      </div>
    </header>
  );
}
