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
    useState<{
      displayName: string | null;
      lastUpdated: string | null;
      /** Ordered list of (label, value) pairs for the top TEA
       *  attributes so operators see who this person is at a
       *  glance (name, age, phone, …) instead of just a UID. */
      attributes: ReadonlyArray<{ label: string; value: string }>;
    }>({
      displayName: null, lastUpdated: null, attributes: [] });
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
        // Resolve TEA uid → display name so attribute cells carry
        // human labels instead of opaque UIDs. Pull the TEI-type's
        // attribute metadata; label the top non-empty attribute
        // values in the identity strip.
        let attrs: ReadonlyArray<{ label: string; value: string }> = [];
        if (tetRes && me?.attributes) {
          try {
            const teaRes = await api.listCaptureTeiTypeAttributes(
              tetRes.trackedEntityTypeUid);
            if (!cancelled) {
              const byUid = new Map<string, string>();
              const ordered = [...teaRes.attributes].sort(
                (a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
              for (const a of ordered) {
                byUid.set(a.attributeUid,
                  a.displayName ?? a.attributeUid);
              }
              const entries: Array<{ label: string; value: string }> = [];
              for (const a of ordered) {
                const v = me.attributes[a.attributeUid];
                if (!v || String(v).trim() === '') continue;
                entries.push({
                  label: byUid.get(a.attributeUid) ?? a.attributeUid,
                  value: String(v),
                });
                if (entries.length >= 4) break;
              }
              attrs = entries;
            }
          } catch { /* keep attrs empty on failure */ }
        }
        setIdentity({
          displayName: me?.displayName ?? null,
          lastUpdated: me?.lastUpdated ?? null,
          attributes: attrs,
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
        {/* Identity metadata inline in the toolbar — uppercase
         *  muted label + value, matches the identity-strip style
         *  that used to render on a second row below. */}
        <span className="cap-section-head__rule" />
        <span className="cap-section-head__meta"
              data-test="tr-identity-strip">
          {identity.displayName && (
            <span className="cap-section-head__meta-item">
              <strong>Name</strong>
              <span>{identity.displayName}</span>
            </span>
          )}
          {identity.attributes.map((a) => (
            <span key={a.label} className="cap-section-head__meta-item">
              <strong>{a.label}</strong>
              <span>{a.value}</span>
            </span>
          ))}
          {identity.lastUpdated && (
            <span className="cap-section-head__meta-item">
              <strong>Updated</strong>
              <span>{formatTimestamp(identity.lastUpdated)}</span>
            </span>
          )}
          <span className="cap-section-head__meta-item">
            <strong>UID</strong>
            <code>{teiId}</code>
          </span>
        </span>
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
                <strong>Enrolled {formatDateOnly(e.enrollmentDate
                  ?? e.lastUpdatedAt)}</strong>
                {e.status && (
                  <span className={'cap-status cap-status--'
                      + (e.status === 'COMPLETED' ? 'ok' : 'active')}
                        style={{ marginLeft: 10 }}>
                    {formatStatusLabel(e.status)}
                  </span>
                )}
                <code style={{ marginLeft: 10,
                  background: 'var(--der-surface-subtle)',
                  padding: '2px 6px', borderRadius: 3,
                  fontSize: 11, color: 'var(--der-text-muted)' }}>
                  {e.enrollmentUid}
                </code>
              </div>
              <span className="cap-list__when">
                {formatTimestamp(e.lastUpdatedAt)}
              </span>
            </li>
          ))}
        </ul>
      )}

      {selectedEnrolment && (
        <div className="cap-stage-layout" data-test="tr-stage-layout">
          <nav className="cap-stage-rail" aria-label="Program stages"
               data-test="tr-stage-rail">
            <div className="cap-stage-rail__title">Stages</div>
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
              <div className="cap-placeholder"
                   data-test="tr-stage-pane-unselected"
                   style={{ margin: 0 }}>
                Pick a stage on the left to see its events.
              </div>
            ) : (
              <>
                <div style={{ display: 'flex', alignItems: 'center',
                  gap: 14, marginBottom: 12, flexWrap: 'wrap' }}>
                  <strong style={{ fontSize: 14,
                    color: 'var(--der-text)' }}>
                    {stageEvents.length} event
                    {stageEvents.length === 1 ? '' : 's'}
                    {statusFilter !== 'all' && rawStageEvents.length
                      !== stageEvents.length && (
                      <span style={{ color: 'var(--der-text-muted)',
                        fontWeight: 400 }}>
                        {' '}· of {rawStageEvents.length}
                      </span>
                    )}
                  </strong>
                  <span style={{ flex: 1 }} />
                  <label className="cap-section-head__inline">
                    <span className="cap-section-head__inline-label">
                      Status
                    </span>
                    <select className="cap-section-head__inline-ctl"
                            data-test="tr-status-filter"
                            value={statusFilter}
                            onChange={(e) => setStatusFilter(
                              e.target.value as typeof statusFilter)}>
                      <option value="all">All</option>
                      <option value="ACTIVE">Active</option>
                      <option value="COMPLETED">Completed</option>
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
                  <div className="cap-placeholder"
                       data-test="tr-stage-pane-empty"
                       style={{ margin: 0 }}>
                    No events for this stage yet. Use
                    <strong style={{ padding: '0 4px' }}>
                      + Add event
                    </strong>
                    above to capture one.
                  </div>
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
                          <strong>{formatDateOnly(e.occurredDate
                            ?? e.lastUpdatedAt)}</strong>
                          {e.status && (
                            <span className={'cap-status cap-status--'
                                + (e.status === 'COMPLETED'
                                  ? 'ok' : 'active')}
                                  style={{ marginLeft: 10 }}>
                              {formatStatusLabel(e.status)}
                            </span>
                          )}
                          <code style={{ marginLeft: 10,
                            background: 'var(--der-surface-subtle)',
                            padding: '2px 6px', borderRadius: 3,
                            fontSize: 11,
                            color: 'var(--der-text-muted)' }}>
                            {e.eventUid.slice(0, 8)}…
                          </code>
                        </div>
                        <span className="cap-list__when">
                          {formatTimestamp(e.lastUpdatedAt)}
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

/** Human-readable timestamp for the identity strip + list rows.
 *  Falls back to the raw string if unparseable (never swallows a
 *  malformed server value). */
function formatTimestamp(iso: string): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  // Date-only values (YYYY-MM-DD) show just the day; full
  // timestamps include time for recency context.
  if (/^\d{4}-\d{2}-\d{2}$/.test(iso)) {
    return d.toLocaleDateString(undefined,
      { year: 'numeric', month: 'short', day: 'numeric' });
  }
  return d.toLocaleString(undefined, {
    year: 'numeric', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function formatDateOnly(iso: string | null): string {
  if (!iso) return '—';
  const slice = iso.length >= 10 ? iso.slice(0, 10) : iso;
  const d = new Date(slice);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined,
    { year: 'numeric', month: 'short', day: 'numeric' });
}

function formatStatusLabel(s: string | null | undefined): string {
  if (!s) return '—';
  if (s === 'ACTIVE') return 'Active';
  if (s === 'COMPLETED') return 'Completed';
  if (s === 'SCHEDULE' || s === 'SCHEDULED') return 'Scheduled';
  if (s === 'OVERDUE') return 'Overdue';
  if (s === 'VISITED') return 'Visited';
  if (s === 'SKIPPED') return 'Skipped';
  return s;
}
