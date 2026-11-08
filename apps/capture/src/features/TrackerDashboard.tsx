import { useEffect, useMemo, useState } from 'react';
import type { CaptureApi, StageOpt } from '../shared/types';
import { TrackerRelationshipsSection } from './TrackerRelationshipsSection';
import { TrackerStageEditor } from './TrackerStageEditor';

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
  { api, programUid, orgUnitUid, tei, displayName, lastUpdated, onBack }: {
    api: CaptureApi;
    programUid: string;
    orgUnitUid: string;
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
  const [stageRepeatable, setStageRepeatable] = useState<Map<string, boolean>>(
    new Map());
  const [events, setEvents] = useState<TrackerEvent[]>([]);
  const [status, setStatus] = useState<'idle' | 'loading' | 'err'>('idle');
  /** When set, the stage pane renders the editor instead of the
   *  event list. 'new' opens a blank editor; a string eventUid
   *  opens the editor pre-filled from getCaptureEventDetail. */
  const [editing, setEditing] = useState<'new' | string | null>(null);
  const [reloadTick, setReloadTick] = useState(0);
  const [tetUid, setTetUid] = useState<string | null>(null);

  // Fetch enrolments + stages in parallel on first open.
  useEffect(() => {
    let cancelled = false;
    setStatus('loading');
    (async () => {
      try {
        const [enrRes, stageRes, tetRes] = await Promise.all([
          api.listCaptureTeiEnrollments(tei, programUid),
          api.listCaptureProgramStages(programUid),
          api.getCaptureProgramTeiType(programUid)
            .catch(() => null),
        ]);
        if (tetRes) setTetUid(tetRes.trackedEntityTypeUid);
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
        // Persist repeatability so the "Add event" button can
        // disable itself for non-repeatable stages that already
        // have one event (TR-034).
        const repMap = new Map<string, boolean>();
        for (const s of stageRes.stages) {
          repMap.set(s.programStageUid,
            (s as { repeatable?: boolean }).repeatable ?? false);
        }
        setStageRepeatable(repMap);
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

  // Whenever the selected enrolment changes (or we bump reloadTick
  // after a save), re-fetch its events.
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
  }, [api, selectedEnrolment, reloadTick]);

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
                title="Back to the working list (Alt+B)"
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

      {/* Honest no-enrolment state — distinguishes "this TEI is
       *  registered but not enrolled in the selected program" from
       *  "something is loading" from "the mirror is down"
       *  (§UI-015 — every empty/loading/offline state must be
       *  visually designed, not left to a generic snackbar). */}
      {status === 'idle' && enrolments.length === 0 && (
        <div className="cap-strip cap-strip--info"
             data-test="tr-no-enrolments"
             style={{ display: 'flex', alignItems: 'center',
               gap: 12 }}>
          <div style={{ flex: 1 }}>
            <strong>This tracked entity has no enrolments in this
              program.</strong>
            {' '}Registering a TEI and enrolling it are separate
            tracker transactions (§TR-012). Pick a different
            program from the toolbar or create an enrolment below.
          </div>
          <button type="button"
                  className="cap-btn cap-btn--primary"
                  data-test="tr-enrol-cta"
                  disabled
                  title={'Enrolment create arrives in slice G5-4 '
                    + '(requirements doc §TR-013)'}>
            Enrol in this program
          </button>
        </div>
      )}

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
                        onClick={() => { setSelectedStage(s.id);
                          setEditing(null); }}>
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
            ) : editing !== null ? (
              <TrackerStageEditor
                api={api}
                programUid={programUid}
                stageUid={selectedStage}
                enrolmentUid={selectedEnrolment}
                orgUnitUid={orgUnitUid}
                eventUid={editing === 'new' ? null : editing}
                onSaved={() => { setEditing(null);
                  setReloadTick((t) => t + 1); }}
                onCancel={() => setEditing(null)} />
            ) : (
              <>
                <div style={{ display: 'flex',
                  justifyContent: 'space-between', alignItems: 'center',
                  marginBottom: 10 }}>
                  <strong style={{ fontSize: 13, color: '#263352' }}>
                    {stageEvents.length} event
                    {stageEvents.length === 1 ? '' : 's'}
                  </strong>
                  {(() => {
                    const repeatable = stageRepeatable.get(selectedStage)
                      ?? false;
                    const disabled = !repeatable && stageEvents.length > 0;
                    return (
                      <button type="button"
                              className="cap-btn cap-btn--primary"
                              data-test="tr-add-event"
                              style={{ padding: '4px 12px', fontSize: 12 }}
                              disabled={disabled}
                              title={disabled
                                ? 'This stage is not repeatable — one '
                                  + 'event already exists (TR-034)'
                                : 'Add a new event for this stage (Alt+N)'}
                              onClick={() => setEditing('new')}>
                        + Add event
                      </button>
                    );
                  })()}
                </div>
                {stageEvents.length === 0 ? (
                  <p className="cap-sub" style={{ marginTop: 0 }}>
                    No events recorded for this stage yet.
                  </p>
                ) : (
                  <ul className="cap-list" style={{ margin: 0 }}
                      data-test="tr-event-list">
                    {stageEvents.map((e) => (
                      <li key={e.eventUid}
                          className={'cap-list__row '
                            + 'cap-list__row--clickable'}
                          data-test={'tr-event-row-' + e.eventUid}
                          role="button" tabIndex={0}
                          onClick={() => setEditing(e.eventUid)}
                          onKeyDown={(ev) => {
                            if (ev.key === 'Enter' || ev.key === ' ') {
                              ev.preventDefault();
                              setEditing(e.eventUid);
                            }
                          }}>
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
              </>
            )}
          </div>
        </div>
      )}

      <TrackerRelationshipsSection api={api} tei={tei}
                                     programUid={programUid}
                                     orgUnitUid={orgUnitUid}
                                     tetUid={tetUid} />
    </>
  );
}
