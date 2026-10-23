import { Link } from 'react-router-dom';
import type { SystemInfo } from '../api/edgeApi';

/**
 * B6: 4-card health row for the Overview screen. Each card is a
 * quick status pill plus a deep-link to the detail screen.
 */
export interface HealthCardsProps {
  readonly info: SystemInfo | null;
}

function fmtBytes(bytes?: number): string {
  if (!bytes || bytes <= 0) return '—';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let v = bytes;
  let i = 0;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i++;
  }
  return `${v.toFixed(1)} ${units[i]}`;
}

function journalPending(info: SystemInfo): number {
  const j = info.journal;
  const p = j?.pending ?? 0;
  const f = j?.in_flight ?? 0;
  const r = j?.retryable ?? 0;
  const c = j?.conflict_review ?? 0;
  return p + f + r + c;
}

function totalPill(status: 'OK' | 'WARN' | 'REJECT' | 'DOWN'): string {
  switch (status) {
    case 'OK': return 'ea-health-pill ea-health-pill--ok';
    case 'WARN': return 'ea-health-pill ea-health-pill--warn';
    case 'REJECT':
    case 'DOWN': return 'ea-health-pill ea-health-pill--danger';
  }
}

export function HealthCards({ info }: HealthCardsProps): JSX.Element {
  if (!info) {
    return (
      <div className="ea-health-cards" data-test="health-cards-skeleton">
        {[0, 1, 2, 3].map((n) => (
          <div key={n} className="ea-health-card ea-health-card--skeleton">
            <div className="ea-health-skel-line" />
            <div className="ea-health-skel-line ea-health-skel-line--sm" />
          </div>
        ))}
      </div>
    );
  }

  const derStatus: 'OK' | 'WARN' = info.scheduler?.started ? 'OK' : 'WARN';
  const dhis2Status: 'OK' | 'DOWN' = info.dhis2?.probeReachable ? 'OK' : 'DOWN';
  const journalPend = journalPending(info);
  const journalStatus: 'OK' | 'WARN' = journalPend === 0 ? 'OK' : 'WARN';
  const storageStatus =
    info.storage?.status ?? ('OK' as 'OK' | 'WARN' | 'REJECT');

  return (
    <div className="ea-health-cards" data-test="health-cards">
      <Link to="/diagnostics" className="ea-health-card" data-test="health-der">
        <div className="ea-health-head">
          <span className="ea-health-title">DER</span>
          <span className={totalPill(derStatus)}>{derStatus}</span>
        </div>
        <div className="ea-health-main">{info.build?.version ?? '—'}</div>
        <div className="ea-health-sub">
          up{' '}
          {Math.round((info.runtime?.uptimeMillis ?? 0) / 60_000)}m ·{' '}
          {fmtBytes(info.runtime?.heapUsedBytes)} /{' '}
          {fmtBytes(info.runtime?.heapMaxBytes)}
        </div>
      </Link>

      <Link to="/compat" className="ea-health-card" data-test="health-dhis2">
        <div className="ea-health-head">
          <span className="ea-health-title">DHIS2 central</span>
          <span className={totalPill(dhis2Status)}>{dhis2Status}</span>
        </div>
        <div className="ea-health-main">
          {info.dhis2?.centralVersion ?? info.dhis2?.pinnedVersion ?? '—'}
        </div>
        <div className="ea-health-sub">
          profile {info.dhis2?.profileName ?? '—'} ·{' '}
          {info.dhis2?.probeDurationMs ?? '?'}ms probe
        </div>
      </Link>

      <Link to="/journal/worker" className="ea-health-card" data-test="health-journal">
        <div className="ea-health-head">
          <span className="ea-health-title">Journal</span>
          <span className={totalPill(journalStatus)}>
            {journalStatus === 'OK' ? 'empty' : `${journalPend} queued`}
          </span>
        </div>
        <div className="ea-health-main">
          {info.journal?.central_accepted ?? 0} accepted
        </div>
        <div className="ea-health-sub">
          {info.journal?.central_rejected ?? 0} rejected ·{' '}
          {info.journal?.conflict_review ?? 0} in review
        </div>
      </Link>

      <Link to="/backup" className="ea-health-card" data-test="health-storage">
        <div className="ea-health-head">
          <span className="ea-health-title">Storage</span>
          <span className={totalPill(storageStatus)}>{storageStatus}</span>
        </div>
        <div className="ea-health-main">
          {fmtBytes(info.storage?.usableBytes)} free
        </div>
        <div className="ea-health-sub">
          of {fmtBytes(info.storage?.totalBytes)} total ·{' '}
          warn &lt; {fmtBytes(info.storage?.warnBytes)}
        </div>
      </Link>
    </div>
  );
}
