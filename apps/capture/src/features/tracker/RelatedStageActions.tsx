import { useEffect, useMemo, useState } from 'react';
import type { CaptureApi } from '../../shared/types';
import { navTracker } from '../../shared/routing';

/** Spec §REL-C-013 / §8.5 — contextual related-stage actions
 *  rendered below the event editor on the event detail page.
 *
 *  Reads the relationship-type catalogue filtered to EVENT ↔ EVENT
 *  types whose from-side matches this event's programStage. Each
 *  configured type becomes a single-click action row ("Request
 *  lab tests", "Create prescription", etc.) that launches the
 *  wizard pre-anchored on this event + with the type preselected.
 *  Operators skip the first two wizard steps and land on Review
 *  with the target TEI to pick — the quickest path to a linked
 *  related event without losing the audit trail the wizard
 *  provides.
 *
 *  Existing EVENT ↔ EVENT links from this event are shown above
 *  the actions as a compact list so the operator can see
 *  what's already been linked (REL-C-007 "navigate to linked
 *  records"). */
export function RelatedStageActions(
  { api, programUid, enrollmentId, eventId, stageUid, onResolveTei }: {
    api: CaptureApi;
    programUid: string;
    enrollmentId: string;
    eventId: string;
    stageUid: string;
    onResolveTei: (enrollmentUid: string) => Promise<string | null>;
  },
): JSX.Element {
  const [types, setTypes] = useState<Array<{
    id: string;
    displayName: string;
    fromToName?: string;
    toFromName?: string;
    fromStageUid?: string;
    toStageUid?: string;
    bidirectional: boolean;
  }>>([]);
  const [existing, setExisting] = useState<Array<{
    relationshipUid?: string;
    relationshipName?: string;
    relationshipType?: string;
    syncStatus?: string;
    targetLabel: string;
  }>>([]);
  const [resolvedTei, setResolvedTei] = useState<string | null>(null);
  const [status, setStatus] =
    useState<'loading' | 'idle' | 'err'>('loading');

  useEffect(() => {
    let cancelled = false;
    setStatus('loading');
    (async () => {
      try {
        const [typesRaw, links, tei] = await Promise.all([
          api.listRelationshipTypes().catch(() => []),
          api.listTrackerRelationships(eventId).catch(() => []),
          onResolveTei(enrollmentId),
        ]);
        if (cancelled) return;
        setResolvedTei(tei);
        setTypes((typesRaw ?? [])
          .filter((t) => t.fromConstraint?.relationshipEntity
              === 'PROGRAM_STAGE_INSTANCE'
            && t.toConstraint?.relationshipEntity
              === 'PROGRAM_STAGE_INSTANCE')
          .map((t) => ({
            id: t.id,
            displayName: t.displayName ?? t.name ?? t.id,
            fromToName: t.fromToName,
            toFromName: t.toFromName,
            fromStageUid: t.fromConstraint?.programStage?.id ?? undefined,
            toStageUid: t.toConstraint?.programStage?.id ?? undefined,
            bidirectional: t.bidirectional ?? false,
          })));
        setExisting((Array.isArray(links) ? links : [])
          .filter((r) => r.from?.event?.event === eventId
            || r.to?.event?.event === eventId)
          .map((r) => {
            const otherSide = r.from?.event?.event === eventId
              ? r.to : r.from;
            const targetLabel =
                otherSide?.event?.programStageName
                  ? `${otherSide.event.programStageName} · `
                    + (otherSide.event.occurredDate ?? '')
                  : (otherSide?.event?.event ?? '—');
            return {
              relationshipUid: r.relationship,
              relationshipName: r.relationshipName,
              relationshipType: r.relationshipType,
              syncStatus: r.syncStatus,
              targetLabel,
            };
          }));
        setStatus('idle');
      } catch {
        if (!cancelled) setStatus('err');
      }
    })();
    return () => { cancelled = true; };
  }, [api, eventId, enrollmentId, onResolveTei]);

  /** Types where THIS event's stage matches the from-side
   *  constraint — the operator will be the from endpoint and the
   *  wizard will prompt for the to target. Bidirectional types
   *  also appear when only the to-side matches (wizard flips the
   *  anchor automatically). */
  const eligibleTypes = useMemo(() => types.filter((t) => {
    const fromMatch = !t.fromStageUid || t.fromStageUid === stageUid;
    const toMatch = t.bidirectional
      && (!t.toStageUid || t.toStageUid === stageUid);
    return fromMatch || toMatch;
  }), [types, stageUid]);

  if (status === 'loading') return <></>;
  if (eligibleTypes.length === 0 && existing.length === 0) {
    return <></>;
  }

  function launch(typeId: string): void {
    if (!resolvedTei) return;
    navTracker.relationshipNew(programUid, resolvedTei, 1, {
      fromKind: 'EVENT', fromUid: eventId, preType: typeId,
    });
  }

  return (
    <section className="cap-related-stage"
             data-test="tr-related-stage">
      <div className="cap-section-head">
        <h3 className="cap-section-head__title"
            style={{ fontSize: 14 }}>Related events</h3>
        <span className="cap-section-head__count">
          {existing.length === 0 ? 'none yet'
            : `${existing.length} link`
              + (existing.length === 1 ? '' : 's')}
        </span>
      </div>

      {existing.length > 0 && (
        <ul className="cap-list" data-test="tr-related-stage-list">
          {existing.map((r, i) => (
            <li key={(r.relationshipUid ?? '') + i}
                className="cap-list__row"
                style={{ gridTemplateColumns: '1fr auto' }}>
              <div>
                <strong>{r.relationshipName ?? r.relationshipType
                  ?? 'Linked'}</strong>
                <div style={{ marginTop: 4, color: '#4a5768',
                  fontSize: 13 }}>→ {r.targetLabel}</div>
              </div>
              <span className="cap-sub" style={{ fontSize: 13 }}>
                {r.syncStatus ?? ''}
              </span>
            </li>
          ))}
        </ul>
      )}

      {eligibleTypes.length > 0 && (
        <div className="cap-related-stage__actions"
             data-test="tr-related-stage-actions">
          <p className="cap-sub" style={{ marginTop: 10,
            marginBottom: 6 }}>
            Add a related event — the wizard opens pre-filled with
            this event as the source.
          </p>
          <ul className="cap-related-stage__actionlist">
            {eligibleTypes.map((t) => {
              const label = t.fromToName ?? t.displayName;
              return (
                <li key={t.id}>
                  <button type="button"
                          className="cap-btn cap-btn--secondary"
                          data-test={'tr-related-stage-launch-' + t.id}
                          disabled={resolvedTei === null}
                          style={{ padding: '6px 14px',
                            fontSize: 13 }}
                          onClick={() => launch(t.id)}>
                    + {label}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </section>
  );
}
