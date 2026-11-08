import { useEffect, useMemo, useState } from 'react';
import type { CaptureApi, StageOpt } from '../../shared/types';
import { TrackerRelationshipsSection } from '../TrackerRelationshipsSection';
import { navTracker } from '../../shared/routing';

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
 * Tracker record detail page (NAV-003). Read-only summaries of
 * the tracked entity's identity, enrolments, stage events and
 * relationships. Clicking an event or "Add event" routes to the
 * dedicated stage-form page; this page never renders an editable
 * form inline.
 */
export function TrackerDetailPage(
  { api, programUid, orgUnitUid, teiId }: {
    api: CaptureApi;
    programUid: string;
    orgUnitUid: string;
    teiId: string;
  },
): JSX.Element {
  const [enrolments, setEnrolments] = useState<TrackerEnrolment[]>([]);
  const [selectedEnrolment, setSelectedEnrolment] = useState<string | null>(null);
  const [stages, setStages] = useState<StageOpt[]>([]);
  const [selectedStage, setSelectedStage] = useState<string | null>(null);
  const [stageRepeatable, setStageRepeatable] =
    useState<Map<string, boolean>>(new Map());
  const [events, setEvents] = useState<TrackerEvent[]>([]);
  const [status, setStatus] =
    useState<'idle' | 'loading' | 'err'>('loading');
  const [tetUid, setTetUid] = useState<string | null>(null);
  const [identity, setIdentity] =
    useState<{ displayName: string | null; lastUpdated: string | null }>({
      displayName: null, lastUpdated: null });
  const [statusFilter, setStatusFilter] =
    useState<'all' | 'ACTIVE' | 'COMPLETED'>('all');

  useEffect(() => {
    let cancelled = false;
    setStatus('loading');
    (async () => {
      try {
        const [enrRes, stageRes, tetRes, listRes] = await Promise.all([
          api.listCaptureTeiEnrollments(teiId, programUid),
          api.listCaptureProgramStages(programUid),
          api.getCaptureProgramTeiType(programUid).catch(() => null),
          api.listTrackerEntities(programUid, orgUnitUid, 500)
            .catch(() => ({ trackedEntities: [], instances: [] })),
        ]);
        if (cancelled) return;
        if (tetRes) setTetUid(tetRes.trackedEntityTypeUid);
        // Pluck identity from the working-list payload so we can
        // show a display name without fetching a dedicated endpoint.
        const all = listRes.trackedEntities ?? listRes.instances ?? [];
        const me = all.find((r) =>
          r.trackedEntity === teiId
          || r.trackedEntityInstance === teiId);
        setIdentity({
          displayName: me?.displayName ?? null,
          lastUpdated: me?.lastUpdated ?? null,
        });
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
          id: s.stageUid, displayName: s.displayName,
        })));
        const repMap = new Map<string, boolean>();
        for (const s of stageRes.stages) {
          repMap.set(s.stageUid,
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
  }, [programUid, teiId, orgUnitUid]);

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
  }, [selectedEnrolment]);

  const eventsByStage = useMemo(() => {
    const m = new Map<string, TrackerEvent[]>();
    for (const e of events) {
      const list = m.get(e.programStageUid) ?? [];
      list.push(e);
      m.set(e.programStageUid, list);
    }
    return m;
  }, [events]);

  const rawStageEvents = selectedStage
    ? eventsByStage.get(selectedStage) ?? []
    : [];
  const stageEvents = useMemo(() => {
    const filtered = statusFilter === 'all'
      ? rawStageEvents
      : rawStageEvents.filter((e) => e.status === statusFilter);
    return [...filtered].sort((a, b) => {
      const ad = a.occurredDate ?? a.lastUpdatedAt ?? '';
      const bd = b.occurredDate ?? b.lastUpdatedAt ?? '';
      return bd.localeCompare(ad);
    });
  }, [rawStageEvents, statusFilter]);

  return (
    <>
      <div className="cap-section-head" data-test="tr-dash-head">
        <button type="button"
                className="cap-btn cap-btn--secondary"
                data-test="tr-dash-back"
                title="Back to the working list (Alt+B)"
                onClick={() => navTracker.list(programUid)}
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

      <div className="cap-identity-strip" data-test="tr-identity-strip">
        <div>
          <span className="cap-toolbar__field-label">UID</span>
          <code className="cap-toolbar__ou-code">{teiId}</code>
        </div>
        {identity.displayName && (
          <div>
            <span className="cap-toolbar__field-label">Name</span>
            <strong style={{ marginLeft: 8 }}>{identity.displayName}</strong>
          </div>
        )}
        {identity.lastUpdated && (
          <div>
            <span className="cap-toolbar__field-label">Last updated</span>
            <span style={{ marginLeft: 8, color: '#4a5768',
              fontSize: 13 }}>{identity.lastUpdated}</span>
          </div>
        )}
      </div>

      {status === 'idle' && enrolments.length === 0 && (
        <div className="cap-strip cap-strip--info"
             data-test="tr-no-enrolments"
             style={{ display: 'flex', alignItems: 'center',
               gap: 12 }}>
          <div style={{ flex: 1 }}>
            <strong>This tracked entity has no enrolments in this
              program.</strong>
            {' '}Registering a TEI and enrolling it are separate
            tracker transactions (§TR-012).
          </div>
          <button type="button"
                  className="cap-btn cap-btn--primary"
                  data-test="tr-enrol-cta"
                  title="Open the enrolment form"
                  onClick={() => navTracker.enrol(programUid, teiId)}>
            Enrol in this program
          </button>
        </div>
      )}

      {enrolments.length >= 1 && (
        <div className="cap-section-head" data-test="tr-enrol-section-head">
          <h2 className="cap-section-head__title">Enrolments</h2>
          <span className="cap-section-head__count">
            {enrolments.length} total
          </span>
          <span className="cap-section-head__rule" />
          <button type="button"
                  className="cap-btn cap-btn--secondary"
                  data-test="tr-enrol-add"
                  style={{ padding: '4px 12px', fontSize: 12 }}
                  title="Create another enrolment on this tracked entity"
                  onClick={() => navTracker.enrol(programUid, teiId)}>
            + Enrol again
          </button>
        </div>
      )}
      {enrolments.length >= 1 && (
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
            ) : (
              <>
                <div style={{ display: 'flex',
                  justifyContent: 'space-between', alignItems: 'center',
                  gap: 10, marginBottom: 10 }}>
                  <strong style={{ fontSize: 13, color: '#263352' }}>
                    {stageEvents.length} event
                    {stageEvents.length === 1 ? '' : 's'}
                    {statusFilter !== 'all' && rawStageEvents.length
                      !== stageEvents.length && (
                      <span style={{ color: '#6e7a8a',
                        fontWeight: 400 }}>
                        {' '}· of {rawStageEvents.length}
                      </span>
                    )}
                  </strong>
                  <label style={{ display: 'flex',
                    alignItems: 'center', gap: 6, fontSize: 11,
                    color: '#6e7a8a' }}>
                    status
                    <select className="cap-input__ctl"
                            data-test="tr-status-filter"
                            style={{ padding: '2px 6px', fontSize: 12 }}
                            value={statusFilter}
                            onChange={(e) => setStatusFilter(
                              e.target.value as typeof statusFilter)}>
                      <option value="all">all</option>
                      <option value="ACTIVE">ACTIVE</option>
                      <option value="COMPLETED">COMPLETED</option>
                    </select>
                  </label>
                  {(() => {
                    const repeatable = stageRepeatable.get(selectedStage)
                      ?? false;
                    const disabled = !repeatable
                      && rawStageEvents.length > 0;
                    return (
                      <button type="button"
                              className="cap-btn cap-btn--primary"
                              data-test="tr-add-event"
                              style={{ padding: '4px 12px', fontSize: 12 }}
                              disabled={disabled || !selectedEnrolment}
                              title={disabled
                                ? 'This stage is not repeatable — one '
                                  + 'event already exists (TR-034)'
                                : 'Open the stage form in a new route '
                                  + '(Alt+N)'}
                              onClick={() => navTracker.newEvent(
                                programUid, selectedEnrolment,
                                selectedStage)}>
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
                          onClick={() => navTracker.editEvent(
                            programUid, e.enrollmentUid, e.eventUid)}
                          onKeyDown={(ev) => {
                            if (ev.key === 'Enter' || ev.key === ' ') {
                              ev.preventDefault();
                              navTracker.editEvent(programUid,
                                e.enrollmentUid, e.eventUid);
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

      <TrackerRelationshipsSection api={api} tei={teiId}
                                     programUid={programUid}
                                     orgUnitUid={orgUnitUid}
                                     tetUid={tetUid} />
    </>
  );
}
