import { useEffect, useMemo, useState } from 'react';
import type { CaptureApi, StageOpt } from '../../shared/types';
import { TrackerRelationshipsSection } from '../TrackerRelationshipsSection';
import { TrackerStageEditor } from '../TrackerStageEditor';
import { FormEngine } from '../../shared/FormEngine';
import { parseTeiAttributesForm } from '../../shared/parser';
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
      /** The full set of non-empty TEA values ordered by
       *  sortOrder — fed to the Profile popover so operators
       *  see every captured attribute in one place. Superset of
       *  `attributes` (which is capped at 4 for the top-toolbar
       *  summary). */
      allAttributes: ReadonlyArray<{ label: string; value: string }>;
      /** Raw TEA uid → value map used to pre-fill the profile-edit
       *  form so operators change only what needs changing. */
      rawAttributes: Readonly<Record<string, string>>;
    }>({
      displayName: null, lastUpdated: null,
      attributes: [], allAttributes: [], rawAttributes: {} });
  /** Inline stage-form mode. When non-null, the stage pane body
   *  swaps from the event list to the TrackerStageEditor so the
   *  operator never leaves the tracker detail page. { kind:
   *  'new' } for "+ Add event"; { kind: 'edit', eventId } when
   *  clicking an existing row. On save/cancel we flip back to the
   *  list and trigger a refetch via eventsTick. */
  const [stageFormMode, setStageFormMode] =
    useState<null | { kind: 'new' | 'edit'; eventId: string | null }>(null);
  /** Monotonic counter — bumping it re-triggers the events
   *  effect without having to toggle selectedEnrolment. */
  const [eventsTick, setEventsTick] = useState(0);
  const [statusFilter, setStatusFilter] =
    useState<'all' | 'ACTIVE' | 'COMPLETED'>('all');
  /** Profile popover — opens from the toolbar "View profile" button
   *  and shows the full TEA attribute set with labels. Keeps the
   *  existing toolbar-identity strip compact (4 attributes max)
   *  while making every captured attribute discoverable in one
   *  click. */
  const [profileOpen, setProfileOpen] = useState(false);

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
        let allAttrs: ReadonlyArray<{ label: string; value: string }> = [];
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
              const full: Array<{ label: string; value: string }> = [];
              for (const a of ordered) {
                const v = me.attributes[a.attributeUid];
                if (!v || String(v).trim() === '') continue;
                full.push({
                  label: byUid.get(a.attributeUid) ?? a.attributeUid,
                  value: String(v),
                });
              }
              attrs = full.slice(0, 4);
              allAttrs = full;
            }
          } catch { /* keep attrs empty on failure */ }
        }
        setIdentity({
          displayName: me?.displayName ?? null,
          lastUpdated: me?.lastUpdated ?? null,
          attributes: attrs,
          allAttributes: allAttrs,
          rawAttributes: me?.attributes ?? {},
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
  }, [selectedEnrolment, eventsTick]);

  // Flipping to a different stage closes any open stage form —
  // operators would otherwise see the wrong stage's form after
  // swapping rails without noticing.
  useEffect(() => {
    setStageFormMode(null);
  }, [selectedStage]);

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
        <div className="cap-section-head__right">
          {identity.allAttributes.length > 0 && (
            <button type="button"
                    className="cap-btn cap-btn--secondary"
                    data-test="tr-profile-open"
                    style={{ padding: '4px 12px', fontSize: 12 }}
                    title="See every captured attribute for this tracked entity"
                    onClick={() => setProfileOpen(true)}>
              View profile
            </button>
          )}
          {selectedEnrolment && (
            <button type="button"
                    className="cap-btn cap-btn--secondary"
                    data-test="tr-notes-jump"
                    style={{ padding: '4px 12px', fontSize: 12 }}
                    title="Jump to the Notes section below"
                    onClick={() => {
                      const el = document.querySelector(
                        '[data-test="tr-notes-head"]');
                      if (el) el.scrollIntoView({ behavior: 'smooth',
                        block: 'start' });
                    }}>
              Notes
            </button>
          )}
          <button type="button"
                  className="cap-btn cap-btn--secondary"
                  data-test="tr-relationships-jump"
                  style={{ padding: '4px 12px', fontSize: 12 }}
                  title="Jump to the Relationships section below"
                  onClick={() => {
                    const el = document.querySelector(
                      '[data-test="tr-rel-head"]');
                    if (el) el.scrollIntoView({ behavior: 'smooth',
                      block: 'start' });
                  }}>
            Relationships
          </button>
          {enrolments.length >= 1 && (
            <button type="button"
                    className="cap-btn cap-btn--secondary"
                    data-test="tr-enrol-add"
                    style={{ padding: '4px 12px', fontSize: 12 }}
                    title="Create another enrolment on this tracked entity"
                    onClick={() => navTracker.enrol(programUid, teiId)}>
              + Enrol again
            </button>
          )}
        </div>
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

      {/* Enrolments list — no separate section head; the count
       *  lives on the top toolbar ("1 enrolment") and the
       *  + Enrol again action moved there too, so the operator
       *  sees one consolidated header instead of two stacked
       *  rows. */}
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
            ) : stageFormMode && selectedEnrolment ? (
              /* Inline stage form — stays inside the pane instead
               * of navigating to a separate route. On save/cancel
               * the pane flips back to the event list (refetched
               * via eventsTick). */
              <div data-test="tr-stage-pane-form">
                <div style={{ display: 'flex', alignItems: 'center',
                  gap: 14, marginBottom: 12, flexWrap: 'wrap' }}>
                  <button type="button"
                          className="cap-btn cap-btn--secondary"
                          data-test="tr-stageform-back"
                          style={{ padding: '4px 10px', fontSize: 12 }}
                          onClick={() => setStageFormMode(null)}
                          title="Back to the event list (Alt+B)">
                    ← Back to events
                  </button>
                  <strong style={{ fontSize: 14,
                    color: 'var(--der-text)' }}>
                    {stageFormMode.kind === 'edit'
                      ? 'Edit stage event' : 'New stage event'}
                  </strong>
                </div>
                <TrackerStageEditor
                  api={api}
                  programUid={programUid}
                  stageUid={selectedStage}
                  enrolmentUid={selectedEnrolment}
                  orgUnitUid={orgUnitUid}
                  eventUid={stageFormMode.eventId}
                  onSaved={() => {
                    setStageFormMode(null);
                    setEventsTick((t) => t + 1);
                  }}
                  onCancel={() => setStageFormMode(null)} />
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
                                  + 'event already exists'
                                : 'Open the stage form inline (Alt+N)'}
                              onClick={() => setStageFormMode({
                                kind: 'new', eventId: null })}>
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
                          onClick={() => setStageFormMode({
                            kind: 'edit', eventId: e.eventUid })}
                          onKeyDown={(ev) => {
                            if (ev.key === 'Enter' || ev.key === ' ') {
                              ev.preventDefault();
                              setStageFormMode({
                                kind: 'edit', eventId: e.eventUid });
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

      {selectedEnrolment && (
        <EnrolmentNotesSection api={api}
                                enrollmentUid={selectedEnrolment} />
      )}
      <TrackerRelationshipsSection api={api} tei={teiId}
                                     programUid={programUid}
                                     orgUnitUid={orgUnitUid}
                                     tetUid={tetUid} />
      {profileOpen && (
        <ProfilePopover
          api={api}
          displayName={identity.displayName}
          teiId={teiId}
          tetUid={tetUid}
          orgUnitUid={orgUnitUid}
          rawAttributes={identity.rawAttributes}
          attributes={identity.allAttributes}
          onClose={() => setProfileOpen(false)}
          onSaved={() => {
            // Re-run the top-level load to pick up new attribute
            // values. Simplest refresh — the whole detail page
            // rebuilds, but it's fast + the operator just closed
            // a modal so there's no scroll state to preserve.
            setProfileOpen(false);
            setStatus('loading');
            (async () => {
              // Force the useEffect by toggling a dep — easier
              // path: refetch the tracker-entities list inline.
              const r = await api.listTrackerEntities(
                programUid, orgUnitUid, 500)
                .catch(() => ({ trackedEntities: [], instances: [] }));
              const all = r.trackedEntities ?? r.instances ?? [];
              const me = all.find((x) => x.trackedEntity === teiId
                || x.trackedEntityInstance === teiId);
              if (me && tetUid) {
                const teaRes = await api.listCaptureTeiTypeAttributes(tetUid)
                  .catch(() => ({ attributes: [] }));
                const byUid = new Map<string, string>();
                const ordered = [...teaRes.attributes].sort(
                  (a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
                for (const a of ordered) {
                  byUid.set(a.attributeUid,
                    a.displayName ?? a.attributeUid);
                }
                const full: Array<{ label: string; value: string }> = [];
                for (const a of ordered) {
                  const v = me.attributes?.[a.attributeUid];
                  if (!v || String(v).trim() === '') continue;
                  full.push({
                    label: byUid.get(a.attributeUid) ?? a.attributeUid,
                    value: String(v),
                  });
                }
                setIdentity((prev) => ({
                  ...prev,
                  attributes: full.slice(0, 4),
                  allAttributes: full,
                  rawAttributes: me.attributes ?? {},
                }));
              }
              setStatus('idle');
            })();
          }} />
      )}
    </>
  );
}

function ProfilePopover(
  { api, displayName, teiId, tetUid, orgUnitUid, rawAttributes,
    attributes, onClose, onSaved }: {
    api: CaptureApi;
    displayName: string | null;
    teiId: string;
    tetUid: string | null;
    orgUnitUid: string;
    rawAttributes: Readonly<Record<string, string>>;
    attributes: ReadonlyArray<{ label: string; value: string }>;
    onClose: () => void;
    onSaved: () => void;
  },
): JSX.Element {
  const [mode, setMode] = useState<'view' | 'edit'>('view');
  const [sections, setSections] =
    useState<ReadonlyArray<ReturnType<
      typeof parseTeiAttributesForm>['sections'][number]>>([]);
  const [values, setValues] = useState<Record<string, string>>(
    { ...rawAttributes });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (mode !== 'edit' || !tetUid) return;
    let cancelled = false;
    (async () => {
      try {
        const teaRes = await api.listCaptureTeiTypeAttributes(tetUid);
        if (cancelled) return;
        const parsed = parseTeiAttributesForm(teaRes.attributes);
        setSections(parsed.sections);
      } catch (e) {
        if (!cancelled) setErr((e as Error).message ?? 'Failed to load');
      }
    })();
    return () => { cancelled = true; };
  }, [mode, tetUid, api]);

  async function save(): Promise<void> {
    if (!tetUid) return;
    setSaving(true);
    setErr(null);
    try {
      // Drop empty values so we don't clear an attribute by accident
      // when the operator just didn't touch an unfilled field.
      const toSubmit: Record<string, string> = {};
      for (const [k, v] of Object.entries(values)) {
        if (v && v.trim() !== '') toSubmit[k] = v;
      }
      await api.updateTeiAttributes({
        teiUid: teiId,
        trackedEntityType: tetUid,
        orgUnit: orgUnitUid,
        attributes: toSubmit,
      });
      onSaved();
    } catch (e) {
      setErr((e as Error).message ?? 'Save failed');
      setSaving(false);
    }
  }
  return (
    <div className="cap-info-backdrop" role="dialog" aria-modal="true"
         data-test="tr-profile-popover" onClick={onClose}>
      <div className="cap-info"
           onClick={(e) => e.stopPropagation()}
           style={{ maxWidth: mode === 'edit' ? 820 : 560 }}>
        <div className="cap-info__head">
          <h3>{mode === 'edit' ? 'Edit profile' : 'Profile'}</h3>
          <div style={{ display: 'flex', alignItems: 'center',
                        gap: 8 }}>
            {mode === 'view' && tetUid && (
              <button type="button"
                      className="cap-btn cap-btn--secondary"
                      data-test="tr-profile-edit"
                      style={{ padding: '4px 12px', fontSize: 12 }}
                      onClick={() => setMode('edit')}>
                Edit
              </button>
            )}
            <button type="button" className="cap-info__close"
                    aria-label="Close profile" onClick={onClose}>×</button>
          </div>
        </div>
        <div className="cap-info__body">
          {displayName && mode === 'view' && (
            <p style={{ margin: '0 0 12px 0', fontSize: 15,
              fontWeight: 500, color: 'var(--der-text)' }}>
              {displayName}
            </p>
          )}
          {mode === 'view' ? (
            attributes.length === 0 ? (
              <p className="cap-sub">
                No attributes captured for this tracked entity yet.
              </p>
            ) : (
              <dl className="cap-profile-grid">
                {attributes.map((a) => (
                  <div key={a.label}>
                    <dt>{a.label}</dt>
                    <dd>{a.value}</dd>
                  </div>
                ))}
              </dl>
            )
          ) : (
            <>
              {err && (
                <div className="cap-strip cap-strip--err"
                     data-test="tr-profile-err">
                  {err}
                </div>
              )}
              {sections.length === 0 ? (
                <p className="cap-sub">Loading attributes…</p>
              ) : (
                <FormEngine api={api} sections={sections}
                             values={values}
                             onChange={(k, v) => setValues(
                               (prev) => ({ ...prev, [k]: v }))} />
              )}
              <div style={{ display: 'flex', justifyContent: 'flex-end',
                gap: 10, marginTop: 14, paddingTop: 14,
                borderTop: '1px solid var(--der-border-soft)' }}>
                <button type="button"
                        className="cap-btn cap-btn--secondary"
                        data-test="tr-profile-cancel"
                        onClick={() => { setMode('view'); setErr(null); }}
                        disabled={saving}>
                  Cancel
                </button>
                <button type="button"
                        className="cap-btn cap-btn--primary"
                        data-test="tr-profile-save"
                        onClick={() => { void save(); }}
                        disabled={saving || sections.length === 0}>
                  {saving ? 'Saving…' : 'Save changes'}
                </button>
              </div>
            </>
          )}
          <p style={{ margin: '14px 0 0 0', fontSize: 11,
            color: 'var(--der-text-muted)' }}>
            UID{' '}
            <code style={{ background: 'var(--der-surface-subtle)',
              padding: '1px 5px', borderRadius: 3 }}>
              {teiId}
            </code>
          </p>
        </div>
      </div>
    </div>
  );
}

/** Dashboard slice D — enrolment notes section. Append-only
 *  list below the stage pane with an inline textarea for a new
 *  note. Mirrors DHIS2's Note model (immutable once posted). */
function EnrolmentNotesSection(
  { api, enrollmentUid }: {
    api: CaptureApi; enrollmentUid: string;
  },
): JSX.Element {
  const [notes, setNotes] = useState<ReadonlyArray<{
    noteUid: string; noteText: string; createdAt: string;
  }>>([]);
  const [draft, setDraft] = useState('');
  const [saving, setSaving] = useState(false);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const rows = await api.listEnrolmentNotes(enrollmentUid);
        if (!cancelled) setNotes(rows);
      } catch { if (!cancelled) setNotes([]); }
    })();
    return () => { cancelled = true; };
  }, [enrollmentUid, tick]);

  async function submit(): Promise<void> {
    const text = draft.trim();
    if (text === '' || saving) return;
    setSaving(true);
    try {
      const created = await api.addEnrolmentNote(enrollmentUid, text);
      if (created) {
        setDraft('');
        setTick((t) => t + 1);
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <div className="cap-section-head" data-test="tr-notes-head">
        <h2 className="cap-section-head__title">Notes</h2>
        <span className="cap-section-head__count">
          {notes.length === 0 ? 'none yet'
            : `${notes.length} note${notes.length === 1 ? '' : 's'}`}
        </span>
        <span className="cap-section-head__rule" />
      </div>
      <div style={{ margin: '0 20px 14px 20px',
        display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end' }}>
          <textarea
            className="cap-input__ctl"
            data-test="tr-notes-draft"
            rows={2}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Write a note about this enrolment…"
            style={{ flex: 1, fontFamily: 'inherit', resize: 'vertical' }} />
          <button type="button"
                  className="cap-btn cap-btn--primary"
                  data-test="tr-notes-add"
                  disabled={draft.trim() === '' || saving}
                  onClick={() => { void submit(); }}
                  style={{ padding: '7px 16px', fontSize: 13,
                    alignSelf: 'flex-end' }}>
            {saving ? 'Saving…' : 'Add note'}
          </button>
        </div>
        {notes.length === 0 ? (
          <div className="cap-placeholder" data-test="tr-notes-empty"
               style={{ margin: 0 }}>
            No notes on this enrolment yet.
          </div>
        ) : (
          <ul className="cap-list" style={{ margin: 0 }}
              data-test="tr-notes-list">
            {notes.map((n) => (
              <li key={n.noteUid} className="cap-list__row"
                  style={{ gridTemplateColumns: '1fr auto',
                    cursor: 'default' }}>
                <div style={{ whiteSpace: 'pre-wrap',
                  lineHeight: 1.4 }}>{n.noteText}</div>
                <span className="cap-list__when">
                  {formatTimestamp(n.createdAt)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
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
