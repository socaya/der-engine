import { useCallback, useEffect, useMemo, useState } from 'react';
import type { CaptureApi, StageOpt } from '../../shared/types';
import { TrackerRelationshipsSection } from '../TrackerRelationshipsSection';
import { TrackerStageEditor } from '../TrackerStageEditor';
import { FormEngine } from '../../shared/FormEngine';
import { parseTeiAttributesForm } from '../../shared/parser';
import { navTracker } from '../../shared/routing';
import { RowActions } from '../../shared/RowActions';
import { exportHtmlAsPdf } from '../../shared/pdfExport';
import {
  derPdfDocument, derPdfIdentity, derPdfSectionTitle, derPdfPill,
} from '../../shared/pdfTemplate';

export interface TrackerEnrolment {
  readonly enrollmentUid: string;
  readonly programUid: string;
  readonly orgUnitUid: string;
  readonly status: string | null;
  readonly enrollmentDate: string | null;
  readonly incidentDate: string | null;
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
  { api, programUid, orgUnitUid, teiId, focusEnrollmentId,
    section, stageId }: {
    api: CaptureApi;
    programUid: string;
    orgUnitUid: string;
    teiId: string;
    /** Optional enrolment UID to pre-select when the page mounts
     *  — passed via `?enrolment=UID` by relationship-list opens
     *  so the dashboard visibly jumps to that enrolment instead
     *  of defaulting to the newest one. Falls through silently if
     *  the referenced enrolment isn't in the TEI's list. */
    focusEnrollmentId?: string | null;
    /** Which rail section the URL asked us to open on. Null →
     *  Profile (default). */
    section?: 'profile' | 'notes' | 'relationships' | 'stage' | null;
    /** When section === 'stage', which stage UID to pin. Null →
     *  first stage. */
    stageId?: string | null;
  },
): JSX.Element {
  const [enrolments, setEnrolments] = useState<TrackerEnrolment[]>([]);
  const [selectedEnrolment, setSelectedEnrolment] = useState<string | null>(null);
  const [stages, setStages] = useState<StageOpt[]>([]);
  const [selectedStage, setSelectedStage] = useState<string | null>(null);
  /** Unified rail selection — the sidebar is a navigation surface
   *  for Profile + stages + Notes + Relationships, so we track
   *  which "kind" of content the pane is showing. Stage selection
   *  is kept in selectedStage for back-compat with the existing
   *  pane logic. Profile opens by default: it's the "what / who"
   *  landing surface for the record, consistent with how clinical
   *  record systems lead with identity before timeline. */
  const [railKind, setRailKind] =
    useState<'profile' | 'stage' | 'notes' | 'relationships'>(
      section ?? 'profile');
  // URL → state: when the hash section changes, swing the rail +
  // selected stage to match. Lets operators deep-link, bookmark, and
  // share the exact view they were on.
  useEffect(() => {
    if (section && section !== railKind) {
      setRailKind(section);
    }
    if (section === 'stage' && stageId
        && stageId !== selectedStage) {
      setSelectedStage(stageId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [section, stageId]);
  /** Counts shown on the Notes + Relationships rail items so the
   *  operator sees them at a glance (mirrors the per-stage event
   *  count chip). Fetched when selectedEnrolment flips. */
  const [notesCount, setNotesCount] = useState<number>(0);
  const [relationshipsCount, setRelationshipsCount] = useState<number>(0);
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
  /** Same pattern for the enrolment list — bumped after a
   *  status change or delete so the switcher reflects the
   *  new state without a full page reload. */
  const [enrolTick, setEnrolTick] = useState(0);
  const [statusFilter, setStatusFilter] =
    useState<'all' | 'ACTIVE' | 'COMPLETED'>('all');
  /** Profile popover — opens from the toolbar "View profile" button
   *  and shows the full TEA attribute set with labels. Keeps the
   *  existing toolbar-identity strip compact (4 attributes max)
   *  while making every captured attribute discoverable in one
   *  click. */
  /** Refetch just the identity (TEI attributes) without reloading the
   *  whole page. Called from TrackerProfilePane after a successful
   *  profile edit so the rail + strip pick up the new values. */
  const refetchIdentity = useCallback(async (): Promise<void> => {
    if (!tetUid) return;
    const r = await api.listTrackerEntities(programUid, orgUnitUid, 500)
      .catch(() => ({ trackedEntities: [], instances: [] }));
    const all = r.trackedEntities ?? r.instances ?? [];
    const me = all.find((x) => x.trackedEntity === teiId
      || x.trackedEntityInstance === teiId);
    if (!me) return;
    const teaRes = await api.listCaptureTeiTypeAttributes(tetUid)
      .catch(() => ({ attributes: [] }));
    const byUid = new Map<string, string>();
    const ordered = [...teaRes.attributes].sort(
      (a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
    for (const a of ordered) {
      byUid.set(a.attributeUid, a.displayName ?? a.attributeUid);
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
      displayName: me.displayName ?? prev.displayName,
      lastUpdated: me.lastUpdated ?? prev.lastUpdated,
      attributes: full.slice(0, 4),
      allAttributes: full,
      rawAttributes: me.attributes ?? {},
    }));
  }, [api, programUid, orgUnitUid, teiId, tetUid]);

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
          incidentDate: e.incidentDate,
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
          const focused = focusEnrollmentId
            && enr.some((e) => e.enrollmentUid === focusEnrollmentId)
            ? focusEnrollmentId
            : enr[0]!.enrollmentUid;
          setSelectedEnrolment(focused);
          // When opened via ?enrolment= from a relationship row,
          // swing the rail to the enrolment's first stage so the
          // user visibly lands ON the enrolment content. Without
          // this the pane stays on whatever the previous view was
          // (often "Relationships" — where they clicked the link),
          // so the navigation looks like it did nothing.
          if (focusEnrollmentId
              && enr.some((e) => e.enrollmentUid === focusEnrollmentId)) {
            const firstStage = stageRes.stages[0]?.stageUid ?? null;
            if (firstStage) {
              setSelectedStage(firstStage);
              setRailKind('stage');
            } else {
              setRailKind('profile');
            }
          }
        }
        setStatus('idle');
      } catch {
        if (!cancelled) setStatus('err');
      }
    })();
    return () => { cancelled = true; };
  }, [programUid, teiId, orgUnitUid, focusEnrollmentId, enrolTick]);

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

  // Rail chip counts for Notes + Relationships. Refetched when
  // enrolment flips OR when the operator just added one (bump via
  // railCountsTick). Null enrolment = zero out.
  const [railCountsTick, setRailCountsTick] = useState(0);
  /** Whether at least one relationship type is configured for the
   *  current TET. Used to hide the Relationships rail item entirely
   *  when the program's metadata has no types configured — avoids
   *  a dead rail entry that can't lead anywhere. If the TET is
   *  unknown we optimistically show the rail (the component itself
   *  will render an appropriate empty state). */
  const [relTypesConfigured, setRelTypesConfigured] =
    useState<boolean>(true);
  useEffect(() => {
    if (!selectedEnrolment) {
      setNotesCount(0);
      setRelationshipsCount(0);
      return;
    }
    let cancelled = false;
    (async () => {
      const [ns, rs] = await Promise.all([
        api.listEnrolmentNotes(selectedEnrolment).catch(() => []),
        api.listTrackerRelationships(teiId).catch(() => []),
      ]);
      if (cancelled) return;
      setNotesCount(ns.length);
      setRelationshipsCount(rs.length);
    })();
    return () => { cancelled = true; };
  }, [selectedEnrolment, teiId, railCountsTick, api]);

  // Detect whether any relationship types exist for this TET so
  // the rail entry can hide when the program has zero relationship
  // metadata configured (spec §REL-C-002 / operator feedback: "if
  // no relationships are configured on a program, hide that
  // section"). We re-check when tetUid resolves.
  useEffect(() => {
    if (!tetUid) { setRelTypesConfigured(true); return; }
    let cancelled = false;
    (async () => {
      try {
        const types = await api.listRelationshipTypes(tetUid);
        if (!cancelled) {
          setRelTypesConfigured((types ?? []).length > 0);
        }
      } catch {
        // On fetch failure leave the rail visible — safer than
        // silently hiding a feature the operator might need.
        if (!cancelled) setRelTypesConfigured(true);
      }
    })();
    return () => { cancelled = true; };
  }, [tetUid, api]);

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
                style={{ padding: '5px 13px', fontSize: 13 }}>
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
          {/* Enrolment context — compact select when the TEI has
           *  more than one, read-only chip for solo. Keeps the
           *  enrolment switcher inside the strip so there's no
           *  duplicate row below the dashboard content. */}
          {enrolments.length > 0 && (() => {
            const sel = enrolments.find(
              (x) => x.enrollmentUid === selectedEnrolment)
              ?? enrolments[0]!;
            const statusTxt = sel.status
              ? formatStatusLabel(sel.status) : '';
            return (
              <>
                <span className="cap-section-head__meta-item">
                  <strong>Enrolment</strong>
                  {enrolments.length > 1 ? (
                    <select className="cap-section-head__enrol-sel"
                            data-test="tr-enrol-switcher"
                            value={sel.enrollmentUid}
                            onChange={(e) => setSelectedEnrolment(
                              e.target.value)}>
                      {enrolments.map((en) => (
                        <option key={en.enrollmentUid}
                                value={en.enrollmentUid}>
                          {'Enrolled '
                            + formatDateOnly(en.enrollmentDate
                              ?? en.lastUpdatedAt)
                            + (en.status
                              ? ' · ' + formatStatusLabel(en.status)
                              : '')}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <span>
                      Enrolled {formatDateOnly(sel.enrollmentDate
                        ?? sel.lastUpdatedAt)}
                    </span>
                  )}
                </span>
                {statusTxt && (
                  <span className="cap-section-head__meta-item">
                    <strong>Status</strong>
                    <span className={'cap-status cap-status--'
                      + (sel.status === 'COMPLETED' ? 'ok' : 'active')}>
                      {statusTxt}
                    </span>
                  </span>
                )}
                {sel.incidentDate && (
                  <span className="cap-section-head__meta-item">
                    <strong>Incident</strong>
                    <span>{formatDateOnly(sel.incidentDate)}</span>
                  </span>
                )}
              </>
            );
          })()}
          {identity.attributes.map((a, i) => (
            <span key={`${a.label}:${i}`}
                  className={'cap-section-head__meta-item '
                    + 'cap-section-head__meta-item--tea'}>
              <strong>{a.label}</strong>
              <span>{a.value}</span>
            </span>
          ))}
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
                    style={{ padding: '5px 13px', fontSize: 13 }}
                    title="Jump to the Profile section in the rail"
                    onClick={() => setRailKind('profile')}>
              View profile
            </button>
          )}
          {/* Notes + Relationships live in the stages rail now
           *  (see below), so the toolbar jump-links are gone. */}
          {enrolments.length >= 1 && (
            <button type="button"
                    className="cap-btn cap-btn--secondary"
                    data-test="tr-enrol-add"
                    style={{ padding: '5px 13px', fontSize: 13 }}
                    title="Create another enrolment on this tracked entity"
                    onClick={() => navTracker.enrol(programUid, teiId)}>
              + Enrol again
            </button>
          )}
          <RowActions
            label="Tracked entity actions"
            dataTest="tr-tei-actions"
            actions={(() => {
              type Act = {
                label: string;
                onSelect: () => void;
                destructive?: boolean;
                title?: string;
              };
              const acts: Act[] = [];
              // Enrolment lifecycle acts on the currently-selected
              // enrolment (header's select controls which one when
              // the TEI has more than one). Keeping the actions in
              // this one menu avoids a second switcher row below
              // the profile pane.
              const e = enrolments.find(
                (x) => x.enrollmentUid === selectedEnrolment)
                ?? enrolments[0];
              if (e) {
                const isCompleted = e.status === 'COMPLETED';
                acts.push({
                  label: isCompleted
                    ? 'Reopen enrolment'
                    : 'Mark enrolment complete',
                  title: isCompleted
                    ? 'Set the enrolment status back to ACTIVE'
                    : 'Set the enrolment status to COMPLETED',
                  onSelect: () => {
                    void (async () => {
                      try {
                        await api.createEnrollment({
                          enrollmentUid: e.enrollmentUid,
                          teiUid: teiId,
                          programUid: e.programUid,
                          orgUnitUid: e.orgUnitUid,
                          enrollmentDate:
                            e.enrollmentDate ?? new Date()
                              .toISOString().slice(0, 10),
                          incidentDate: e.incidentDate ?? undefined,
                          status: isCompleted
                            ? 'ACTIVE' : 'COMPLETED',
                        });
                        setEnrolTick((t) => t + 1);
                      } catch (err) {
                        window.alert('Failed to update enrolment: '
                          + ((err as Error).message
                            ?? 'unknown error'));
                      }
                    })();
                  },
                });
                acts.push({
                  label: 'Delete enrolment',
                  destructive: true,
                  title: 'Soft-delete the enrolment + its events '
                    + 'on the edge, queued for central sync',
                  onSelect: () => {
                    const ok = window.confirm('Delete this '
                      + 'enrolment? The enrolment + its events are '
                      + 'soft-deleted on the facility edge and '
                      + 'queued for central sync.');
                    if (!ok) return;
                    void (async () => {
                      try {
                        await api.deleteEnrollment(e.enrollmentUid);
                        setEnrolTick((t) => t + 1);
                        setSelectedEnrolment(null);
                      } catch (err) {
                        window.alert('Failed to delete enrolment: '
                          + ((err as Error).message
                            ?? 'unknown error'));
                      }
                    })();
                  },
                });
              }
              acts.push({
                label: 'Delete tracked entity',
                destructive: true,
                title: 'Soft-delete the TEI + its enrolments + '
                  + 'events on the edge, queued for central sync',
                onSelect: () => {
                  const ok = window.confirm('Delete this tracked '
                    + 'entity? Its enrolments and stage events are '
                    + 'soft-deleted on the facility edge and queued '
                    + 'for central sync on the next drain.');
                  if (!ok) return;
                  void (async (): Promise<void> => {
                    try {
                      await api.deleteTrackedEntity(teiId);
                      navTracker.list(programUid);
                    } catch (err) {
                      window.alert('Failed to delete tracked entity: '
                        + ((err as Error).message
                          ?? 'unknown error'));
                    }
                  })();
                },
              });
              return acts;
            })()} />
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

      {selectedEnrolment && (
        <div className="cap-stage-layout" data-test="tr-stage-layout">
          <nav className="cap-stage-rail" aria-label="Record navigation"
               data-test="tr-stage-rail">
            {/* Flat rail — Profile first, then stages, then Notes
             *  + Relationships. No section header, no dividers;
             *  every item carries a modern stroke icon so the
             *  category reads at a glance and the list stays
             *  visually uniform. */}
            <button type="button"
                    className={'cap-stage-rail__item'
                      + (railKind === 'profile'
                        ? ' cap-stage-rail__item--active' : '')}
                    data-test="tr-rail-profile"
                    onClick={() => navTracker.section(
                      programUid, teiId, 'profile',
                      { focusEnrollmentId: selectedEnrolment })}>
              <RailIcon kind="profile" />
              <span className="cap-stage-rail__name">Profile</span>
            </button>
            {stages.length === 0 ? (
              <p className="cap-sub" style={{ margin: '4px 10px 0' }}>
                This program has no stages configured.
              </p>
            ) : stages.map((s) => {
              const count = eventsByStage.get(s.id)?.length ?? 0;
              const active = railKind === 'stage'
                && selectedStage === s.id;
              return (
                <button key={s.id} type="button"
                        className={'cap-stage-rail__item'
                          + (active ? ' cap-stage-rail__item--active' : '')}
                        data-test={'tr-stage-' + s.id}
                        onClick={() => navTracker.stage(
                          programUid, teiId, s.id,
                          { focusEnrollmentId: selectedEnrolment })}>
                  <RailIcon kind="stage" />
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
            <button type="button"
                    className={'cap-stage-rail__item'
                      + (railKind === 'notes'
                        ? ' cap-stage-rail__item--active' : '')}
                    data-test="tr-rail-notes"
                    onClick={() => navTracker.section(
                      programUid, teiId, 'notes',
                      { focusEnrollmentId: selectedEnrolment })}>
              <RailIcon kind="notes" />
              <span className="cap-stage-rail__name">Notes</span>
              <span className="cap-stage-rail__count"
                    title={notesCount === 0 ? 'No notes yet'
                      : `${notesCount} note`
                        + (notesCount === 1 ? '' : 's')}>
                {notesCount}
              </span>
            </button>
            {/* Only render the Relationships rail entry when the
             *  current TET has at least one relationship type
             *  configured OR the record already has existing links.
             *  Otherwise the entry would lead to a dead screen with
             *  no actions — spec requires hiding the section under
             *  that condition. */}
            {(relTypesConfigured || relationshipsCount > 0) && (
              <button type="button"
                      className={'cap-stage-rail__item'
                        + (railKind === 'relationships'
                          ? ' cap-stage-rail__item--active' : '')}
                      data-test="tr-rail-relationships"
                      onClick={() => navTracker.section(
                        programUid, teiId, 'relationships',
                        { focusEnrollmentId: selectedEnrolment })}>
                <RailIcon kind="relationships" />
                <span className="cap-stage-rail__name">
                  Relationships
                </span>
                <span className="cap-stage-rail__count"
                      title={relationshipsCount === 0
                        ? 'No relationships yet'
                        : `${relationshipsCount} link`
                          + (relationshipsCount === 1 ? '' : 's')}>
                  {relationshipsCount}
                </span>
              </button>
            )}
          </nav>

          <div className="cap-stage-pane" data-test="tr-stage-pane">
            {railKind === 'profile' ? (
              <TrackerProfilePane
                api={api}
                teiId={teiId}
                programUid={programUid}
                orgUnitUid={orgUnitUid}
                tetUid={tetUid}
                displayName={identity.displayName}
                lastUpdated={identity.lastUpdated}
                attributes={identity.allAttributes}
                rawAttributes={identity.rawAttributes}
                enrolment={enrolments.find(
                  (e) => e.enrollmentUid === selectedEnrolment) ?? null}
                notesCount={notesCount}
                relationshipsCount={relationshipsCount}
                onEnrolAgain={() => navTracker.enrol(programUid, teiId)}
                onProfileSaved={() => { void refetchIdentity(); }} />
            ) : railKind === 'notes' ? (
              <EnrolmentNotesPane api={api}
                enrollmentUid={selectedEnrolment}
                teiId={teiId}
                programUid={programUid}
                teiDisplayName={identity.displayName}
                teiAttributes={identity.allAttributes}
                enrolment={enrolments.find(
                  (e) => e.enrollmentUid === selectedEnrolment) ?? null}
                onCountChanged={() => setRailCountsTick((t) => t + 1)} />
            ) : railKind === 'relationships' ? (
              <TrackerRelationshipsSection api={api} tei={teiId}
                                             programUid={programUid}
                                             orgUnitUid={orgUnitUid}
                                             tetUid={tetUid}
                                             currentEnrollmentUid={
                                               selectedEnrolment}
                                             onFocusLocalEnrolment={
                                               (enrUid) => {
                                                 setSelectedEnrolment(
                                                   enrUid);
                                                 const first =
                                                   stages[0]?.id;
                                                 if (first) {
                                                   setSelectedStage(
                                                     first);
                                                   setRailKind('stage');
                                                 } else {
                                                   setRailKind('profile');
                                                 }
                                               }} />
            ) : selectedStage === null ? (
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
                          style={{ padding: '5px 13px', fontSize: 13 }}
                          onClick={() => setStageFormMode(null)}
                          title="Back to the event list (Alt+B)">
                    ← Back to events
                  </button>
                  <strong style={{ fontSize: 15, fontWeight: 600,
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
                  <strong style={{ fontSize: 15, fontWeight: 600,
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
                              style={{ padding: '5px 13px', fontSize: 13 }}
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
                            fontSize: 13,
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

      {/* Profile, Notes and Relationships live in the rail now
       *  and render inline inside the stage pane — no standalone
       *  sections or modals at the bottom of the page. */}
    </>
  );
}

/** Profile pane — renders inline inside the stage pane when the
 *  rail "Profile" item is selected (first in the rail, default
 *  landing surface). Modern record-dashboard layout: identity
 *  header with status pill + quick-fact chips, two-column
 *  attributes grid, primary action bar (Edit profile, + Enrol
 *  again, Print profile), audit footer. Edit mode swaps the
 *  attributes grid for the FormEngine without leaving the pane,
 *  so operators never lose their rail position.
 *
 *  Why a dedicated pane instead of the old popover: operators
 *  should land on "who is this?" before scanning the timeline.
 *  A popover made Profile feel like a side-topic; a rail item
 *  elevates it to the primary identity surface (matching how
 *  clinical record systems lay out the patient dashboard). */
function TrackerProfilePane(
  { api, teiId, programUid, orgUnitUid, tetUid, displayName,
    lastUpdated, attributes, rawAttributes, enrolment,
    notesCount, relationshipsCount, onEnrolAgain, onProfileSaved }: {
    api: CaptureApi;
    teiId: string;
    programUid: string;
    orgUnitUid: string;
    tetUid: string | null;
    displayName: string | null;
    lastUpdated: string | null;
    attributes: ReadonlyArray<{ label: string; value: string }>;
    rawAttributes: Readonly<Record<string, string>>;
    enrolment: TrackerEnrolment | null;
    notesCount: number;
    relationshipsCount: number;
    onEnrolAgain: () => void;
    onProfileSaved: () => void;
  },
): JSX.Element {
  const [mode, setMode] = useState<'view' | 'edit'>('view');
  const [sections, setSections] =
    useState<ReadonlyArray<ReturnType<
      typeof parseTeiAttributesForm>['sections'][number]>>([]);
  /** Full TEA definitions for this TET — fetched once and used to
   *  render every attribute slot in view mode (so operators see
   *  the complete clinical record shape, with "—" placeholders for
   *  unsaved values, instead of a hole where the attribute should
   *  be). Separate from `sections` (which is only materialised in
   *  edit mode because it's the FormEngine-ready, parsed version). */
  const [teaDefs, setTeaDefs] = useState<ReadonlyArray<{
    attributeUid: string; displayName?: string; valueType?: string;
    optionSetUid?: string | null; mandatory?: boolean;
    uniqueAttribute?: boolean; sortOrder?: number;
  }>>([]);
  const [values, setValues] = useState<Record<string, string>>(
    { ...rawAttributes });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // Reset local edit buffer whenever the underlying raw attributes
  // change (e.g. after a successful save from this pane, or a TEI
  // switch). Prevents stale values lingering across identity swaps.
  useEffect(() => { setValues({ ...rawAttributes }); },
    [rawAttributes, teiId]);

  // Fetch the full TEA definition list once per TET, for view-mode
  // rendering of every attribute slot (filled or empty).
  useEffect(() => {
    if (!tetUid) { setTeaDefs([]); return; }
    let cancelled = false;
    (async () => {
      try {
        const teaRes = await api.listCaptureTeiTypeAttributes(tetUid);
        if (cancelled) return;
        setTeaDefs(teaRes.attributes);
      } catch { if (!cancelled) setTeaDefs([]); }
    })();
    return () => { cancelled = true; };
  }, [tetUid, api]);

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

  /** Full view-mode attribute list — every TEA for the TET ordered
   *  by sortOrder, joined against rawAttributes. Cells with no saved
   *  value render a muted "—" placeholder so the clinical record
   *  shape is always visible. Falls back to the parent-provided
   *  `attributes` (saved-only) when the TET fetch hasn't returned
   *  yet, so the pane never flashes empty. */
  const viewList = useMemo(() => {
    if (teaDefs.length === 0) {
      return attributes.map((a) => ({
        label: a.label, value: a.value, isEmpty: false,
        mandatory: false, unique: false,
      }));
    }
    return [...teaDefs]
      .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
      .map((def) => {
        const v = rawAttributes[def.attributeUid];
        const val = (v ?? '').toString();
        return {
          label: def.displayName ?? def.attributeUid,
          value: val,
          isEmpty: val.trim() === '',
          mandatory: def.mandatory ?? false,
          unique: def.uniqueAttribute ?? false,
        };
      });
  }, [teaDefs, rawAttributes, attributes]);

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
      setMode('view');
      setSaving(false);
      onProfileSaved();
    } catch (e) {
      setErr((e as Error).message ?? 'Save failed');
      setSaving(false);
    }
  }

  /** Export a one-page identity summary directly as a PDF file —
   *  renders the same HTML template off-screen and streams it
   *  through jsPDF, no popup window or print dialog needed. */
  async function exportProfilePdf(): Promise<void> {
    const html = renderProfilePdfHtml({
      teiId, programUid, displayName, attributes,
      enrolment, generatedAt: new Date().toLocaleString(undefined, {
        year: 'numeric', month: 'long', day: 'numeric',
        hour: '2-digit', minute: '2-digit',
      }),
    });
    try {
      await exportHtmlAsPdf({
        html,
        fileName: 'profile-' + (displayName || teiId)
          .replace(/[^A-Za-z0-9._-]+/g, '_').slice(0, 60),
      });
    } catch (err) {
      // eslint-disable-next-line no-alert
      alert('PDF export failed: ' + ((err as Error).message
        ?? 'unknown error'));
    }
  }

  return (
    <div data-test="tr-profile-pane" className="cap-profile-pane">
      <header className="cap-profile-pane__head">
        <div className="cap-profile-pane__ident">
          <h2 className="cap-profile-pane__name">
            {displayName || 'Tracked entity'}
          </h2>
          <div className="cap-profile-pane__chips">
            {enrolment?.status && (
              <span className={'cap-chip cap-chip--'
                + (enrolment.status === 'ACTIVE' ? 'ok'
                  : enrolment.status === 'COMPLETED' ? 'muted' : 'warn')}
                    data-test="tr-profile-status">
                {formatStatusLabel(enrolment.status)}
              </span>
            )}
            {enrolment?.enrollmentDate && (
              <span className="cap-chip cap-chip--neutral"
                    title="Enrolment start date">
                Enrolled {formatDateOnly(enrolment.enrollmentDate)}
              </span>
            )}
            <span className="cap-chip cap-chip--neutral"
                  title="Number of notes on this enrolment">
              {notesCount} note{notesCount === 1 ? '' : 's'}
            </span>
            <span className="cap-chip cap-chip--neutral"
                  title="Number of linked relationships">
              {relationshipsCount} relationship
              {relationshipsCount === 1 ? '' : 's'}
            </span>
          </div>
        </div>
        <div className="cap-profile-pane__actions">
          {mode === 'view' && (
            <>
              {tetUid && (
                <button type="button"
                        className="cap-btn cap-btn--primary"
                        data-test="tr-profile-edit"
                        style={{ padding: '6px 14px', fontSize: 13 }}
                        onClick={() => setMode('edit')}>
                  Edit profile
                </button>
              )}
              <button type="button"
                      className="cap-btn cap-btn--secondary"
                      data-test="tr-profile-print"
                      style={{ padding: '6px 14px', fontSize: 13 }}
                      title="Download a one-page PDF of this profile"
                      onClick={() => { void exportProfilePdf(); }}>
                Export PDF
              </button>
            </>
          )}
        </div>
      </header>

      {mode === 'view' ? (
        viewList.length === 0 ? (
          <div className="cap-placeholder" data-test="tr-profile-empty"
               style={{ margin: 0, fontSize: 14 }}>
            This tracked entity type has no attributes configured.
          </div>
        ) : (
          <div className="cap-profile-pane__grid"
               data-test="tr-profile-grid">
            {viewList.map((a, i) => (
              <div key={`${a.label}:${i}`}
                   className={'cap-profile-pane__cell'
                + (a.isEmpty ? ' cap-profile-pane__cell--empty' : '')}>
                <div className="cap-profile-pane__cell-label">
                  {a.label}
                  {a.mandatory && (
                    <span className="cap-profile-pane__cell-req"
                          title="Mandatory attribute">*</span>
                  )}
                  {a.unique && (
                    <span className="cap-profile-pane__cell-flag"
                          title="Unique attribute (used for deduplication)">
                      unique
                    </span>
                  )}
                </div>
                <div className="cap-profile-pane__cell-value">
                  {a.isEmpty ? (
                    <span className="cap-profile-pane__cell-dash"
                          aria-label="No value captured yet">—</span>
                  ) : a.value}
                </div>
              </div>
            ))}
          </div>
        )
      ) : (
        <div className="cap-profile-pane__edit">
          {err && (
            <div className="cap-strip cap-strip--err"
                 data-test="tr-profile-err"
                 style={{ marginBottom: 12 }}>
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
          <div className="cap-profile-pane__edit-foot">
            <button type="button"
                    className="cap-btn cap-btn--secondary"
                    data-test="tr-profile-cancel"
                    style={{ padding: '6px 14px', fontSize: 13 }}
                    onClick={() => {
                      setMode('view');
                      setErr(null);
                      // Revert any uncommitted edits to raw values
                      setValues({ ...rawAttributes });
                    }}
                    disabled={saving}>
              Cancel
            </button>
            <button type="button"
                    className="cap-btn cap-btn--primary"
                    data-test="tr-profile-save"
                    style={{ padding: '6px 14px', fontSize: 13 }}
                    onClick={() => { void save(); }}
                    disabled={saving || sections.length === 0}>
              {saving ? 'Saving…' : 'Save changes'}
            </button>
          </div>
        </div>
      )}

      <footer className="cap-profile-pane__foot">
        <div className="cap-profile-pane__meta">
          <span className="cap-profile-pane__meta-label">TEI UID</span>
          <code className="cap-profile-pane__meta-value">{teiId}</code>
        </div>
        {enrolment && (
          <div className="cap-profile-pane__meta">
            <span className="cap-profile-pane__meta-label">
              Enrolment UID
            </span>
            <code className="cap-profile-pane__meta-value">
              {enrolment.enrollmentUid}
            </code>
          </div>
        )}
        {lastUpdated && (
          <div className="cap-profile-pane__meta">
            <span className="cap-profile-pane__meta-label">Last updated</span>
            <span className="cap-profile-pane__meta-value">
              {formatTimestamp(lastUpdated)}
            </span>
          </div>
        )}
      </footer>
    </div>
  );
}

/** Minimal printable identity-summary template — same shape as
 *  the notes PDF so filed paper copies feel consistent. */
function renderProfilePdfHtml(
  args: {
    teiId: string;
    programUid: string;
    displayName: string | null;
    attributes: ReadonlyArray<{ label: string; value: string }>;
    enrolment: TrackerEnrolment | null;
    generatedAt: string;
  },
): string {
  const { teiId, programUid, displayName, attributes,
    enrolment, generatedAt } = args;
  const subjectName = displayName || 'Tracked entity';
  // Identity block — program / TEI UID / enrolment context, so
  // the printed artefact is self-traceable back to source records.
  const identity = derPdfIdentity([
    { label: 'Tracked entity UID', value: teiId, code: true },
    { label: 'Program UID', value: programUid, code: true },
    ...(enrolment ? [
      { label: 'Enrolment UID', value: enrolment.enrollmentUid,
        code: true },
      { label: 'Enrolled on',
        value: formatDateOnly(enrolment.enrollmentDate) },
      ...(enrolment.incidentDate ? [{
        label: 'Incident date',
        value: formatDateOnly(enrolment.incidentDate),
      }] : []),
      { label: 'Enrolment status',
        value: formatStatusLabel(enrolment.status) },
    ] : []),
  ]);
  const attrRows = attributes.length === 0
    ? '<p style="color:#5b6478; font-size:10pt; margin:8px 0;">'
      + 'No attribute values captured for this tracked entity.</p>'
    : '<div class="der-pdf-attr-grid">'
      + attributes.map((a) => `
      <div class="der-pdf-attr-grid__label">${esc(a.label)}</div>
      <div class="der-pdf-attr-grid__value">${esc(a.value)}</div>`).join('')
      + '</div>';
  const body = `
    ${identity}
    ${derPdfSectionTitle('Attribute values')}
    ${attrRows}
    <style>
      .der-pdf-attr-grid {
        display: grid;
        grid-template-columns: 220px 1fr;
        gap: 0;
        border: 1px solid #DCE2EB;
        border-radius: 3px;
      }
      .der-pdf-attr-grid__label,
      .der-pdf-attr-grid__value {
        padding: 8px 12px;
        border-bottom: 1px solid #ECEFF5;
      }
      .der-pdf-attr-grid > div:nth-last-child(-n+2) {
        border-bottom: 0;
      }
      .der-pdf-attr-grid__label {
        background: #FAFBFD;
        font-size: 9.5pt;
        color: #5b6478; font-weight: 600;
        border-right: 1px solid #ECEFF5;
      }
      .der-pdf-attr-grid__value {
        font-size: 10.5pt;
        color: #101a32;
      }
    </style>
  `;
  return derPdfDocument({
    docTitle: 'Profile — ' + subjectName,
    header: {
      eyebrow: 'Patient identity summary',
      title: subjectName,
      subtitle: attributes.length + ' attribute'
        + (attributes.length === 1 ? '' : 's') + ' captured'
        + (enrolment ? ' · enrolment ' + enrolment.enrollmentUid : ''),
    },
    body,
    footer: {
      left: subjectName,
      right: 'Generated ' + generatedAt,
    },
    generatedAt,
  });
}

function esc(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;',
    '"': '&quot;', "'": '&#39;',
  }[c] as string));
}

/** Enrolment notes pane — renders inline inside the stage pane
 *  when the rail "Notes" item is selected. Lighter chrome than
 *  the pre-refactor standalone section: no section-head because
 *  the rail already labels it; the pane header just has a title
 *  + count + the + Add note action, matching the stage events
 *  pane pattern. */
function EnrolmentNotesPane(
  { api, enrollmentUid, teiId, programUid,
    teiDisplayName, teiAttributes, enrolment, onCountChanged }: {
    api: CaptureApi;
    enrollmentUid: string | null;
    /** TEI context — used for the PDF header + filename. The notes
     *  list itself keys off enrollmentUid; the rest of these are
     *  purely identity metadata so the printed artefact is self-
     *  contained and traceable back to a specific person/enrolment. */
    teiId: string;
    programUid: string;
    teiDisplayName: string | null;
    teiAttributes: ReadonlyArray<{ label: string; value: string }>;
    enrolment: TrackerEnrolment | null;
    onCountChanged: () => void;
  },
): JSX.Element {
  const [notes, setNotes] = useState<ReadonlyArray<{
    noteUid: string; noteText: string; createdAt: string;
  }>>([]);
  const [draft, setDraft] = useState('');
  const [saving, setSaving] = useState(false);
  const [composing, setComposing] = useState(false);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!enrollmentUid) { setNotes([]); return; }
    let cancelled = false;
    (async () => {
      try {
        const rows = await api.listEnrolmentNotes(enrollmentUid);
        if (!cancelled) setNotes(rows);
      } catch { if (!cancelled) setNotes([]); }
    })();
    return () => { cancelled = true; };
  }, [enrollmentUid, tick, api]);

  if (!enrollmentUid) {
    return (
      <div className="cap-placeholder" data-test="tr-notes-no-enrol"
           style={{ margin: 0 }}>
        Select an enrolment to view notes.
      </div>
    );
  }

  async function submit(): Promise<void> {
    const text = draft.trim();
    if (text === '' || saving || !enrollmentUid) return;
    setSaving(true);
    try {
      const created = await api.addEnrolmentNote(enrollmentUid, text);
      if (created) {
        setDraft('');
        setComposing(false);
        setTick((t) => t + 1);
        onCountChanged();
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <div data-test="tr-notes-pane" className="cap-notes-pane">
      <div className="cap-notes-pane__head">
        <strong className="cap-notes-pane__title">
          {notes.length} note{notes.length === 1 ? '' : 's'}
        </strong>
        <span style={{ flex: 1 }} />
        {!composing && notes.length > 0 && (
          <button type="button"
                  className="cap-btn cap-btn--secondary"
                  data-test="tr-notes-print"
                  style={{ padding: '6px 14px', fontSize: 13 }}
                  title={'Download a PDF of every note on this '
                    + 'enrolment'}
                  onClick={() => { void exportNotesPdf({
                    notes, teiId, programUid,
                    teiDisplayName, teiAttributes, enrolment,
                  }); }}>
            Export PDF
          </button>
        )}
        {!composing && (
          <button type="button"
                  className="cap-btn cap-btn--primary"
                  data-test="tr-notes-compose"
                  style={{ padding: '6px 14px', fontSize: 13 }}
                  onClick={() => setComposing(true)}>
            + Add note
          </button>
        )}
      </div>
      {composing && (
        <div className="cap-notes-pane__compose">
          <textarea className="cap-input__ctl"
                     data-test="tr-notes-draft"
                     rows={3}
                     value={draft}
                     onChange={(e) => setDraft(e.target.value)}
                     placeholder="Write a note about this enrolment…"
                     autoFocus
                     style={{ fontFamily: 'inherit',
                       resize: 'vertical', fontSize: 14 }} />
          <div style={{ display: 'flex',
            justifyContent: 'flex-end', gap: 10 }}>
            <button type="button"
                    className="cap-btn cap-btn--secondary"
                    data-test="tr-notes-cancel"
                    style={{ padding: '6px 14px', fontSize: 13 }}
                    disabled={saving}
                    onClick={() => {
                      setDraft(''); setComposing(false);
                    }}>
              Cancel
            </button>
            <button type="button"
                    className="cap-btn cap-btn--primary"
                    data-test="tr-notes-add"
                    style={{ padding: '6px 14px', fontSize: 13 }}
                    disabled={draft.trim() === '' || saving}
                    onClick={() => { void submit(); }}>
              {saving ? 'Saving…' : 'Save note'}
            </button>
          </div>
        </div>
      )}
      {notes.length === 0 ? (
        <div className="cap-placeholder" data-test="tr-notes-empty"
             style={{ margin: 0, fontSize: 14 }}>
          No notes on this enrolment yet. Use
          <strong style={{ padding: '0 4px' }}>+ Add note</strong>
          above to add the first one.
        </div>
      ) : (
        <ul className="cap-notes-pane__list" data-test="tr-notes-list">
          {notes.map((n) => (
            <li key={n.noteUid} className="cap-notes-pane__item">
              <div className="cap-notes-pane__text">{n.noteText}</div>
              <div className="cap-notes-pane__when">
                {formatTimestamp(n.createdAt)}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** Rail-item prefix icon. 16px stroke icons at 1.75 weight —
 *  consistent with @dhis2/ui iconography and legible against
 *  both inactive (muted) and active (primary) rail backgrounds
 *  via currentColor. One sprite per logical category: profile,
 *  stage, notes, relationships. */
function RailIcon(
  { kind }: { kind: 'profile' | 'stage' | 'notes' | 'relationships' },
): JSX.Element {
  const common = {
    width: 16, height: 16, viewBox: '0 0 24 24',
    fill: 'none', stroke: 'currentColor',
    strokeWidth: 1.75, strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    className: 'cap-stage-rail__icon', 'aria-hidden': true,
  };
  if (kind === 'profile') {
    return (
      <svg {...common}>
        <circle cx="12" cy="8" r="4" />
        <path d="M4 21c0-4.4 3.6-8 8-8s8 3.6 8 8" />
      </svg>
    );
  }
  if (kind === 'notes') {
    return (
      <svg {...common}>
        <path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0
          2 2h12a2 2 0 0 0 2-2V9z" />
        <path d="M14 3v6h6" />
        <path d="M8 13h8M8 17h5" />
      </svg>
    );
  }
  if (kind === 'relationships') {
    return (
      <svg {...common}>
        <path d="M10.5 13.5a4 4 0 0 0 5.66 0l3-3a4 4 0 1
          0-5.66-5.66l-1 1" />
        <path d="M13.5 10.5a4 4 0 0 0-5.66 0l-3 3a4 4 0 1
          0 5.66 5.66l1-1" />
      </svg>
    );
  }
  // stage
  return (
    <svg {...common}>
      <rect x="4" y="5" width="16" height="15" rx="2" />
      <path d="M8 3v4M16 3v4M4 10h16" />
    </svg>
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

/** Open a printable PDF rendition of every note on the current
 *  enrolment in a new browser window and trigger the print dialog.
 *  The window hosts a standalone HTML document with embedded print
 *  CSS (A4, 20mm margins, serif body, clinic-friendly typography)
 *  so the operator can use the browser's "Save as PDF" or print to
 *  a physical printer. The document is self-contained — a copy can
 *  be filed, emailed or attached to a paper record and still carry
 *  enough identity metadata to be traced back to this TEI+enrolment.
 *
 *  Renders the printable HTML template off-screen and streams it
 *  through jsPDF so the operator gets a direct download — no popup
 *  window, so browser popup blockers don't block it. */
async function exportNotesPdf(
  args: {
    notes: ReadonlyArray<{
      noteUid: string; noteText: string; createdAt: string;
    }>;
    teiId: string;
    programUid: string;
    teiDisplayName: string | null;
    teiAttributes: ReadonlyArray<{ label: string; value: string }>;
    enrolment: TrackerEnrolment | null;
  },
): Promise<void> {
  const { notes, teiId, programUid, teiDisplayName,
    teiAttributes, enrolment } = args;
  // Oldest-first for chronological reading in the exported document
  // (the on-screen list is newest-first for scanning, which reads
  // backwards on paper).
  const ordered = [...notes].sort((a, b) =>
    (a.createdAt || '').localeCompare(b.createdAt || ''));
  const generatedAt = new Date().toLocaleString(undefined, {
    year: 'numeric', month: 'long', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
  const html = renderNotesPdfHtml({
    teiId, programUid, teiDisplayName,
    teiAttributes, enrolment, notes: ordered, generatedAt,
  });
  try {
    await exportHtmlAsPdf({
      html,
      fileName: 'notes-' + (teiDisplayName || teiId)
        .replace(/[^A-Za-z0-9._-]+/g, '_').slice(0, 60),
    });
  } catch (err) {
    // eslint-disable-next-line no-alert
    alert('PDF export failed: ' + ((err as Error).message
      ?? 'unknown error'));
  }
}

function renderNotesPdfHtml(
  args: {
    teiId: string;
    programUid: string;
    teiDisplayName: string | null;
    teiAttributes: ReadonlyArray<{ label: string; value: string }>;
    enrolment: TrackerEnrolment | null;
    notes: ReadonlyArray<{
      noteUid: string; noteText: string; createdAt: string;
    }>;
    generatedAt: string;
  },
): string {
  const { teiId, programUid, teiDisplayName,
    teiAttributes, enrolment, notes, generatedAt } = args;
  const subjectName = teiDisplayName || 'Tracked entity';
  const identity = derPdfIdentity([
    ...teiAttributes.slice(0, 6).map((a) => ({
      label: a.label, value: a.value,
    })),
    { label: 'Tracked entity UID', value: teiId, code: true },
    { label: 'Program UID', value: programUid, code: true },
    ...(enrolment ? [
      { label: 'Enrolment UID', value: enrolment.enrollmentUid,
        code: true },
      { label: 'Enrolled on',
        value: formatDateOnly(enrolment.enrollmentDate) },
      { label: 'Enrolment status',
        value: formatStatusLabel(enrolment.status) },
    ] : []),
  ]);
  const statusPill = enrolment
    ? derPdfPill(enrolment.status) : '';
  const notesHtml = notes.length === 0
    ? '<p style="color:#5b6478; font-size:10pt;">'
      + 'No notes on this enrolment yet.</p>'
    : '<ol class="der-note-list">'
      + notes.map((n, i) => `
      <li class="der-note">
        <div class="der-note__chip">${i + 1}</div>
        <div class="der-note__body">
          <div class="der-note__when">
            ${esc(formatTimestamp(n.createdAt))}
          </div>
          <div class="der-note__text">${esc(n.noteText)
            .replace(/\n/g, '<br />')}</div>
          <div class="der-note__uid">
            Note UID <code>${esc(n.noteUid)}</code>
          </div>
        </div>
      </li>`).join('') + '</ol>';
  const body = `
    ${identity}
    ${statusPill ? `<p style="margin: -8px 0 16px;">
      Enrolment is ${statusPill}
      </p>` : ''}
    ${derPdfSectionTitle('Enrolment notes (chronological)')}
    ${notesHtml}
    <style>
      .der-note-list {
        list-style: none; padding: 0; margin: 0;
      }
      .der-note {
        display: flex; align-items: flex-start; gap: 12px;
        padding: 12px 14px;
        margin-bottom: 8px;
        background: #FAFBFD;
        border: 1px solid #DCE2EB;
        border-left: 3px solid #147CD7;
        border-radius: 3px;
        break-inside: avoid; page-break-inside: avoid;
      }
      .der-note__chip {
        flex: 0 0 26px;
        text-align: center;
        font-size: 10pt; font-weight: 700;
        color: #0f68b7;
        background: #e6f1fb;
        border-radius: 999px;
        padding: 2px 0;
        line-height: 1.2;
      }
      .der-note__body { flex: 1 1 auto; min-width: 0; }
      .der-note__when {
        font-size: 9pt; font-weight: 600;
        letter-spacing: 0.04em; text-transform: uppercase;
        color: #5b6478;
        margin-bottom: 4px;
      }
      .der-note__text {
        font-size: 11pt; color: #101a32;
        white-space: pre-wrap; word-wrap: break-word;
      }
      .der-note__uid {
        margin-top: 6px;
        font-size: 8.5pt; color: #94A0B4;
      }
      .der-note__uid code {
        font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
        background: #ECEFF5;
        padding: 1px 5px; border-radius: 2px;
        color: #5b6478;
      }
    </style>
  `;
  return derPdfDocument({
    docTitle: 'Enrolment notes — ' + subjectName,
    header: {
      eyebrow: 'Enrolment notes',
      title: subjectName,
      subtitle: notes.length + ' note'
        + (notes.length === 1 ? '' : 's')
        + (enrolment
          ? ' · enrolment ' + enrolment.enrollmentUid : ''),
    },
    body,
    footer: {
      left: subjectName,
      right: 'Generated ' + generatedAt,
    },
    generatedAt,
  });
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
