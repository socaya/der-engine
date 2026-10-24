import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import * as edgeApi from '../api/edgeApi';

/**
 * M1: Recent Activity feed on the Overview. Pulls the latest
 * audit events and renders them as a timeline list.
 */

interface RecentActivityProps {
  readonly api?: Pick<typeof edgeApi, 'listAuditEvents'>;
}

function fmtAgo(iso: string, now: number): string {
  const t = new Date(iso).getTime();
  const sec = Math.max(0, Math.round((now - t) / 1000));
  if (sec < 60) return `${sec}s ago`;
  if (sec < 3600) return `${Math.round(sec / 60)}m ago`;
  if (sec < 86_400) return `${Math.round(sec / 3600)}h ago`;
  return `${Math.round(sec / 86_400)}d ago`;
}

export function RecentActivity({ api = edgeApi }: RecentActivityProps = {}): JSX.Element {
  const [rows, setRows] = useState<edgeApi.AuditEventRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    api.listAuditEvents({ limit: 10 })
      .then((r) => { if (!cancelled) setRows(r.events); })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err));
      });
    return () => { cancelled = true; };
  }, [api]);

  const now = Date.now();

  return (
    <section className="ea-activity" data-test="recent-activity">
      <div className="ea-activity-head">
        <h2>Recent activity</h2>
        <Link to="/audit/events" className="ea-activity-more">
          View all
        </Link>
      </div>
      {error && (
        <div className="ea-activity-empty" data-test="activity-error">
          {error}
        </div>
      )}
      {!error && rows === null && (
        <div className="ea-activity-empty">Loading…</div>
      )}
      {!error && rows && rows.length === 0 && (
        <div className="ea-activity-empty">No events yet.</div>
      )}
      {!error && rows && rows.length > 0 && (
        <ul className="ea-activity-list">
          {rows.map((e, i) => (
            <li
              key={i}
              className="ea-activity-row"
              data-test={`activity-row-${i}`}
            >
              <span
                className={`ea-activity-dot ea-activity-dot--${
                  e.outcome === 'SUCCESS' ? 'ok'
                    : e.outcome === 'DENIED' ? 'danger'
                    : 'warn'
                }`}
              />
              <div className="ea-activity-body">
                <div className="ea-activity-event">
                  <span className="ea-activity-event-name">{e.eventType}</span>
                  <span className={`ea-chip ea-chip--${
                    e.outcome === 'SUCCESS' ? 'success'
                      : e.outcome === 'DENIED' ? 'danger'
                      : 'info'
                  }`}>{e.outcome}</span>
                </div>
                <div className="ea-activity-meta">
                  {e.actorUserId
                    ? `by ${e.actorUserId.slice(0, 8)}`
                    : 'system'}
                  {' '}·{' '}
                  {fmtAgo(e.observedAt, now)}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
