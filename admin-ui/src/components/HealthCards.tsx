import { Link } from 'react-router-dom';
import type { SystemInfo } from '../api/edgeApi';

/**
 * M1: hero metric strip for the Overview screen.
 * Each card has an icon chip, title, large metric, sub-metric,
 * status pill, and deep-links to the detail screen.
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
  return (j?.pending ?? 0) + (j?.in_flight ?? 0) + (j?.retryable ?? 0) + (j?.conflict_review ?? 0);
}

function pillCls(status: 'OK' | 'WARN' | 'REJECT' | 'DOWN'): string {
  switch (status) {
    case 'OK': return 'ea-health-pill ea-health-pill--ok';
    case 'WARN': return 'ea-health-pill ea-health-pill--warn';
    default:    return 'ea-health-pill ea-health-pill--danger';
  }
}

function IconServer(): JSX.Element {
  return <svg viewBox="0 0 24 24" aria-hidden="true" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="3" y="4" width="18" height="7" rx="2"/><rect x="3" y="13" width="18" height="7" rx="2"/><circle cx="7" cy="7.5" r="1"/><circle cx="7" cy="16.5" r="1"/></svg>;
}
function IconCloud(): JSX.Element {
  return <svg viewBox="0 0 24 24" aria-hidden="true" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M18 10a5 5 0 00-9.5-1.5A4 4 0 006 16h12a4 4 0 000-8z"/></svg>;
}
function IconQueue(): JSX.Element {
  return <svg viewBox="0 0 24 24" aria-hidden="true" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="3" y="3" width="18" height="4" rx="1"/><rect x="3" y="10" width="18" height="4" rx="1"/><rect x="3" y="17" width="18" height="4" rx="1"/></svg>;
}
function IconDisk(): JSX.Element {
  return <svg viewBox="0 0 24 24" aria-hidden="true" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8"><ellipse cx="12" cy="5" rx="8" ry="3"/><path d="M4 5v6c0 1.7 3.6 3 8 3s8-1.3 8-3V5M4 11v6c0 1.7 3.6 3 8 3s8-1.3 8-3v-6"/></svg>;
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
  const storageStatus = info.storage?.status ?? 'OK';

  const uptimeMin = Math.round((info.runtime?.uptimeMillis ?? 0) / 60_000);
  const uptimeLabel = uptimeMin < 60
    ? `${uptimeMin}m`
    : uptimeMin < 1440
      ? `${Math.floor(uptimeMin / 60)}h ${uptimeMin % 60}m`
      : `${Math.floor(uptimeMin / 1440)}d`;

  return (
    <div className="ea-health-cards" data-test="health-cards">
      <Link to="/diagnostics" className="ea-health-card" data-test="health-der">
        <div className="ea-health-head">
          <div className="ea-health-icon ea-health-icon--primary"><IconServer/></div>
          <span className={pillCls(derStatus)}>{derStatus}</span>
        </div>
        <div className="ea-health-title">DER Server</div>
        <div className="ea-health-main">{info.build?.version ?? '—'}</div>
        <div className="ea-health-sub">
          up {uptimeLabel} · {fmtBytes(info.runtime?.heapUsedBytes)} /
          {' '}{fmtBytes(info.runtime?.heapMaxBytes)}
        </div>
      </Link>

      <Link to="/compat" className="ea-health-card" data-test="health-dhis2">
        <div className="ea-health-head">
          <div className="ea-health-icon ea-health-icon--teal"><IconCloud/></div>
          <span className={pillCls(dhis2Status)}>{dhis2Status}</span>
        </div>
        <div className="ea-health-title">DHIS2 Central</div>
        <div className="ea-health-main">{info.dhis2?.centralVersion ?? info.dhis2?.pinnedVersion ?? '—'}</div>
        <div className="ea-health-sub">
          {info.dhis2?.profileName ?? '—'} · {info.dhis2?.probeDurationMs ?? '?'}ms probe
        </div>
      </Link>

      <Link to="/journal/worker" className="ea-health-card" data-test="health-journal">
        <div className="ea-health-head">
          <div className="ea-health-icon ea-health-icon--amber"><IconQueue/></div>
          <span className={pillCls(journalStatus)}>
            {journalStatus === 'OK' ? 'EMPTY' : `${journalPend} QUEUED`}
          </span>
        </div>
        <div className="ea-health-title">Journal</div>
        <div className="ea-health-main">{info.journal?.central_accepted ?? 0} accepted</div>
        <div className="ea-health-sub">
          {info.journal?.central_rejected ?? 0} rejected · {info.journal?.conflict_review ?? 0} review
        </div>
      </Link>

      <Link to="/backup" className="ea-health-card" data-test="health-storage">
        <div className="ea-health-head">
          <div className="ea-health-icon ea-health-icon--green"><IconDisk/></div>
          <span className={pillCls(storageStatus as 'OK' | 'WARN' | 'REJECT')}>{storageStatus}</span>
        </div>
        <div className="ea-health-title">Storage</div>
        <div className="ea-health-main">{fmtBytes(info.storage?.usableBytes)} free</div>
        <div className="ea-health-sub">
          of {fmtBytes(info.storage?.totalBytes)} total
        </div>
      </Link>
    </div>
  );
}
