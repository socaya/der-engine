import { useEffect, useState } from 'react';
import type { CaptureApi } from '../shared/types';

interface RelTypeRow {
  readonly id: string;
  readonly displayName: string;
  readonly bidirectional: boolean;
  readonly fromToName?: string;
  readonly toFromName?: string;
  readonly fromEntity?: string;
  readonly toEntity?: string;
  readonly fromTet?: string;
  readonly toTet?: string;
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
  { api, tei, programUid, orgUnitUid, tetUid }: {
    api: CaptureApi; tei: string;
    programUid: string; orgUnitUid: string;
    tetUid: string | null;
  },
): JSX.Element {
  const [rows, setRows] = useState<RelRow[]>([]);
  const [status, setStatus] =
    useState<'idle' | 'loading' | 'err'>('loading');
  const [types, setTypes] = useState<RelTypeRow[]>([]);
  /** Inline compose panel toggled by + Add relationship. No
   *  modal — two select controls (Type, Target) and a Save
   *  button. Collapses on Save or Cancel. */
  const [composing, setComposing] = useState(false);
  const [pickedTypeId, setPickedTypeId] = useState('');
  const [targetTei, setTargetTei] = useState('');
  const [submit, setSubmit] =
    useState<'idle' | 'submitting' | 'ok' | 'err'>('idle');
  const [submitMsg, setSubmitMsg] = useState<string | null>(null);
  // Candidate TEI search for the target endpoint — fetched once
  // per (programUid, orgUnitUid) and filtered client-side by the
  // operator's query. Precise cross-program search comes in G7-2d.
  const [candidates, setCandidates] = useState<Array<{
    uid: string; displayName: string; lastUpdated: string }>>([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const r = await api.listTrackerEntities(programUid,
          orgUnitUid, 200);
        if (cancelled) return;
        const list = r.trackedEntities ?? r.instances ?? [];
        setCandidates(list.map((row) => ({
          uid: row.trackedEntity ?? row.trackedEntityInstance ?? '',
          displayName: row.displayName ?? '',
          lastUpdated: row.lastUpdated ?? '',
        })).filter((c) => c.uid !== '' && c.uid !== tei));
      } catch {
        if (!cancelled) setCandidates([]);
      }
    })();
    return () => { cancelled = true; };
  }, [programUid, orgUnitUid, tei]);

  /**
   * Eligibility projection (§REL-MD-004). This TEI can be the
   * FROM endpoint when the type's fromConstraint is a TEI with
   * matching TET (or no TET constraint). If the type is
   * bidirectional and the TEI matches the TO constraint instead,
   * it's also eligible — the operator will link from the
   * reverse perspective but the server stores one canonical
   * relationship (§REL-UX-006).
   */
  const eligibleTypes = tetUid ? types.filter((t) => {
    const fromOk = t.fromEntity === 'TRACKED_ENTITY_INSTANCE'
      && (!t.fromTet || t.fromTet === tetUid);
    const toOk = t.bidirectional
      && t.toEntity === 'TRACKED_ENTITY_INSTANCE'
      && (!t.toTet || t.toTet === tetUid);
    return fromOk || toOk;
  }) : types;

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
          fromTet: t.fromConstraint?.trackedEntityType?.id,
          toTet:   t.toConstraint?.trackedEntityType?.id,
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
  }, [tei]);

  return (
    <>
      {/* Relationships are now fully edge-local (full-emulation
       *  slice 4): reads come from the mirrored edge table, writes
       *  enqueue a journal entry that drains to central on
       *  connectivity. No longer need the "online only" notice. */}
      <div className="cap-section-head" data-test="tr-rel-head">
        <h2 className="cap-section-head__title">Relationships</h2>
        <span className="cap-section-head__count">
          {status === 'loading' ? 'loading…'
            : status === 'err' ? 'failed to load'
            : rows.length === 0 ? 'none yet'
            : `${rows.length} link${rows.length === 1 ? '' : 's'}`}
        </span>
        <span className="cap-section-head__rule" />
        {!composing && (
          <button type="button"
                  className="cap-btn cap-btn--primary"
                  data-test="tr-rel-add"
                  disabled={eligibleTypes.length === 0}
                  onClick={() => setComposing(true)}
                  title={eligibleTypes.length === 0
                    ? (types.length === 0
                      ? 'No relationship types are configured'
                      : 'No relationship types permit this tracked '
                        + 'entity as an endpoint')
                    : 'Pick a type + target TEI, then save'}
                  style={{ padding: '5px 13px', fontSize: 13 }}>
            + Add relationship
          </button>
        )}
      </div>

      {composing && (() => {
        const pickedType = eligibleTypes.find(
          (t) => t.id === pickedTypeId);
        const selfLink = targetTei.trim() === tei;
        const canSave = pickedTypeId !== ''
          && targetTei.trim() !== ''
          && !selfLink
          && submit !== 'submitting';
        return (
          <div className="cap-rel-compose" data-test="tr-rel-compose">
            <div className="cap-form-section__grid"
                 style={{ marginTop: 0 }}>
              <label className="cap-input">
                <span className="cap-input__label">
                  Relationship type
                  <span className="cap-input__req">*</span>
                </span>
                <select className="cap-input__ctl"
                        data-test="tr-rel-type-select"
                        value={pickedTypeId}
                        onChange={(e) => setPickedTypeId(e.target.value)}>
                  <option value="">— Select type —</option>
                  {eligibleTypes.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.displayName}
                      {t.bidirectional ? ' (both ways)' : ''}
                    </option>
                  ))}
                </select>
                {pickedType?.fromToName && (
                  <span className="cap-input__help">
                    {pickedType.fromToName} → target
                  </span>
                )}
              </label>
              <label className="cap-input">
                <span className="cap-input__label">
                  Target tracked entity
                  <span className="cap-input__req">*</span>
                </span>
                <select className="cap-input__ctl"
                        data-test="tr-rel-target-select"
                        value={targetTei}
                        onChange={(e) => setTargetTei(e.target.value)}>
                  <option value="">— Select target —</option>
                  {candidates.map((c) => (
                    <option key={c.uid} value={c.uid}>
                      {c.displayName
                        ? c.displayName + '  ·  ' + c.uid
                        : c.uid}
                    </option>
                  ))}
                </select>
                {candidates.length === 0 && (
                  <span className="cap-input__help">
                    No other tracked entities loaded for this
                    program at this facility yet.
                  </span>
                )}
                {selfLink && (
                  <span className="cap-field-warn cap-field-warn--err">
                    A tracked entity cannot link to itself.
                  </span>
                )}
              </label>
            </div>
            {submit === 'err' && submitMsg && (
              <div className="cap-strip cap-strip--err"
                   data-test="tr-rel-compose-err"
                   style={{ margin: '12px 0 0 0' }}>
                {submitMsg}
              </div>
            )}
            <div className="cap-rel-compose__footer">
              <button type="button"
                      className="cap-btn cap-btn--secondary"
                      data-test="tr-rel-cancel"
                      disabled={submit === 'submitting'}
                      onClick={() => {
                        setComposing(false);
                        setPickedTypeId(''); setTargetTei('');
                        setSubmit('idle'); setSubmitMsg(null);
                      }}
                      style={{ padding: '5px 13px', fontSize: 13 }}>
                Cancel
              </button>
              <button type="button"
                      className="cap-btn cap-btn--primary"
                      data-test="tr-rel-link"
                      disabled={!canSave}
                      onClick={async () => {
                        setSubmit('submitting');
                        setSubmitMsg(null);
                        const res = await api.submitTrackerRelationship({
                          relationshipType: pickedTypeId,
                          fromTei: tei,
                          toTei: targetTei.trim(),
                        });
                        if (res.ok) {
                          const r = await api
                            .listTrackerRelationships(tei);
                          setRows(Array.isArray(r) ? r : []);
                          setComposing(false);
                          setPickedTypeId('');
                          setTargetTei('');
                          setSubmit('idle');
                          setSubmitMsg(null);
                        } else {
                          setSubmit('err');
                          setSubmitMsg(res.message);
                        }
                      }}
                      style={{ padding: '5px 13px', fontSize: 13 }}>
                {submit === 'submitting' ? 'Saving…'
                  : 'Save relationship'}
              </button>
            </div>
          </div>
        );
      })()}

      {rows.length === 0 ? (
        <div className="cap-placeholder" data-test="tr-rel-empty">
          {status === 'err'
            ? 'Relationships could not be loaded.'
            : 'No linked tracked entities yet.'}
        </div>
      ) : (
        <ul className="cap-list" data-test="tr-rel-list">
          {rows.map((r, i) => {
            const label = r.relationshipName ?? r.relationshipType
              ?? 'Linked';
            const toUid = fromToUid(r.to, tei);
            const target = toUid === tei
              ? (r.from ? describeEndpoint(r.from) : '—')
              : (r.to ? describeEndpoint(r.to) : '—');
            const uid = r.relationship;
            return (
              <li key={(uid ?? '') + i}
                  className="cap-list__row"
                  style={{ gridTemplateColumns: '1fr auto auto' }}>
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
                {uid && (
                  <button type="button"
                          className="cap-btn cap-btn--secondary"
                          data-test={'tr-rel-unlink-' + uid}
                          style={{ padding: '2px 8px', fontSize: 11 }}
                          title={'Unlink this relationship. The DER '
                            + 'journal keeps a tombstone (§REL-SEC-005)'}
                          onClick={async () => {
                            const ok = window.confirm(
                              'Unlink this relationship? The link '
                              + 'will be removed on the facility '
                              + 'edge and queued for central sync.');
                            if (!ok) return;
                            const res = await
                              api.deleteTrackerRelationship(uid);
                            if (res.ok) {
                              const fresh =
                                await api.listTrackerRelationships(tei);
                              setRows(Array.isArray(fresh) ? fresh : []);
                            } else {
                              window.alert('Unlink failed: '
                                + res.message);
                            }
                          }}>
                    Unlink
                  </button>
                )}
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
