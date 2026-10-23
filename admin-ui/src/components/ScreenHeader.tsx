import { useEffect, useState, type ReactNode } from 'react';
import { Button } from '@dhis2/ui';

/**
 * B5: shared header for data-fetching screens. Renders the title,
 * optional subtitle, lastFetched staleness label, a Refresh button,
 * and an optional slot for secondary actions.
 */
export interface ScreenHeaderProps {
  readonly title: string;
  readonly subtitle?: string;
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

export function ScreenHeader({
  title,
  subtitle,
  lastFetched,
  onRefresh,
  actions,
  testId = 'screen-header',
}: ScreenHeaderProps): JSX.Element {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (!lastFetched) return undefined;
    const t = setInterval(() => setTick((n) => n + 1), 15_000);
    return () => clearInterval(t);
  }, [lastFetched]);
  const stale = lastFetched ? fmtAgo(lastFetched, new Date()) : null;
  return (
    <div className="ea-screen-header" data-test={testId}>
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
            {/* re-render on tick */}
            <span style={{ display: 'none' }}>{tick}</span>
            {stale}
          </span>
        )}
        {onRefresh && (
          <Button small onClick={() => void onRefresh()}>
            Refresh
          </Button>
        )}
        {actions}
      </div>
    </div>
  );
}
