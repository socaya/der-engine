import { useEffect, useMemo, useState } from 'react';
import { FormEngine, requiredFieldsComplete }
  from '../../shared/FormEngine';
import { parseTeiAttributesForm } from '../../shared/parser';
import type { CaptureFormSection } from '../../shared/model';
import type { CaptureApi } from '../../shared/types';
import { navTracker } from '../../shared/routing';

/** Relationship creation wizard (spec §8.4, REL-C-003/005/016).
 *  Four dedicated steps replace the earlier inline compose panel:
 *
 *    Step 1 — Pick type (directional label, auto-advances when
 *             only one is eligible)
 *    Step 2 — Pick target (TEI → enrolment → event chain;
 *             inline "+ Create new" for empty cases)
 *    Step 3 — Review (summary of what will be saved)
 *    Step 4 — Outcome (saved / error, Back-to-record action)
 *
 *  Each step reads its position from the route's ?step=N query
 *  param so a browser back/forward navigates between steps without
 *  losing state (state is kept in this component; URL only drives
 *  which panel is visible). On save/cancel the wizard navigates
 *  back to the TEI detail page. Spec-compliant alternative to the
 *  inline compose; no new relationship-TYPE metadata is created —
 *  only an INSTANCE from an already-configured type (per operator
 *  clarification). */

type EdgeKind = 'TRACKED_ENTITY' | 'ENROLLMENT' | 'EVENT';

function mirrorToEdgeKind(k: string | undefined): EdgeKind | null {
  if (k === 'TRACKED_ENTITY_INSTANCE') return 'TRACKED_ENTITY';
  if (k === 'PROGRAM_INSTANCE')         return 'ENROLLMENT';
  if (k === 'PROGRAM_STAGE_INSTANCE')   return 'EVENT';
  return null;
}

function directionalLabel(t: RelTypeRow, flipped: boolean): string {
  const name = flipped
    ? (t.toFromName ?? t.fromToName)
    : (t.fromToName ?? t.toFromName);
  return name ?? t.displayName;
}

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
  readonly fromProgram?: string;
  readonly toProgram?: string;
  readonly fromStage?: string;
  readonly toStage?: string;
}

function todayIsoDate(): string {
  const d = new Date();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mm}-${dd}`;
}

function genDhis2Uid(): string {
  const alpha = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
  const alphanum = alpha + '0123456789';
  let out = alpha[Math.floor(Math.random() * alpha.length)];
  for (let i = 0; i < 10; i++) {
    out += alphanum[Math.floor(Math.random() * alphanum.length)];
  }
  return out;
}

export function TrackerRelationshipWizardPage(
  { api, programUid, orgUnitUid, teiId,
    preFromKind, preFromUid, preTypeUid }: {
    api: CaptureApi;
    programUid: string;
    orgUnitUid: string;
    teiId: string;
    /** Pre-anchor overrides from the launching context. When
     *  preFromKind=EVENT + preFromUid=<eventUid>, the form
     *  constrains eligible types to those anchorable on that
     *  event. Typical launcher: the event detail page's "Request
     *  lab tests" / "Create prescription" / "Initiate referral"
     *  action rows. */
    preFromKind: 'TRACKED_ENTITY' | 'ENROLLMENT' | 'EVENT' | null;
    preFromUid: string | null;
    preTypeUid: string | null;
  },
): JSX.Element {
  const [tetUid, setTetUid] = useState<string | null>(null);
  const [types, setTypes] = useState<RelTypeRow[]>([]);
  const [selfEnrollments, setSelfEnrollments] =
    useState<Array<{ enrollmentUid: string; programUid: string;
      enrollmentDate: string | null; status: string | null }>>([]);
  const [selfEvents, setSelfEvents] =
    useState<Array<{ eventUid: string; enrollmentUid: string;
      programStageUid: string; occurredDate: string | null;
      status: string | null }>>([]);

  const [pickedTypeId, setPickedTypeId] = useState('');
  const [flipped, setFlipped] = useState(false);
  const [pickedTargetTei, setPickedTargetTei] = useState('');
  const [pickedTargetEnrollment, setPickedTargetEnrollment] = useState('');
  const [pickedTargetEvent, setPickedTargetEvent] = useState('');
  const [anchorEnrollment, setAnchorEnrollment] = useState('');
  const [anchorEvent, setAnchorEvent] = useState('');

  const [candidates, setCandidates] = useState<Array<{
    uid: string; displayName: string; lastUpdated: string }>>([]);
  const [targetEnrollments, setTargetEnrollments] =
    useState<Array<{ enrollmentUid: string; programUid: string;
      enrollmentDate: string | null; status: string | null }>>([]);
  const [targetEvents, setTargetEvents] =
    useState<Array<{ eventUid: string; enrollmentUid: string;
      programStageUid: string; occurredDate: string | null;
      status: string | null }>>([]);

  // Inline create-new-target state (TEI + event). Same pattern as
  // the pre-wizard section; preserved so no scenario loses its
  // workaround when adopting the wizard.
  const [creatingTarget, setCreatingTarget] = useState(false);
  const [newTargetSections, setNewTargetSections] =
    useState<readonly CaptureFormSection[]>([]);
  const [newTargetValues, setNewTargetValues] =
    useState<Record<string, string>>({});
  const [createState, setCreateState] =
    useState<'idle' | 'loading-form' | 'submitting' | 'err'>('idle');
  const [createMsg, setCreateMsg] = useState<string | null>(null);

  const [creatingEvent, setCreatingEvent] = useState(false);
  const [newEventDate, setNewEventDate] =
    useState<string>(todayIsoDate());
  const [eventCreateState, setEventCreateState] =
    useState<'idle' | 'loading-form' | 'submitting' | 'err'>('idle');
  const [eventCreateMsg, setEventCreateMsg] = useState<string | null>(null);
  /** Event form sections + values when operator opens the inline
   *  "+ Create new event" panel. Lets operators capture the full
   *  DHIS2 stage data-element set up-front instead of creating an
   *  empty placeholder event they'd have to edit later. */
  const [newEventSections, setNewEventSections] =
    useState<readonly CaptureFormSection[]>([]);
  const [newEventValues, setNewEventValues] =
    useState<Record<string, string>>({});

  const [submit, setSubmit] =
    useState<'idle' | 'submitting' | 'ok' | 'err'>('idle');
  const [submitMsg, setSubmitMsg] = useState<string | null>(null);

  // --- Fetch: TET + self enrolments + self events + types -------
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [tetRes, enr, tt] = await Promise.all([
          api.getCaptureProgramTeiType(programUid).catch(() => null),
          api.listCaptureTeiEnrollments(teiId).catch(() => ({ enrollments: [] })),
          api.listRelationshipTypes().catch(() => []),
        ]);
        if (cancelled) return;
        setTetUid(tetRes?.trackedEntityTypeUid ?? null);
        const es = enr.enrollments ?? [];
        setSelfEnrollments(es.map((x) => ({
          enrollmentUid: x.enrollmentUid,
          programUid: x.programUid,
          enrollmentDate: x.enrollmentDate ?? null,
          status: x.status ?? null,
        })));
        const allEvents: typeof selfEvents = [];
        for (const er of es) {
          try {
            const evs = await api.listCaptureEnrollmentEvents(
              er.enrollmentUid);
            for (const ev of (evs.events ?? [])) {
              allEvents.push({
                eventUid: ev.eventUid,
                enrollmentUid: ev.enrollmentUid,
                programStageUid: ev.programStageUid,
                occurredDate: ev.occurredDate ?? null,
                status: ev.status ?? null,
              });
            }
          } catch { /* best-effort */ }
        }
        if (!cancelled) setSelfEvents(allEvents);
        setTypes((tt ?? []).map((t) => ({
          id: t.id,
          displayName: t.displayName ?? t.name ?? t.id,
          bidirectional: t.bidirectional ?? false,
          fromToName: t.fromToName,
          toFromName: t.toFromName,
          fromEntity: t.fromConstraint?.relationshipEntity,
          toEntity:   t.toConstraint?.relationshipEntity,
          fromTet:    t.fromConstraint?.trackedEntityType?.id,
          toTet:      t.toConstraint?.trackedEntityType?.id,
          fromProgram: t.fromConstraint?.program?.id ?? undefined,
          toProgram:   t.toConstraint?.program?.id ?? undefined,
          fromStage:   t.fromConstraint?.programStage?.id ?? undefined,
          toStage:     t.toConstraint?.programStage?.id ?? undefined,
        })));
      } catch { /* leave empty */ }
    })();
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teiId, programUid]);

  function canAnchor(
    kind: EdgeKind | null, tetConstraint: string | undefined,
    programConstraint: string | undefined,
    stageConstraint: string | undefined,
  ): boolean {
    if (!kind) return false;
    // When the wizard was launched with a pre-anchored from side
    // (e.g. from an event detail page), eligibility for the anchor
    // kind is already resolved — only types matching that kind
    // qualify. Short-circuit here so the eligibility filter below
    // doesn't accidentally reject a valid type because the
    // selfEvents/selfEnrollments bulk-load hasn't matched the
    // specific pre-anchored row.
    if (preFromKind && preFromUid) {
      return kind === preFromKind;
    }
    if (kind === 'TRACKED_ENTITY') {
      if (!tetUid) return false;
      if (tetConstraint && tetConstraint !== tetUid) return false;
      return true;
    }
    if (kind === 'ENROLLMENT') {
      return selfEnrollments.some((e) =>
        !programConstraint || e.programUid === programConstraint);
    }
    return selfEvents.some((e) =>
      !stageConstraint || e.programStageUid === stageConstraint);
  }

  const eligibleTypes = useMemo(() => types.filter((t) => {
    const fromKind = mirrorToEdgeKind(t.fromEntity);
    const toKind   = mirrorToEdgeKind(t.toEntity);
    const fromOk = canAnchor(fromKind, t.fromTet,
      t.fromProgram, t.fromStage);
    const toOk = t.bidirectional
      && canAnchor(toKind, t.toTet, t.toProgram, t.toStage);
    return fromOk || toOk;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [types, tetUid, selfEnrollments, selfEvents]);

  const pickedType = eligibleTypes.find((t) => t.id === pickedTypeId);

  // Preselect the type when the wizard was launched with
  // ?preType=<uid> from a contextual action row. The eligibility
  // filter still runs — if the pre-type isn't eligible for the
  // current context we don't force-select (silent fallback to the
  // normal manual pick).
  useEffect(() => {
    if (pickedTypeId || !preTypeUid) return;
    const match = eligibleTypes.find((t) => t.id === preTypeUid);
    if (!match) return;
    const fromKind = mirrorToEdgeKind(match.fromEntity);
    const fromCan = canAnchor(fromKind, match.fromTet,
      match.fromProgram, match.fromStage);
    setPickedTypeId(match.id);
    setFlipped(!fromCan && match.bidirectional);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eligibleTypes, preTypeUid]);

  const ourKind: EdgeKind | null = pickedType
    ? (flipped ? mirrorToEdgeKind(pickedType.toEntity)
                : mirrorToEdgeKind(pickedType.fromEntity))
    : null;
  const theirKind: EdgeKind | null = pickedType
    ? (flipped ? mirrorToEdgeKind(pickedType.fromEntity)
                : mirrorToEdgeKind(pickedType.toEntity))
    : null;
  const theirTetConstraint = pickedType
    ? (flipped ? pickedType.fromTet : pickedType.toTet) : undefined;
  const theirProgramConstraint = pickedType
    ? (flipped ? pickedType.fromProgram : pickedType.toProgram) : undefined;
  const theirStageConstraint = pickedType
    ? (flipped ? pickedType.fromStage : pickedType.toStage) : undefined;
  const ourProgramConstraint = pickedType
    ? (flipped ? pickedType.toProgram : pickedType.fromProgram) : undefined;
  const ourStageConstraint = pickedType
    ? (flipped ? pickedType.toStage : pickedType.fromStage) : undefined;

  const ourEnrollmentCandidates = ourKind === 'ENROLLMENT'
    ? selfEnrollments.filter((e) => !ourProgramConstraint
      || e.programUid === ourProgramConstraint) : [];
  const ourEventCandidates = ourKind === 'EVENT'
    ? selfEvents.filter((e) => !ourStageConstraint
      || e.programStageUid === ourStageConstraint) : [];

  useEffect(() => {
    if (!pickedType) return;
    if (ourKind === 'ENROLLMENT') {
      setAnchorEnrollment(ourEnrollmentCandidates[0]?.enrollmentUid ?? '');
    } else {
      setAnchorEnrollment('');
    }
    if (ourKind === 'EVENT') {
      setAnchorEvent(ourEventCandidates[0]?.eventUid ?? '');
    } else {
      setAnchorEvent('');
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pickedTypeId, flipped]);

  // Candidate TEIs — re-fetch on type change (per-type scope).
  useEffect(() => {
    let cancelled = false;
    const prog = theirProgramConstraint ?? programUid;
    (async () => {
      try {
        const r = await api.listTrackerEntities(prog, orgUnitUid, 200);
        if (cancelled) return;
        const list = r.trackedEntities ?? r.instances ?? [];
        setCandidates(list.map((row) => ({
          uid: row.trackedEntity ?? row.trackedEntityInstance ?? '',
          displayName: row.displayName ?? '',
          lastUpdated: row.lastUpdated ?? '',
        })).filter((c) => c.uid !== '' && c.uid !== teiId));
      } catch { if (!cancelled) setCandidates([]); }
    })();
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [theirProgramConstraint, programUid, orgUnitUid, teiId]);

  // Chained fetches when target TEI picked.
  useEffect(() => {
    let cancelled = false;
    if (!pickedTargetTei || theirKind === 'TRACKED_ENTITY') {
      setTargetEnrollments([]); setTargetEvents([]);
      setPickedTargetEnrollment(''); setPickedTargetEvent('');
      return;
    }
    (async () => {
      try {
        const e = await api.listCaptureTeiEnrollments(
          pickedTargetTei, theirProgramConstraint);
        if (cancelled) return;
        const es = (e.enrollments ?? []).filter((er) =>
          !theirProgramConstraint
          || er.programUid === theirProgramConstraint);
        setTargetEnrollments(es.map((x) => ({
          enrollmentUid: x.enrollmentUid,
          programUid: x.programUid,
          enrollmentDate: x.enrollmentDate ?? null,
          status: x.status ?? null,
        })));
        setPickedTargetEnrollment(es[0]?.enrollmentUid ?? '');
        if (theirKind === 'EVENT') {
          const allEvents: typeof targetEvents = [];
          for (const er of es) {
            try {
              const evs = await api.listCaptureEnrollmentEvents(
                er.enrollmentUid);
              for (const ev of (evs.events ?? [])) {
                if (theirStageConstraint
                  && ev.programStageUid !== theirStageConstraint) continue;
                allEvents.push({
                  eventUid: ev.eventUid,
                  enrollmentUid: ev.enrollmentUid,
                  programStageUid: ev.programStageUid,
                  occurredDate: ev.occurredDate ?? null,
                  status: ev.status ?? null,
                });
              }
            } catch { /* best-effort */ }
          }
          if (!cancelled) {
            setTargetEvents(allEvents);
            setPickedTargetEvent(allEvents[0]?.eventUid ?? '');
          }
        } else {
          setTargetEvents([]); setPickedTargetEvent('');
        }
      } catch { /* leave empty */ }
    })();
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pickedTargetTei, theirKind, theirProgramConstraint,
      theirStageConstraint]);

  // Load new-target form when operator opens inline create.
  const targetTetForCreate = theirTetConstraint ?? tetUid;
  const targetProgramForCreate = theirProgramConstraint ?? programUid;
  useEffect(() => {
    if (!creatingTarget || !targetTetForCreate) return;
    let cancelled = false;
    setCreateState('loading-form');
    (async () => {
      try {
        const res = await api.listCaptureTeiTypeAttributes(
          targetTetForCreate);
        if (cancelled) return;
        const parsed = parseTeiAttributesForm(res.attributes);
        setNewTargetSections(parsed.sections);
        setNewTargetValues({});
        setCreateState('idle');
      } catch (e) {
        if (!cancelled) {
          setCreateState('err');
          setCreateMsg((e as Error).message ?? 'Failed to load form');
        }
      }
    })();
    return () => { cancelled = true; };
  }, [creatingTarget, targetTetForCreate, api]);

  // Load the target-event stage form when the operator opens the
  // inline "+ Create new event" panel. Reuses the same
  // api.getCaptureStageForm the main TrackerStageEditor uses so
  // the operator fills exactly the same data elements they'd
  // see editing the event later.
  useEffect(() => {
    if (!creatingEvent || theirKind !== 'EVENT'
        || !theirStageConstraint) return;
    const programForEvent = theirProgramConstraint
      ?? targetEnrollments.find(
        (e) => e.enrollmentUid === pickedTargetEnrollment)?.programUid
      ?? programUid;
    let cancelled = false;
    setEventCreateState('loading-form');
    (async () => {
      try {
        const assembly = await api.getCaptureStageForm(
          programForEvent, theirStageConstraint);
        if (cancelled) return;
        setNewEventSections(assembly.sections);
        setNewEventValues({});
        setEventCreateState('idle');
      } catch (e) {
        if (!cancelled) {
          setEventCreateState('err');
          setEventCreateMsg((e as Error).message
            ?? 'Failed to load the event form');
        }
      }
    })();
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [creatingEvent, theirKind, theirStageConstraint,
      theirProgramConstraint, pickedTargetEnrollment]);

  async function createNewTarget(): Promise<void> {
    if (!targetTetForCreate) return;
    if (!requiredFieldsComplete(newTargetSections, newTargetValues)) {
      setCreateMsg('Fill the required fields marked with *.');
      setCreateState('err'); return;
    }
    setCreateState('submitting'); setCreateMsg(null);
    try {
      const attributes = Object.entries(newTargetValues)
        .filter(([, v]) => v.trim() !== '')
        .map(([attribute, value]) => ({ attribute, value }));
      const result = await api.enrolTei({
        program: targetProgramForCreate,
        orgUnit: orgUnitUid,
        trackedEntityType: targetTetForCreate,
        attributes,
      }) as { teiUid?: string; trackedEntity?: string;
              trackedEntityUid?: string;
              trackedEntityInstance?: string };
      const newUid = result?.teiUid ?? result?.trackedEntity
        ?? result?.trackedEntityUid
        ?? result?.trackedEntityInstance ?? null;
      if (!newUid) throw new Error('Server did not return a TEI UID');
      const r = await api.listTrackerEntities(targetProgramForCreate,
        orgUnitUid, 200);
      const list = r.trackedEntities ?? r.instances ?? [];
      setCandidates(list.map((row) => ({
        uid: row.trackedEntity ?? row.trackedEntityInstance ?? '',
        displayName: row.displayName ?? '',
        lastUpdated: row.lastUpdated ?? '',
      })).filter((c) => c.uid !== '' && c.uid !== teiId));
      setPickedTargetTei(newUid);
      setCreatingTarget(false);
      setCreateState('idle');
    } catch (e) {
      setCreateState('err');
      setCreateMsg((e as Error).message ?? 'Create failed');
    }
  }

  async function createNewTargetEvent(): Promise<void> {
    if (theirKind !== 'EVENT' || !pickedTargetEnrollment
        || !theirStageConstraint) {
      setEventCreateMsg('Pick a target enrolment first.');
      setEventCreateState('err'); return;
    }
    const programForEvent = theirProgramConstraint
      ?? targetEnrollments.find(
        (e) => e.enrollmentUid === pickedTargetEnrollment)?.programUid
      ?? programUid;
    const eventUid = genDhis2Uid();
    setEventCreateState('submitting'); setEventCreateMsg(null);
    try {
      const dataValues = Object.entries(newEventValues)
        .filter(([, v]) => v && v.trim() !== '')
        .map(([dataElement, value]) => ({ dataElement, value }));
      await api.submitEvent({
        program: programForEvent,
        programStage: theirStageConstraint,
        orgUnit: orgUnitUid,
        occurredAt: new Date(newEventDate + 'T00:00:00Z').toISOString(),
        enrollment: pickedTargetEnrollment,
        status: 'ACTIVE',
        event: eventUid,
        dataValues,
      });
      const evs = await api.listCaptureEnrollmentEvents(
        pickedTargetEnrollment);
      setTargetEvents((evs.events ?? [])
        .filter((ev) => !theirStageConstraint
          || ev.programStageUid === theirStageConstraint)
        .map((ev) => ({
          eventUid: ev.eventUid,
          enrollmentUid: ev.enrollmentUid,
          programStageUid: ev.programStageUid,
          occurredDate: ev.occurredDate ?? null,
          status: ev.status ?? null,
        })));
      setPickedTargetEvent(eventUid);
      setCreatingEvent(false);
      setEventCreateState('idle');
    } catch (e) {
      setEventCreateState('err');
      setEventCreateMsg((e as Error).message ?? 'Create event failed');
    }
  }

  function ourAnchorUid(): string {
    // Pre-anchored launches override the normal
    // self-anchor resolution.
    if (preFromKind && preFromUid && preFromKind === ourKind) {
      return preFromUid;
    }
    if (ourKind === 'TRACKED_ENTITY') return teiId;
    if (ourKind === 'ENROLLMENT')     return anchorEnrollment;
    if (ourKind === 'EVENT')          return anchorEvent;
    return '';
  }
  function theirAnchorUid(): string {
    if (theirKind === 'TRACKED_ENTITY') return pickedTargetTei;
    if (theirKind === 'ENROLLMENT')     return pickedTargetEnrollment;
    if (theirKind === 'EVENT')          return pickedTargetEvent;
    return '';
  }

  const canAdvanceStep1 = pickedTypeId !== '';
  const canAdvanceStep2 = canAdvanceStep1
    && ourAnchorUid() !== '' && theirAnchorUid() !== ''
    && ourAnchorUid() !== theirAnchorUid()
    && !creatingTarget && !creatingEvent;

  function cancelAndExit(): void {
    navTracker.detail(programUid, teiId);
  }

  async function doSave(): Promise<void> {
    if (!pickedType || !ourKind || !theirKind) return;
    setSubmit('submitting'); setSubmitMsg(null);
    try {
      const fromEntityType = flipped ? theirKind : ourKind;
      const fromEntityUid  = flipped ? theirAnchorUid() : ourAnchorUid();
      const toEntityType   = flipped ? ourKind : theirKind;
      const toEntityUid    = flipped ? ourAnchorUid() : theirAnchorUid();
      const res = await api.submitTrackerRelationship({
        relationshipType: pickedTypeId,
        fromEntityType, fromEntityUid,
        toEntityType, toEntityUid,
        bidirectional: pickedType.bidirectional,
      });
      if (res.ok) {
        setSubmit('ok');
        // Navigate straight back to the record after a successful
        // save — the Relationships rail there surfaces the newly
        // added link with its "Pending sync" badge.
        navTracker.detail(programUid, teiId);
      } else {
        setSubmit('err');
        setSubmitMsg(res.message);
      }
    } catch (e) {
      setSubmit('err');
      setSubmitMsg((e as Error).message ?? 'Save failed');
    }
  }

  const label = pickedType ? directionalLabel(pickedType, flipped) : '';
  const targetReady = pickedTypeId !== ''
    && ourAnchorUid() !== '' && theirAnchorUid() !== ''
    && ourAnchorUid() !== theirAnchorUid()
    && !creatingTarget && !creatingEvent;

  return (
    <div className="cap-rel-form" data-test="tr-rel-form">
      <div className="cap-section-head">
        <button type="button"
                className="cap-btn cap-btn--secondary"
                data-test="tr-rel-form-cancel"
                style={{ padding: '5px 13px', fontSize: 13 }}
                onClick={cancelAndExit}>
          ← Cancel
        </button>
        <h2 className="cap-section-head__title">Add relationship</h2>
        <span className="cap-section-head__count">
          {pickedType
            ? `${label} · fill the target details then save`
            : 'pick a relationship type to start'}
        </span>
      </div>

      <div className="cap-rel-form__body">
        {/* Section 1 — Type */}
        <section className="cap-rel-form__section"
                 data-test="tr-rel-form-types">
          <h3 className="cap-rel-form__section-title">
            1. Relationship type
            <span className="cap-input__req">*</span>
          </h3>
            {eligibleTypes.length === 0 ? (
              <div className="cap-placeholder">
                No relationship types permit this tracked entity
                (or its enrolments / events) as an endpoint. Ask an
                admin to configure a relationship type first.
              </div>
            ) : (
              <label className="cap-input"
                     style={{ maxWidth: 520, display: 'block' }}>
                <span className="cap-input__label">
                  Choose a type
                </span>
                <select className="cap-input__ctl"
                        data-test="tr-rel-wiz-typelist"
                        value={pickedTypeId}
                        onChange={(e) => {
                          const id = e.target.value;
                          setPickedTypeId(id);
                          const t = eligibleTypes.find(
                            (x) => x.id === id);
                          if (!t) { setFlipped(false); return; }
                          const fromKind = mirrorToEdgeKind(t.fromEntity);
                          const fromCan = canAnchor(fromKind, t.fromTet,
                            t.fromProgram, t.fromStage);
                          setFlipped(!fromCan && t.bidirectional);
                        }}>
                  <option value="">— Select type —</option>
                  {eligibleTypes.map((t) => {
                    const fromKind = mirrorToEdgeKind(t.fromEntity);
                    const fromCan = canAnchor(fromKind, t.fromTet,
                      t.fromProgram, t.fromStage);
                    const optFlipped = !fromCan && t.bidirectional;
                    const label = directionalLabel(t, optFlipped);
                    return (
                      <option key={t.id} value={t.id}
                              title={t.displayName}>
                        {label}
                        {t.bidirectional ? ' (both ways)' : ''}
                      </option>
                    );
                  })}
                </select>
                {pickedType && (
                  <span className="cap-input__help">
                    {pickedType.displayName}
                  </span>
                )}
              </label>
            )}
        </section>

        {/* Section 2 — Target */}
        {pickedType && (
          <section className="cap-rel-form__section"
                   data-test="tr-rel-form-target">
            <h3 className="cap-rel-form__section-title">
              2. Target {label.toLowerCase()}
              <span className="cap-input__req">*</span>
            </h3>
            <p className="cap-sub" style={{ marginTop: 0 }}>
              Pick an existing {label.toLowerCase()} — or create a
              new one on the spot if none exist yet.
            </p>
            {ourKind === 'ENROLLMENT'
              && ourEnrollmentCandidates.length > 1 && (
              <label className="cap-input" style={{ maxWidth: 420 }}>
                <span className="cap-input__label">
                  From enrolment<span className="cap-input__req">*</span>
                </span>
                <select className="cap-input__ctl"
                        value={anchorEnrollment}
                        onChange={(e) =>
                          setAnchorEnrollment(e.target.value)}>
                  {ourEnrollmentCandidates.map((e) => (
                    <option key={e.enrollmentUid} value={e.enrollmentUid}>
                      {(e.enrollmentDate ?? 'undated')}
                      {e.status ? ' · ' + e.status : ''}
                      {' · '}{e.enrollmentUid}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <label className="cap-input" style={{ maxWidth: 520,
              display: 'block' }}>
              <span className="cap-input__label"
                    style={{ display: 'flex', alignItems: 'baseline',
                      justifyContent: 'space-between' }}>
                <span>{label}
                  <span className="cap-input__req">*</span></span>
                {!creatingTarget && (
                  <button type="button"
                          className="cap-link-btn"
                          data-test="tr-rel-wiz-new-target"
                          style={{ fontSize: 13, padding: 0,
                            background: 'none', border: 0,
                            color: 'var(--der-primary)', cursor: 'pointer' }}
                          onClick={() => setCreatingTarget(true)}>
                    + Create new
                  </button>
                )}
              </span>
              <select className="cap-input__ctl"
                      data-test="tr-rel-wiz-target"
                      value={pickedTargetTei}
                      disabled={creatingTarget}
                      onChange={(e) =>
                        setPickedTargetTei(e.target.value)}>
                <option value="">— Select {label.toLowerCase()} —</option>
                {candidates.map((c) => (
                  <option key={c.uid} value={c.uid}>
                    {c.displayName
                      ? c.displayName + '  ·  ' + c.uid
                      : c.uid}
                  </option>
                ))}
              </select>
              {candidates.length === 0 && !creatingTarget && (
                <span className="cap-input__help">
                  No eligible tracked entities loaded — use
                  <strong style={{ padding: '0 3px' }}>
                    + Create new
                  </strong>
                  above.
                </span>
              )}
            </label>
            {creatingTarget && (
              <div className="cap-rel-new-target"
                   data-test="tr-rel-wiz-new-target-panel"
                   style={{ background: 'var(--der-surface-subtle)',
                     border: '1px solid var(--der-border-soft)',
                     borderRadius: 4, padding: '14px 16px',
                     marginTop: 10 }}>
                <strong style={{ fontSize: 14 }}>New {label}</strong>
                {createMsg && (
                  <div className="cap-strip cap-strip--err"
                       style={{ margin: '8px 0' }}>{createMsg}</div>
                )}
                {createState === 'loading-form' ? (
                  <p className="cap-sub">Loading attributes…</p>
                ) : (
                  <FormEngine api={api} sections={newTargetSections}
                               values={newTargetValues}
                               onChange={(k, v) => setNewTargetValues(
                                 (prev) => ({ ...prev, [k]: v }))} />
                )}
                <div style={{ display: 'flex',
                  justifyContent: 'flex-end', gap: 10,
                  marginTop: 14, paddingTop: 14,
                  borderTop: '1px solid var(--der-border-soft)' }}>
                  <button type="button"
                          className="cap-btn cap-btn--secondary"
                          style={{ padding: '5px 13px', fontSize: 13 }}
                          disabled={createState === 'submitting'}
                          onClick={() => {
                            setCreatingTarget(false);
                            setCreateMsg(null);
                            setCreateState('idle');
                            setNewTargetValues({});
                          }}>Cancel</button>
                  <button type="button"
                          className="cap-btn cap-btn--primary"
                          style={{ padding: '5px 13px', fontSize: 13 }}
                          disabled={createState === 'submitting'
                            || newTargetSections.length === 0}
                          onClick={() => { void createNewTarget(); }}>
                    {createState === 'submitting' ? 'Creating…'
                      : 'Create ' + label}
                  </button>
                </div>
              </div>
            )}
            {pickedTargetTei && theirKind !== 'TRACKED_ENTITY' && (
              <label className="cap-input" style={{ maxWidth: 520,
                display: 'block', marginTop: 10 }}>
                <span className="cap-input__label">
                  Target enrolment<span className="cap-input__req">*</span>
                </span>
                <select className="cap-input__ctl"
                        value={pickedTargetEnrollment}
                        onChange={(e) =>
                          setPickedTargetEnrollment(e.target.value)}>
                  <option value="">— Select enrolment —</option>
                  {targetEnrollments.map((e) => (
                    <option key={e.enrollmentUid} value={e.enrollmentUid}>
                      {(e.enrollmentDate ?? 'undated')}
                      {e.status ? ' · ' + e.status : ''}
                      {' · '}{e.enrollmentUid}
                    </option>
                  ))}
                </select>
              </label>
            )}
            {pickedTargetTei && theirKind === 'EVENT' && (
              <label className="cap-input" style={{ maxWidth: 520,
                display: 'block', marginTop: 10 }}>
                <span className="cap-input__label"
                      style={{ display: 'flex', alignItems: 'baseline',
                        justifyContent: 'space-between' }}>
                  <span>Target event
                    <span className="cap-input__req">*</span></span>
                  {pickedTargetEnrollment && !creatingEvent && (
                    <button type="button"
                            className="cap-link-btn"
                            data-test="tr-rel-wiz-new-event"
                            style={{ fontSize: 13, padding: 0,
                              background: 'none', border: 0,
                              color: 'var(--der-primary)',
                              cursor: 'pointer' }}
                            onClick={() => setCreatingEvent(true)}>
                      + Create new
                    </button>
                  )}
                </span>
                <select className="cap-input__ctl"
                        value={pickedTargetEvent}
                        disabled={creatingEvent}
                        onChange={(e) =>
                          setPickedTargetEvent(e.target.value)}>
                  <option value="">— Select event —</option>
                  {targetEvents.map((ev) => (
                    <option key={ev.eventUid} value={ev.eventUid}>
                      {(ev.occurredDate ?? 'undated')}
                      {ev.status ? ' · ' + ev.status : ''}
                      {' · '}{ev.eventUid}
                    </option>
                  ))}
                </select>
              </label>
            )}
            {creatingEvent && theirKind === 'EVENT' && (
              <div className="cap-rel-new-target"
                   data-test="tr-rel-wiz-new-event-panel"
                   style={{ background: 'var(--der-surface-subtle)',
                     border: '1px solid var(--der-border-soft)',
                     borderRadius: 4, padding: '14px 16px',
                     marginTop: 10 }}>
                <strong style={{ fontSize: 14 }}>New event</strong>
                <div style={{ marginTop: 4, fontSize: 12,
                  color: 'var(--der-text-muted)' }}>
                  Capture the full event here — same data elements
                  you'd see editing it later from the stage form.
                </div>
                {eventCreateMsg && (
                  <div className="cap-strip cap-strip--err"
                       style={{ margin: '10px 0' }}>{eventCreateMsg}</div>
                )}
                <label className="cap-input"
                       style={{ marginTop: 12, maxWidth: 260 }}>
                  <span className="cap-input__label">Occurred on
                    <span className="cap-input__req">*</span></span>
                  <input type="date" className="cap-input__ctl"
                         value={newEventDate}
                         onChange={(e) =>
                           setNewEventDate(e.target.value)} />
                </label>
                {eventCreateState === 'loading-form' && (
                  <p className="cap-sub"
                     style={{ marginTop: 12 }}>
                    Loading event form…
                  </p>
                )}
                {eventCreateState !== 'loading-form'
                  && newEventSections.length > 0 && (
                  <div style={{ marginTop: 14 }}>
                    <FormEngine api={api}
                                 sections={newEventSections}
                                 values={newEventValues}
                                 onChange={(k, v) => setNewEventValues(
                                   (prev) => ({ ...prev, [k]: v }))} />
                  </div>
                )}
                {eventCreateState !== 'loading-form'
                  && newEventSections.length === 0 && (
                  <p className="cap-sub"
                     style={{ marginTop: 12, fontSize: 12 }}>
                    The target stage has no data elements
                    configured — only the occurred-on date will
                    be captured.
                  </p>
                )}
                <div style={{ display: 'flex',
                  justifyContent: 'flex-end', gap: 10,
                  marginTop: 14, paddingTop: 14,
                  borderTop: '1px solid var(--der-border-soft)' }}>
                  <button type="button"
                          className="cap-btn cap-btn--secondary"
                          style={{ padding: '5px 13px', fontSize: 13 }}
                          disabled={eventCreateState === 'submitting'}
                          onClick={() => {
                            setCreatingEvent(false);
                            setEventCreateMsg(null);
                            setEventCreateState('idle');
                            setNewEventDate(todayIsoDate());
                            setNewEventSections([]);
                            setNewEventValues({});
                          }}>Cancel</button>
                  <button type="button"
                          className="cap-btn cap-btn--primary"
                          style={{ padding: '5px 13px', fontSize: 13 }}
                          disabled={eventCreateState === 'submitting'
                            || eventCreateState === 'loading-form'
                            || newEventDate === ''}
                          onClick={() => { void createNewTargetEvent(); }}>
                    {eventCreateState === 'submitting' ? 'Creating…'
                      : 'Create event'}
                  </button>
                </div>
              </div>
            )}
          </section>
        )}

        {/* Section 3 — Review */}
        {pickedType && targetReady && (
          <section className="cap-rel-form__section"
                   data-test="tr-rel-form-review">
            <h3 className="cap-rel-form__section-title">
              3. Review
            </h3>
            <p className="cap-sub" style={{ marginTop: 0 }}>
              Nothing is saved until you click
              <strong style={{ padding: '0 3px' }}>
                Add {label}
              </strong>
              below.
            </p>
            <dl className="cap-rel-wiz__review">
              <div>
                <dt>Relationship</dt>
                <dd>{label} <span className="cap-sub"
                  style={{ fontSize: 13 }}>
                  ({pickedType.displayName})</span></dd>
              </div>
              <div>
                <dt>From this record</dt>
                <dd>
                  {ourKind === 'TRACKED_ENTITY' ? teiId
                    : ourKind === 'ENROLLMENT' ? anchorEnrollment
                    : anchorEvent}
                </dd>
              </div>
              <div>
                <dt>To</dt>
                <dd>
                  {theirKind === 'TRACKED_ENTITY' ? pickedTargetTei
                    : theirKind === 'ENROLLMENT' ? pickedTargetEnrollment
                    : pickedTargetEvent}
                </dd>
              </div>
              {pickedType.bidirectional && (
                <div>
                  <dt>Direction</dt>
                  <dd>Both ways</dd>
                </div>
              )}
            </dl>
            {submit === 'err' && submitMsg && (
              <div className="cap-strip cap-strip--err"
                   data-test="tr-rel-form-err"
                   style={{ margin: '12px 0 0' }}>{submitMsg}</div>
            )}
          </section>
        )}
      </div>

      <div className="cap-rel-form__footer">
        <button type="button"
                className="cap-btn cap-btn--secondary"
                data-test="tr-rel-form-cancel-foot"
                style={{ padding: '5px 13px', fontSize: 13 }}
                disabled={submit === 'submitting'}
                onClick={cancelAndExit}>
          Cancel
        </button>
        <span style={{ flex: 1 }} />
        <button type="button"
                className="cap-btn cap-btn--primary"
                data-test="tr-rel-form-save"
                style={{ padding: '5px 13px', fontSize: 13 }}
                disabled={submit === 'submitting' || !targetReady}
                onClick={() => { void doSave(); }}>
          {submit === 'submitting' ? 'Saving…'
            : pickedType ? 'Add ' + label : 'Add relationship'}
        </button>
      </div>
    </div>
  );
}
