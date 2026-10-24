import type { ReactNode } from 'react';

/**
 * M1: hero header card. A rich banner above the metric strip
 * carrying the welcome, build/compat badges, timestamp, and
 * primary actions.
 */
export interface HeroHeaderProps {
  readonly title: string;
  readonly subtitle: string;
  readonly version?: string;
  readonly centralVersion?: string;
  readonly lastFetched?: Date | null;
  readonly orgUnitBound?: boolean;
  readonly orgUnitLabel?: string;
  readonly actions?: ReactNode;
}

function fmtAgo(from: Date, now: Date): string {
  const sec = Math.max(0, Math.round((now.getTime() - from.getTime()) / 1000));
  if (sec < 60) return `${sec}s ago`;
  if (sec < 3600) return `${Math.round(sec / 60)}m ago`;
  if (sec < 86_400) return `${Math.round(sec / 3600)}h ago`;
  return `${Math.round(sec / 86_400)}d ago`;
}

function fmtDate(d: Date): string {
  return d.toLocaleDateString(undefined, {
    weekday: 'short', day: '2-digit', month: 'short', year: 'numeric',
  });
}

export function HeroHeader({
  title, subtitle, version, centralVersion,
  lastFetched, orgUnitBound, orgUnitLabel, actions,
}: HeroHeaderProps): JSX.Element {
  const now = new Date();
  return (
    <section className="ea-hero" data-test="hero-header">
      <div className="ea-hero-body">
        <div className="ea-hero-eyebrow">Welcome back</div>
        <h1 className="ea-hero-title" data-test="ea01-header">
          {title}
        </h1>
        <p className="ea-hero-sub">{subtitle}</p>
        <div className="ea-hero-badges">
          {version && (
            <span className="ea-hero-badge" data-test="hero-ver">
              <span className="ea-hero-badge-k">DER</span>
              <span className="ea-hero-badge-v">{version}</span>
            </span>
          )}
          {centralVersion && (
            <span className="ea-hero-badge" data-test="hero-central">
              <span className="ea-hero-badge-k">DHIS2</span>
              <span className="ea-hero-badge-v">{centralVersion}</span>
            </span>
          )}
          <span
            className={`ea-chip ea-chip--${orgUnitBound ? 'success' : 'warning'}`}
            data-test="hero-ou"
          >
            {orgUnitBound ? `Bound · ${orgUnitLabel}` : 'orgUnit not bound'}
          </span>
        </div>
      </div>
      <div className="ea-hero-side">
        <div className="ea-hero-date">
          <div className="ea-hero-date-label">Today</div>
          <div className="ea-hero-date-value">{fmtDate(now)}</div>
          {lastFetched && (
            <div className="ea-hero-stale" data-test="hero-stale">
              Updated {fmtAgo(lastFetched, now)}
            </div>
          )}
        </div>
        {actions && <div className="ea-hero-actions">{actions}</div>}
      </div>
    </section>
  );
}
