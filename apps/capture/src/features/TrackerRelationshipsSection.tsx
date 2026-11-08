import { useEffect, useState } from 'react';
import type { CaptureApi } from '../shared/types';

interface RelRow {
  readonly relationship?: string;
  readonly relationshipType?: string;
  readonly relationshipName?: string;
  readonly bidirectional?: boolean;
  readonly createdAt?: string;
  readonly lastUpdated?: string;
  readonly from?: { trackedEntity?: { trackedEntity?: string;
    displayName?: string }; enrollment?: { enrollment?: string };
    event?: { event?: string } };
  readonly to?: { trackedEntity?: { trackedEntity?: string;
    displayName?: string }; enrollment?: { enrollment?: string };
    event?: { event?: string } };
}

/**
 * Relationships widget on the TEI dashboard (requirements doc §13
 * "Relationship Management Architecture", §REL-UX-001 to
 * §REL-UX-006). Slice G7-1 ships the read-only list only:
 *
 *   • Fetch /api/tracker/relationships?trackedEntity={uid}.
 *   • Display each link with its configured display label, the
 *     target identity (from/to orientation preserved per
 *     REL-UX-006), and a bidirectional chip when applicable.
 *
 * Deferred to G7-2:
 *   • Add relationship (REL-UX-004 "Add relationship" + the
 *     search → preview → confirm flow in REL-UX-005).
 *   • Unlink (REL-UX-010, REL-SEC-005).
 *   • Relationship-type eligibility projection (REL-MD-004).
 *
 * The honest "creation arrives in G7-2" strip tells the operator
 * exactly what is and isn't implemented (§22.5 guardrail).
 */
export function TrackerRelationshipsSection(
  { api, tei }: { api: CaptureApi; tei: string },
): JSX.Element {
  const [rows, setRows] = useState<RelRow[]>([]);
  const [status, setStatus] =
    useState<'idle' | 'loading' | 'err'>('loading');

  useEffect(() => {
    let cancelled = false;
    setStatus('loading');
    (async () => {
      try {
        const r = await api.listTrackerRelationships(tei);
        if (cancelled) return;
        setRows(Array.isArray(r) ? r : []);
        setStatus('idle');
      } catch {
        if (!cancelled) {
          setRows([]);
          setStatus('err');
        }
      }
    })();
    return () => { cancelled = true; };
  }, [api, tei]);

  return (
    <>
      <div className="cap-section-head" data-test="tr-rel-head">
        <h2 className="cap-section-head__title">Relationships</h2>
        <span className="cap-section-head__count">
          {status === 'loading' ? 'loading…'
            : status === 'err' ? 'failed to load'
            : rows.length === 0 ? 'none yet'
            : `${rows.length} link${rows.length === 1 ? '' : 's'}`}
        </span>
        <span className="cap-section-head__rule" />
      </div>

      {rows.length === 0 ? (
        <div className="cap-strip cap-strip--info"
             data-test="tr-rel-empty">
          {status === 'err'
            ? 'The tracker mirror could not be reached.'
            : 'No relationships yet for this tracked entity.'}{' '}
          <strong>Link creation</strong> arrives in slice G7-2
          (requirements doc §13 REL-UX-004 / REL-UX-005).
        </div>
      ) : (
        <ul className="cap-list" data-test="tr-rel-list">
          {rows.map((r, i) => {
            const label = r.relationshipName ?? r.relationshipType
              ?? 'Linked';
            const fromUid = fromToUid(r.from, tei);
            const toUid = fromToUid(r.to, tei);
            const target = toUid === tei
              ? (r.from ? describeEndpoint(r.from) : '—')
              : (r.to ? describeEndpoint(r.to) : '—');
            return (
              <li key={(r.relationship ?? '') + i}
                  className="cap-list__row">
                <div>
                  <strong>{label}</strong>
                  {r.bidirectional && (
                    <span className="cap-chip"
                          style={{ marginLeft: 10 }}>
                      ↔ bidirectional
                    </span>
                  )}
                  <div style={{ marginTop: 4, color: '#4a5768',
                    fontSize: 12 }}>
                    → {target}
                  </div>
                </div>
                <span className="cap-list__when">
                  {r.lastUpdated ?? r.createdAt ?? '—'}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}

function fromToUid(endpoint: RelRow['from'], _teiUid: string):
    string | null {
  if (!endpoint) return null;
  return endpoint.trackedEntity?.trackedEntity
    ?? endpoint.enrollment?.enrollment
    ?? endpoint.event?.event
    ?? null;
}

function describeEndpoint(endpoint: RelRow['from']): string {
  if (!endpoint) return '—';
  if (endpoint.trackedEntity) {
    const t = endpoint.trackedEntity;
    return t.displayName ? `${t.displayName} (${t.trackedEntity})`
      : (t.trackedEntity ?? 'tracked entity');
  }
  if (endpoint.enrollment?.enrollment) {
    return 'enrolment ' + endpoint.enrollment.enrollment;
  }
  if (endpoint.event?.event) {
    return 'event ' + endpoint.event.event;
  }
  return '—';
}
