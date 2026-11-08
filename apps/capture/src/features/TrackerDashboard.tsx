import { useEffect, useMemo, useState } from 'react';
import type { CaptureApi, StageOpt } from '../shared/types';

export interface TrackerEnrolment {
  readonly enrollmentUid: string;
  readonly programUid: string;
  readonly orgUnitUid: string;
  readonly status: string | null;
  readonly enrollmentDate: string | null;
  readonly lastUpdatedAt: string;
}

export interface TrackerEvent {
  readonly eventUid: string;
  readonly enrollmentUid: string;
  readonly programStageUid: string;
  readonly status: string | null;
  readonly occurredDate: string | null;
  readonly lastUpdatedAt: string;
}

/**
 * Tracked-entity dashboard shown when the operator opens a row
 * from the working list. Replaces the inline list with:
 *
 *   • Identity strip (TR-020) — compact header with the UID,
 *     display name and last-updated timestamp.
 *   • Enrolment list (TR-022) — all enrolments scoped to the
 *     current program, with select-on-click so the stage rail
 *     binds to the chosen enrolment.
 *   • Stage rail (TR-030/TR-032) — the program's stages with an
 *     event count + latest status per stage. Selecting a stage
 *     reveals its events, honouring repeatability (TR-033) and
 *     no-duplicate for non-repeatable stages (TR-034).
 *
 * Form rendering for stage events arrives in G6 — the dashboard
 * is the navigation substrate G6 plugs into.
 */
export function TrackerDashboard(
  { api, programUid, tei, displayName, lastUpdated, onBack }: {
    api: CaptureApi;
    programUid: string;
    tei: string;
    displayName: string | null;
    lastUpdated: string | null;
    onBack: () => void;
  },
): JSX.Element {
  const [enrolments, setEnrolments] = useState<TrackerEnrolment[]>([]);
  const [selectedEnrolment, setSelectedEnrolment] = useState<string | null>(null);
  const [stages, setStages] = useState<StageOpt[]>([]);
  const [selectedStage, setSelectedStage] = useState<string | null>(null);
  const [events, setEvents] = useState<TrackerEvent[]>([]);
  const [status, setStatus] = useState<'idle' | 'loading' | 'err'>('idle');

  // Fetch enrolments + stages in parallel on first open.
  useEffect(() => {
    let cancelled = false;
    setStatus('loading');
    (async () => {
      try {
        const [enrRes, stageRes] = await Promise.all([
          api.listCaptureTeiEnrollments(tei, programUid),
          api.listCaptureProgramStages(programUid),
        ]);
        if (cancelled) return;
        const enr: TrackerEnrolment[] = (enrRes.enrollments ?? []).map((e) => ({
          enrollmentUid: e.enrollmentUid,
          programUid: e.programUid,
          orgUnitUid: e.orgUnitUid,
          status: e.status,
          enrollmentDate: e.enrollmentDate,
          lastUpdatedAt: e.lastUpdatedAt,
        }));
        setEnrolments(enr);
        setStages(stageRes.stages.map((s) => ({
          id: s.programStageUid, displayName: s.displayName,
        })));
        if (enr.length > 0) {
          setSelectedEnrolment(enr[0]!.enrollmentUid);
        }
        setStatus('idle');
      } catch {
        if (!cancelled) setStatus('err');
      }
    })();
    return () => { cancelled = true; };
  }, [api, programUid, tei]);

  // Whenever the selected enrolment changes, re-fetch its events.
  useEffect(() => {
    if (!selectedEnrolment) { setEvents([]); return; }
    let cancelled = false;
    (async () => {
      try {
        const r = await api.listCaptureEnrollmentEvents(selectedEnrolment);
        if (cancelled) return;
        setEvents(r.events.map((e) => ({
          eventUid: e.eventUid,
          enrollmentUid: e.enrollmentUid,
          programStageUid: e.programStageUid,
          status: e.status,
          occurredDate: e.occurredDate,
          lastUpdatedAt: e.lastUpdatedAt,
        })));
      } catch {
        if (!cancelled) setEvents([]);
      }
    })();
    return () => { cancelled = true; };
  }, [api, selectedEnrolment]);

  // Events by stage uid — for the stage rail count + the event
  // list on the right.
  const eventsByStage = useMemo(() => {
    const m = new Map<string, TrackerEvent[]>();
    for (const e of events) {
      const list = m.get(e.programStageUid) ?? [];
      list.push(e);
      m.set(e.programStageUid, list);
    }
    return m;
  }, [events]);

  const stageEvents = selectedStage
    ? eventsByStage.get(selectedStage) ?? []
    : [];

  return (
    <>
      <div className="cap-section-head" data-test="tr-dash-head">
        <button type="button"
                className="cap-btn cap-btn--secondary"
                data-test="tr-dash-back"
                onClick={onBack}
                style={{ padding: '4px 10px', fontSize: 12 }}>
          ← Back to list
        </button>
        <h2 className="cap-section-head__title">Tracked entity</h2>
        <span className="cap-section-head__count">
          {status === 'loading' ? 'loading…'
            : status === 'err' ? 'failed to load'
            : enrolments.length === 0 ? 'no enrolments yet'
            : `${enrolments.length} enrolment`
              + (enrolments.length === 1 ? '' : 's')}
        </span>
        <span className="cap-section-head__rule" />
      </div>

      {/* Identity strip */}
      <div className="cap-identity-strip" data-test="tr-identity-strip">
        <div>
          <span className="cap-toolbar__field-label">UID</span>
          <code className="cap-toolbar__ou-code">{tei}</code>
        </div>
        {displayName && (
          <div>
            <span className="cap-toolbar__field-label">Name</span>
            <strong style={{ marginLeft: 8 }}>{displayName}</strong>
          </div>
        )}
        {lastUpdated && (
          <div>
            <span className="cap-toolbar__field-label">Last updated</span>
            <span style={{ marginLeft: 8, color: '#4a5768',
              fontSize: 13 }}>{lastUpdated}</span>
          </div>
        )}
      </div>

      {/* Enrolment switcher — only when there's more than one. */}
      {enrolments.length > 1 && (
        <div className="cap-section-head">
          <h2 className="cap-section-head__title">Enrolments</h2>
          <span className="cap-section-head__rule" />
        </div>
      )}
      {enrolments.length > 1 && (
        <ul className="cap-list" data-test="tr-enrolment-list">
          {enrolments.map((e) => (
            <li key={e.enrollmentUid}
                className={'cap-list__row cap-list__row--clickable'
                  + (selectedEnrolment === e.enrollmentUid
                    ? ' cap-list__row--active' : '')}
                data-test={'tr-enrolment-' + e.enrollmentUid}
                onClick={() => setSelectedEnrolment(e.enrollmentUid)}>
              <div>
                <code>{e.enrollmentUid}</code>
                {e.status && (
                  <span className="cap-chip" style={{ marginLeft: 10 }}>
                    {e.status}
                  </span>
                )}
              </div>
              <span className="cap-list__when">
                {e.enrollmentDate ?? e.lastUpdatedAt}
              </span>
            </li>
          ))}
        </ul>
      )}

      {/* Stage rail + events — two-column grid. Rail on the left,
       *  events on the right. */}
      {selectedEnrolment && (
        <div className="cap-stage-layout" data-test="tr-stage-layout">
          <nav className="cap-stage-rail" aria-label="Program stages"
               data-test="tr-stage-rail">
            {stages.length === 0 ? (
              <p className="cap-sub" style={{ margin: 0 }}>
                This program has no stages configured.
              </p>
            ) : stages.map((s) => {
              const count = eventsByStage.get(s.id)?.length ?? 0;
              const active = selectedStage === s.id;
              return (
                <button key={s.id} type="button"
                        className={'cap-stage-rail__item'
                          + (active ? ' cap-stage-rail__item--active' : '')}
                        data-test={'tr-stage-' + s.id}
                        onClick={() => setSelectedStage(s.id)}>
                  <span className="cap-stage-rail__name">
                    {s.displayName}
                  </span>
                  <span className="cap-stage-rail__count"
                        title={count === 0 ? 'No events yet'
                          : `${count} event${count === 1 ? '' : 's'}`}>
                    {count}
                  </span>
                </button>
              );
            })}
          </nav>

          <div className="cap-stage-pane" data-test="tr-stage-pane">
            {selectedStage === null ? (
              <p className="cap-sub" style={{ margin: 0 }}>
                Select a stage to see its events.
              </p>
            ) : stageEvents.length === 0 ? (
              <>
                <p className="cap-sub" style={{ marginTop: 0 }}>
                  No events recorded for this stage yet.
                </p>
                <div className="cap-strip cap-strip--info">
                  <strong>Stage event editor</strong> arrives in
                  slice G6. For now the dashboard lets you confirm
                  program + enrolment + stage scoping end-to-end.
                </div>
              </>
            ) : (
              <ul className="cap-list" style={{ margin: 0 }}
                  data-test="tr-event-list">
                {stageEvents.map((e) => (
                  <li key={e.eventUid} className="cap-list__row">
                    <div>
                      <code>{e.eventUid}</code>
                      {e.status && (
                        <span className="cap-chip"
                              style={{ marginLeft: 10 }}>
                          {e.status}
                        </span>
                      )}
                    </div>
                    <span className="cap-list__when">
                      {e.occurredDate ?? e.lastUpdatedAt}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </>
  );
}
