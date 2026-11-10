import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import * as edgeApi from '../api/edgeApi';

const SCOPE_LABEL: Record<string, string> = {
  AGGREGATE_DATA_VALUE: 'Aggregate values',
  AGGREGATE_DATASET_COMPLETION: 'Dataset completions',
  EVENT: 'Events',
  TRACKED_ENTITY: 'Tracked entities',
  ENROLLMENT: 'Enrolments',
  PROGRAM_STAGE_EVENT: 'Stage events',
  RELATIONSHIP: 'Relationships',
  ENROLMENT_NOTE: 'Enrolment notes',
  GLOBAL: 'Global',
};

/**
 * SM-4a — shown on every sync-oriented screen when at least one
 * policy scope is PAUSED, so operators don't stare at a growing
 * backlog without knowing why. Zero-render when nothing is paused.
 *
 * <p>Polls once on mount — this is slow-moving admin state, we
 * don't need live-refresh here. Failures silently render nothing;
 * the sync screen's own error handling covers that case.</p>
 */
export function PolicyPausedBanner(): JSX.Element | null {
  const [summary, setSummary] = useState<edgeApi.SyncPolicySummary | null>(null);

  useEffect(() => {
    let alive = true;
    edgeApi.syncPolicySummary()
      .then((s) => { if (alive) setSummary(s); })
      .catch(() => { /* silent — sync-policy may be misconfigured */ });
    return () => { alive = false; };
  }, []);

  if (!summary || !summary.anyPaused) return null;

  const paused = summary.scopes.filter((s) => s.mode === 'PAUSED');
  const chips = paused.map((p) =>
    `${SCOPE_LABEL[p.scope] ?? p.scope}${p.held ? ` (${p.held} held)` : ''}`)
    .join(' · ');

  return (
    <div className="ea-banner ea-banner--warning"
         data-test="policy-paused-banner"
         role="status"
         style={{
           display: 'flex',
           justifyContent: 'space-between',
           alignItems: 'center',
           padding: '8px 12px',
           marginBottom: 10,
           background: 'rgba(214, 138, 26, 0.08)',
           borderLeft: '4px solid var(--der-warning, #d68a1a)',
           borderRadius: 4,
           fontSize: 13,
         }}>
      <span>
        <strong style={{ color: 'var(--der-warning, #d68a1a)' }}>
          Sync paused
        </strong>
        {' '}
        <span style={{ color: 'var(--der-text-muted, #6b7280)' }}>·</span>
        {' '}
        {summary.totalHeld > 0 && (
          <>
            {summary.totalHeld} row{summary.totalHeld === 1 ? '' : 's'} held
            {' · '}
          </>
        )}
        {chips}
      </span>
      <Link to="/sync/policy"
            className="ea-btn ea-btn--ghost ea-btn--sm"
            data-test="policy-paused-banner-manage">
        Manage policy
      </Link>
    </div>
  );
}
