import { useEffect, useRef, useState } from 'react';
import type { CaptureApi } from '../shared/types';

interface RelTypeRow {
  readonly id: string;
  readonly displayName: string;
  readonly bidirectional: boolean;
  readonly fromToName?: string;
  readonly toFromName?: string;
  readonly fromEntity?: string;
  readonly toEntity?: string;
}

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
  const [types, setTypes] = useState<RelTypeRow[]>([]);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickedType, setPickedType] = useState<RelTypeRow | null>(null);

  useEffect(() => {
    let cancelled = false;
    setStatus('loading');
    (async () => {
      try {
        const [rels, typesRaw] = await Promise.all([
          api.listTrackerRelationships(tei),
          api.listRelationshipTypes(),
        ]);
        if (cancelled) return;
        setRows(Array.isArray(rels) ? rels : []);
        setTypes(typesRaw.map((t) => ({
          id: t.id,
          displayName: t.displayName ?? t.name ?? t.id,
          bidirectional: t.bidirectional ?? false,
          fromToName: t.fromToName,
          toFromName: t.toFromName,
          fromEntity: t.fromConstraint?.relationshipEntity,
          toEntity: t.toConstraint?.relationshipEntity,
        })));
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
        <button type="button"
                className="cap-btn cap-btn--secondary"
                data-test="tr-rel-add"
                disabled={types.length === 0}
                onClick={() => setPickerOpen(true)}
                title={types.length === 0
                  ? 'No relationship types are configured'
                  : 'Pick a relationship type — target search '
                    + 'arrives in slice G7-2b'}
                style={{ padding: '4px 10px', fontSize: 12 }}>
          + Add relationship
        </button>
      </div>

      {pickedType && (
        <div className="cap-strip cap-strip--info"
             data-test="tr-rel-picked-type"
             style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <strong style={{ flex: 1 }}>
            Relationship type: {pickedType.displayName}
          </strong>
          <span className="cap-chip">
            Target search arrives in G7-2b
          </span>
          <button type="button"
                  className="cap-btn cap-btn--secondary"
                  onClick={() => setPickedType(null)}
                  data-test="tr-rel-picked-clear"
                  style={{ padding: '2px 8px', fontSize: 12 }}>
            Dismiss
          </button>
        </div>
      )}

      {pickerOpen && (
        <TypePickerModal types={types}
                          onPick={(t) => { setPickedType(t);
                            setPickerOpen(false); }}
                          onClose={() => setPickerOpen(false)} />
      )}

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

function TypePickerModal(
  { types, onPick, onClose }: {
    types: readonly RelTypeRow[];
    onPick: (t: RelTypeRow) => void;
    onClose: () => void;
  },
): JSX.Element {
  const dialogRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const h = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onClose]);
  return (
    <div className="cap-info-backdrop"
         role="dialog" aria-modal="true"
         aria-label="Pick a relationship type"
         data-test="tr-rel-picker"
         onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="cap-info" ref={dialogRef}>
        <header className="cap-info__head">
          <h3 className="cap-info__title">Pick a relationship type</h3>
          <button type="button"
                  className="cap-info__close"
                  aria-label="Close"
                  onClick={onClose}>×</button>
        </header>
        <div className="cap-info__body">
          {types.length === 0 ? (
            <p style={{ margin: 0, color: '#4a5768' }}>
              No relationship types are configured on this DHIS2
              server.
            </p>
          ) : (
            <ul className="cap-list" style={{ margin: 0,
              maxHeight: 360, overflow: 'auto' }}>
              {types.map((t) => (
                <li key={t.id}
                    className="cap-list__row cap-list__row--clickable"
                    role="button" tabIndex={0}
                    data-test={'tr-rel-type-' + t.id}
                    onClick={() => onPick(t)}
                    onKeyDown={(ev) => {
                      if (ev.key === 'Enter' || ev.key === ' ') {
                        ev.preventDefault();
                        onPick(t);
                      }
                    }}>
                  <div>
                    <strong>{t.displayName}</strong>
                    {t.bidirectional && (
                      <span className="cap-chip"
                            style={{ marginLeft: 10 }}>
                        ↔ bidirectional
                      </span>
                    )}
                    {!t.bidirectional && t.fromToName && (
                      <span style={{ marginLeft: 10,
                        color: '#4a5768', fontSize: 12 }}>
                        {t.fromToName}
                      </span>
                    )}
                    {(t.fromEntity || t.toEntity) && (
                      <div style={{ marginTop: 2,
                        color: '#6e7a8a', fontSize: 11 }}>
                        {t.fromEntity ?? '—'} →{' '}
                        {t.toEntity ?? '—'}
                      </div>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
          <p className="cap-info__note" style={{ marginTop: 8 }}>
            Full add-relationship flow — target search, preview and
            confirm (§REL-UX-005) — arrives in slice G7-2b.
          </p>
        </div>
      </div>
    </div>
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
