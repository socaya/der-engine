import { useEffect, useMemo, useState } from 'react';
import { FormEngine, requiredFieldsComplete }
  from '../shared/FormEngine';
import { parseTeiAttributesForm } from '../shared/parser';
import type { CaptureFormSection } from '../shared/model';
import type { CaptureApi } from '../shared/types';
import { navTracker } from '../shared/routing';

/** DHIS2 relationship-constraint kind as stored on the metadata
 *  mirror (verbose form, matches /api/relationshipTypes). The edge
 *  table + journal use shorter identifiers (TRACKED_ENTITY /
 *  ENROLLMENT / EVENT) — see mirrorToEdgeKind below. */
type MirrorKind = 'TRACKED_ENTITY_INSTANCE'
  | 'PROGRAM_INSTANCE' | 'PROGRAM_STAGE_INSTANCE';
type EdgeKind = 'TRACKED_ENTITY' | 'ENROLLMENT' | 'EVENT';

function mirrorToEdgeKind(k: string | undefined): EdgeKind | null {
  if (k === 'TRACKED_ENTITY_INSTANCE') return 'TRACKED_ENTITY';
  if (k === 'PROGRAM_INSTANCE')         return 'ENROLLMENT';
  if (k === 'PROGRAM_STAGE_INSTANCE')   return 'EVENT';
  return null;
}

/** Operator-facing name for a relationship type from the current
 *  side's perspective. DHIS2 types carry two directional names —
 *  fromToName (what the FROM side calls this link, e.g. "Baby"
 *  when the from is a mother) and toFromName (what the TO side
 *  calls it, e.g. "Mother"). When we're anchoring the TO side
 *  (flipped bidirectional type) we surface toFromName; otherwise
 *  fromToName. Falls back to displayName when the type hasn't
 *  configured directional names, so the picker always has
 *  something human-friendly to show. */
function directionalLabel(t: RelTypeRow, flipped: boolean): string {
  const name = flipped
    ? (t.toFromName ?? t.fromToName)
    : (t.fromToName ?? t.toFromName);
  return name ?? t.displayName;
}

interface CustomAction {
  readonly label: string;
  readonly urlTemplate: string;
  readonly opensInNewTab?: boolean;
  readonly destructive?: boolean;
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
  readonly customActions?: ReadonlyArray<CustomAction>;
}

interface RelSummaryField { label: string; value: string }

interface RelEndpoint {
  trackedEntity?: {
    trackedEntity?: string;
    displayName?: string;
    summaryFields?: ReadonlyArray<RelSummaryField>;
  };
  enrollment?: {
    enrollment?: string;
    programUid?: string;
    programName?: string;
    teiUid?: string;
    teiDisplayName?: string;
    teiSummaryFields?: ReadonlyArray<RelSummaryField>;
    enrollmentDate?: string;
    status?: string;
  };
  event?: {
    event?: string;
    enrollmentUid?: string;
    programUid?: string;
    programName?: string;
    programStageUid?: string;
    programStageName?: string;
    occurredDate?: string;
    status?: string;
    summaryFields?: ReadonlyArray<RelSummaryField>;
  };
}

type RelSyncStatus =
  'LOCAL' | 'PENDING' | 'SYNCED' | 'FAILED' | 'BLOCKED' | 'CONFLICT';

interface RelRow {
  readonly relationship?: string;
  readonly relationshipType?: string;
  readonly relationshipName?: string;
  readonly bidirectional?: boolean;
  readonly createdAt?: string;
  readonly lastUpdated?: string;
  readonly syncStatus?: RelSyncStatus;
  readonly from?: RelEndpoint;
  readonly to?: RelEndpoint;
}

/**
 * Relationships widget on the TEI dashboard (requirements doc §13
 * "Relationship Management Architecture", §REL-UX-001 to
 * §REL-UX-006). Full-matrix compose: any from/to combination of
 * TRACKED_ENTITY / ENROLLMENT / EVENT, resolved from the mirrored
 * RelationshipType constraints.
 *
 * Reads come from the mirrored edge table; writes enqueue a
 * journal entry that drains to central on connectivity. Deletes
 * use POST /api/tracker?importStrategy=DELETE (2.44 shape).
 */
export function TrackerRelationshipsSection(
  { api, tei, programUid, orgUnitUid, tetUid,
    currentEnrollmentUid }: {
    api: CaptureApi; tei: string;
    programUid: string; orgUnitUid: string;
    tetUid: string | null;
    /** The currently-selected enrolment on the detail page — lets
     *  us anchor the from-side without an extra picker when a
     *  relationship type's from-constraint is ENROLLMENT in the
     *  current program. Null if no enrolment is active. */
    currentEnrollmentUid: string | null;
  },
): JSX.Element {
  const [rows, setRows] = useState<RelRow[]>([]);
  const [status, setStatus] =
    useState<'idle' | 'loading' | 'err'>('loading');
  const [types, setTypes] = useState<RelTypeRow[]>([]);

  /** Inline compose panel toggled by + Add relationship. */
  const [composing, setComposing] = useState(false);
  const [pickedTypeId, setPickedTypeId] = useState('');
  /** When true, the current TEI/enrol/event anchors the TO side
   *  instead of the FROM side — only meaningful for bidirectional
   *  types whose fromConstraint doesn't match our context but
   *  whose toConstraint does. The edge still stores one canonical
   *  (from, to) pair; the UI just flips which side the operator
   *  is picking a target for. */
  const [flipped, setFlipped] = useState(false);
  const [pickedTargetTei, setPickedTargetTei] = useState('');
  const [pickedTargetEnrollment, setPickedTargetEnrollment] = useState('');
  const [pickedTargetEvent, setPickedTargetEvent] = useState('');
  /** Self-anchor refinements: when the from-side kind is ENROLLMENT
   *  / EVENT and the current TEI has more than one candidate, let
   *  the operator pick which one anchors the link. Defaults to the
   *  currently-active enrolment / its most recent event. */
  const [anchorEnrollment, setAnchorEnrollment] =
    useState<string>(currentEnrollmentUid ?? '');
  const [anchorEvent, setAnchorEvent] = useState<string>('');
  const [submit, setSubmit] =
    useState<'idle' | 'submitting' | 'ok' | 'err'>('idle');
  const [submitMsg, setSubmitMsg] = useState<string | null>(null);

  /** Inline "create a new target TEI" flow — when the operator
   *  picks a relationship type but there's no eligible existing
   *  TEI at this facility, instead of a dead end we let them
   *  register one on the spot. Reuses the TEI registration
   *  form via parseTeiAttributesForm + FormEngine so the new
   *  record carries the right TEA set for the target TET.
   *  Once saved, the new TEI is auto-selected as the target and
   *  the normal save-relationship flow resumes. */
  const [creatingTarget, setCreatingTarget] = useState(false);
  const [targetTetUid, setTargetTetUid] = useState<string | null>(null);
  const [newTargetSections, setNewTargetSections] =
    useState<readonly CaptureFormSection[]>([]);
  const [newTargetValues, setNewTargetValues] =
    useState<Record<string, string>>({});
  const [createState, setCreateState] =
    useState<'idle' | 'loading-form' | 'submitting' | 'err'>('idle');
  const [createMsg, setCreateMsg] = useState<string | null>(null);

  /** Inline "create a new target event" flow — mirrors the TEI
   *  creation above for EVENT-kind targets. Once the operator has
   *  a target TEI + enrolment, they can create a fresh event in
   *  the type's constraint stage without context-switching to the
   *  stage editor. Minimal form: just the occurredAt date
   *  (defaults to today) — the operator can fill in data values
   *  later through the normal stage-editor flow. */
  const [creatingEvent, setCreatingEvent] = useState(false);
  const [newEventDate, setNewEventDate] =
    useState<string>(todayIsoDate());
  const [eventCreateState, setEventCreateState] =
    useState<'idle' | 'submitting' | 'err'>('idle');
  const [eventCreateMsg, setEventCreateMsg] = useState<string | null>(null);

  /** Tracked entities in the current program/org unit — candidates
   *  for the target-TEI dropdown. Single fetch per (programUid,
   *  orgUnitUid) swap. */
  const [candidates, setCandidates] = useState<Array<{
    uid: string; displayName: string; lastUpdated: string }>>([]);

  /** Flat-list filter controls — operators asked for one unified
   *  table rather than per-type sections. All three filters are
   *  client-side (the row set is already loaded) so changes are
   *  instant. */
  const [filterType, setFilterType] = useState<string>('');
  const [filterStatus, setFilterStatus] = useState<string>('');
  const [filterText, setFilterText] = useState<string>('');

  /** Lazy caches populated when the target TEI / anchor enrolment
   *  flips — keyed by enrolment/TEI UID so the next refetch in the
   *  same compose session hits a warm cache. */
  const [targetEnrollments, setTargetEnrollments] =
    useState<Array<{ enrollmentUid: string; programUid: string;
      enrollmentDate: string | null; status: string | null }>>([]);
  const [targetEvents, setTargetEvents] =
    useState<Array<{ eventUid: string; enrollmentUid: string;
      programStageUid: string; occurredDate: string | null;
      status: string | null }>>([]);
  /** Current TEI's own enrolments / events — for the from-side
   *  anchor picker when fromConstraintKind is ENROLLMENT or EVENT. */
  const [selfEnrollments, setSelfEnrollments] =
    useState<Array<{ enrollmentUid: string; programUid: string;
      enrollmentDate: string | null; status: string | null }>>([]);
  const [selfEvents, setSelfEvents] =
    useState<Array<{ eventUid: string; enrollmentUid: string;
      programStageUid: string; occurredDate: string | null;
      status: string | null }>>([]);

  // --- Fetch: candidates (target TEIs) ----------------------------
  // When the picked type's target constrains a specific program
  // (e.g. a TEI→ENROLLMENT link into a different program than the
  // current page), we must list TEIs enrolled in THAT program —
  // not the current page's program. Otherwise the picker is empty
  // for any cross-program link even when valid targets exist. We
  // derive the target program inline (without depending on the
  // theirProgramConstraint const below, which would hit a TDZ
  // ordering issue inside this early effect). */
  useEffect(() => {
    let cancelled = false;
    const pt = types.find((t) => t.id === pickedTypeId);
    const programForCandidates = pt
      ? (!pt.bidirectional || canAnchor(
          mirrorToEdgeKind(pt.fromEntity), pt.fromTet,
          pt.fromProgram, pt.fromStage)
          ? (pt.toProgram ?? programUid)
          : (pt.fromProgram ?? programUid))
      : programUid;
    (async () => {
      try {
        const r = await api.listTrackerEntities(programForCandidates,
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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [programUid, pickedTypeId, orgUnitUid, tei, api, types]);

  // --- Fetch: current TEI's own enrolments + events ---------------
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const e = await api.listCaptureTeiEnrollments(tei);
        if (cancelled) return;
        const es = e.enrollments ?? [];
        setSelfEnrollments(es.map((x) => ({
          enrollmentUid: x.enrollmentUid,
          programUid: x.programUid,
          enrollmentDate: x.enrollmentDate ?? null,
          status: x.status ?? null,
        })));
        // Flatten events across all enrolments so EVENT-anchored
        // relationship types can filter by stage without us having
        // to know which enrolment they belong to upfront.
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
      } catch {
        if (!cancelled) { setSelfEnrollments([]); setSelfEvents([]); }
      }
    })();
    return () => { cancelled = true; };
  }, [tei, api]);

  // --- Fetch: rows + types ---------------------------------------
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
          toEntity:   t.toConstraint?.relationshipEntity,
          fromTet:    t.fromConstraint?.trackedEntityType?.id,
          toTet:      t.toConstraint?.trackedEntityType?.id,
          fromProgram: t.fromConstraint?.program?.id ?? undefined,
          toProgram:   t.toConstraint?.program?.id ?? undefined,
          fromStage:   t.fromConstraint?.programStage?.id ?? undefined,
          toStage:     t.toConstraint?.programStage?.id ?? undefined,
          customActions: (t as { customActions?:
              ReadonlyArray<CustomAction> }).customActions,
        })));
        setStatus('idle');
      } catch {
        if (!cancelled) { setRows([]); setStatus('err'); }
      }
    })();
    return () => { cancelled = true; };
  }, [tei, api]);

  // --- Eligibility (loosened for full matrix) --------------------
  /** Can we anchor the current TEI / enrolment / event on the
   *  side whose constraint is (kind, tetConstraint, programConstraint,
   *  stageConstraint)? */
  function canAnchor(
    kind: EdgeKind | null,
    tetConstraint: string | undefined,
    programConstraint: string | undefined,
    stageConstraint: string | undefined,
  ): boolean {
    if (!kind) return false;
    if (kind === 'TRACKED_ENTITY') {
      if (!tetUid) return false;
      if (tetConstraint && tetConstraint !== tetUid) return false;
      return true;
    }
    if (kind === 'ENROLLMENT') {
      return selfEnrollments.some((e) =>
        !programConstraint || e.programUid === programConstraint);
    }
    // EVENT
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

  // The effective "our side" / "their side" constraint kinds after
  // accounting for flip. When `flipped`, we anchor the TO side with
  // our current context and present the target picker for the FROM
  // side. The edge write keeps (from, to) canonical.
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

  // Our-side candidates (for anchor refinement when kind is
  // ENROLLMENT or EVENT and more than one choice exists).
  const ourEnrollmentCandidates = ourKind === 'ENROLLMENT'
    ? selfEnrollments.filter((e) => !ourProgramConstraint
      || e.programUid === ourProgramConstraint) : [];
  const ourEventCandidates = ourKind === 'EVENT'
    ? selfEvents.filter((e) => !ourStageConstraint
      || e.programStageUid === ourStageConstraint) : [];

  // Pre-seed sensible defaults when type / flip changes.
  useEffect(() => {
    if (!pickedType) return;
    if (ourKind === 'ENROLLMENT') {
      // Prefer the currently-active enrolment if it matches.
      const current = ourEnrollmentCandidates.find(
        (e) => e.enrollmentUid === currentEnrollmentUid);
      setAnchorEnrollment(current?.enrollmentUid
        ?? ourEnrollmentCandidates[0]?.enrollmentUid ?? '');
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

  // --- Fetch: target TEI's enrolments / events on pick ---------------
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
      } catch {
        if (!cancelled) {
          setTargetEnrollments([]); setTargetEvents([]);
        }
      }
    })();
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pickedTargetTei, theirKind, theirProgramConstraint,
      theirStageConstraint]);

  function resetCompose(): void {
    setComposing(false);
    setPickedTypeId(''); setFlipped(false);
    setPickedTargetTei(''); setPickedTargetEnrollment('');
    setPickedTargetEvent(''); setAnchorEnrollment('');
    setAnchorEvent(''); setSubmit('idle'); setSubmitMsg(null);
    setCreatingTarget(false); setNewTargetValues({});
    setNewTargetSections([]); setCreateState('idle');
    setCreateMsg(null); setTargetTetUid(null);
    setCreatingEvent(false); setNewEventDate(todayIsoDate());
    setEventCreateState('idle'); setEventCreateMsg(null);
  }

  /** Resolve which TET the new target should be created against.
   *  Prefers the type's explicit TET constraint on the target
   *  side; falls back to the current TEI's TET (same facility,
   *  same cohort — matches the default expectation when the type
   *  doesn't pin a specific TET). */
  const targetTetForCreate = theirTetConstraint ?? tetUid;
  /** Program to enrol the new TEI into. For ENROLLMENT/EVENT
   *  targets the type's program constraint MUST match; for plain
   *  TRACKED_ENTITY targets we default to the current page's
   *  program so the new record is immediately navigable. */
  const targetProgramForCreate = theirProgramConstraint ?? programUid;

  // Load the TEA form when the operator opens the create panel —
  // separate effect so the fetch doesn't fire until actually needed.
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
        setTargetTetUid(targetTetForCreate);
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

  async function createNewTarget(): Promise<void> {
    if (!targetTetUid) return;
    if (!requiredFieldsComplete(newTargetSections, newTargetValues)) {
      setCreateMsg('Fill the required fields marked with *.');
      setCreateState('err');
      return;
    }
    setCreateState('submitting'); setCreateMsg(null);
    try {
      const attributes = Object.entries(newTargetValues)
        .filter(([, v]) => v.trim() !== '')
        .map(([attribute, value]) => ({ attribute, value }));
      const result = await api.enrolTei({
        program: targetProgramForCreate,
        orgUnit: orgUnitUid,
        trackedEntityType: targetTetUid,
        attributes,
      }) as { teiUid?: string; trackedEntity?: string;
              trackedEntityUid?: string;
              trackedEntityInstance?: string };
      const newUid = result?.teiUid ?? result?.trackedEntity
        ?? result?.trackedEntityUid
        ?? result?.trackedEntityInstance ?? null;
      if (!newUid) {
        throw new Error('Server did not return a TEI UID');
      }
      // Refresh candidates so the new row appears in the select.
      const r = await api.listTrackerEntities(targetProgramForCreate,
        orgUnitUid, 200);
      const list = r.trackedEntities ?? r.instances ?? [];
      setCandidates(list.map((row) => ({
        uid: row.trackedEntity ?? row.trackedEntityInstance ?? '',
        displayName: row.displayName ?? '',
        lastUpdated: row.lastUpdated ?? '',
      })).filter((c) => c.uid !== '' && c.uid !== tei));
      setPickedTargetTei(newUid);
      setCreatingTarget(false);
      setCreateState('idle');
      setNewTargetValues({});
    } catch (e) {
      setCreateState('err');
      setCreateMsg((e as Error).message ?? 'Create failed');
    }
  }

  async function createNewTargetEvent(): Promise<void> {
    if (theirKind !== 'EVENT') return;
    if (!pickedTargetEnrollment) {
      setEventCreateMsg('Pick a target enrolment first.');
      setEventCreateState('err');
      return;
    }
    if (!theirStageConstraint) {
      setEventCreateMsg('The relationship type is missing a target '
        + 'stage constraint — cannot create an event.');
      setEventCreateState('err');
      return;
    }
    const programForEvent = theirProgramConstraint
      ?? targetEnrollments.find(
        (e) => e.enrollmentUid === pickedTargetEnrollment)?.programUid
      ?? programUid;
    const eventUid = generateDhis2UidLocal();
    setEventCreateState('submitting'); setEventCreateMsg(null);
    try {
      await api.submitEvent({
        program: programForEvent,
        programStage: theirStageConstraint,
        orgUnit: orgUnitUid,
        occurredAt: new Date(newEventDate + 'T00:00:00Z').toISOString(),
        enrollment: pickedTargetEnrollment,
        status: 'ACTIVE',
        event: eventUid,
        dataValues: [],
      });
      // Refetch events for the target enrolment so the new row
      // appears in the select, then select it.
      const evs = await api.listCaptureEnrollmentEvents(
        pickedTargetEnrollment);
      const refreshed = (evs.events ?? [])
        .filter((ev) => !theirStageConstraint
          || ev.programStageUid === theirStageConstraint)
        .map((ev) => ({
          eventUid: ev.eventUid,
          enrollmentUid: ev.enrollmentUid,
          programStageUid: ev.programStageUid,
          occurredDate: ev.occurredDate ?? null,
          status: ev.status ?? null,
        }));
      setTargetEvents(refreshed);
      setPickedTargetEvent(eventUid);
      setCreatingEvent(false);
      setNewEventDate(todayIsoDate());
      setEventCreateState('idle');
    } catch (e) {
      setEventCreateState('err');
      setEventCreateMsg((e as Error).message ?? 'Create event failed');
    }
  }

  function ourAnchorUid(): string {
    if (ourKind === 'TRACKED_ENTITY') return tei;
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

  const ourUid = ourAnchorUid();
  const theirUid = theirAnchorUid();
  const selfLink = ourUid !== '' && ourUid === theirUid;
  const canSave = pickedTypeId !== ''
    && ourUid !== '' && theirUid !== ''
    && !selfLink
    && submit !== 'submitting'
    && (theirKind !== 'TRACKED_ENTITY' || pickedTargetTei !== '');

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
        {!composing && (
          <button type="button"
                  className="cap-btn cap-btn--primary"
                  data-test="tr-rel-add"
                  disabled={eligibleTypes.length === 0}
                  onClick={() => navTracker.relationshipNew(
                    programUid, tei)}
                  title={eligibleTypes.length === 0
                    ? (types.length === 0
                      ? 'No relationship types are configured'
                      : 'No relationship types permit this tracked '
                        + 'entity (or its enrolments/events) as an endpoint')
                    : 'Open the add-relationship wizard'}
                  style={{ padding: '5px 13px', fontSize: 13 }}>
            + Add relationship
          </button>
        )}
      </div>

      {composing && (
        <div className="cap-rel-compose" data-test="tr-rel-compose">
          <div className="cap-form-section__grid" style={{ marginTop: 0 }}>
            {/* Relationship type */}
            <label className="cap-input">
              <span className="cap-input__label">
                Relationship type<span className="cap-input__req">*</span>
              </span>
              <select className="cap-input__ctl"
                      data-test="tr-rel-type-select"
                      value={pickedTypeId}
                      onChange={(e) => {
                        setPickedTypeId(e.target.value);
                        const t = eligibleTypes.find(
                          (x) => x.id === e.target.value);
                        if (!t) { setFlipped(false); return; }
                        const fromKind = mirrorToEdgeKind(t.fromEntity);
                        const fromCan = canAnchor(fromKind, t.fromTet,
                          t.fromProgram, t.fromStage);
                        setFlipped(!fromCan && t.bidirectional);
                        setPickedTargetTei('');
                      }}>
                <option value="">— Select type —</option>
                {/* Render the operator-facing directional label
                 *  (fromToName or toFromName depending on which
                 *  side our current context anchors). The full
                 *  displayName is kept as a title tooltip so admins
                 *  troubleshooting metadata can still see it on
                 *  hover, but the primary label is what the
                 *  operator thinks the link is called — "Baby",
                 *  "Treatment supporter", etc. — not the metadata-
                 *  level "X - Y" compound name. */}
                {eligibleTypes.map((t) => {
                  // Compute flip for each option so the label
                  // matches what would actually render after pick.
                  const fromKind = mirrorToEdgeKind(t.fromEntity);
                  const fromCan = canAnchor(fromKind, t.fromTet,
                    t.fromProgram, t.fromStage);
                  const optFlipped = !fromCan && t.bidirectional;
                  return (
                    <option key={t.id} value={t.id}
                            title={t.displayName}>
                      {directionalLabel(t, optFlipped)}
                    </option>
                  );
                })}
              </select>
            </label>

            {/* Our-side anchor refinement — only shown when the kind
             *  isn't TRACKED_ENTITY and there's more than one choice. */}
            {ourKind === 'ENROLLMENT'
              && ourEnrollmentCandidates.length > 1 && (
              <label className="cap-input">
                <span className="cap-input__label">
                  From enrolment<span className="cap-input__req">*</span>
                </span>
                <select className="cap-input__ctl"
                        data-test="tr-rel-anchor-enrollment"
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
            {ourKind === 'EVENT' && ourEventCandidates.length > 1 && (
              <label className="cap-input">
                <span className="cap-input__label">
                  From event<span className="cap-input__req">*</span>
                </span>
                <select className="cap-input__ctl"
                        data-test="tr-rel-anchor-event"
                        value={anchorEvent}
                        onChange={(e) => setAnchorEvent(e.target.value)}>
                  {ourEventCandidates.map((ev) => (
                    <option key={ev.eventUid} value={ev.eventUid}>
                      {(ev.occurredDate ?? 'undated')}
                      {ev.status ? ' · ' + ev.status : ''}
                      {' · '}{ev.eventUid}
                    </option>
                  ))}
                </select>
              </label>
            )}

            {/* Target TEI — label uses the type's directional name
             *  when available ("Baby", "Mother", "Treatment
             *  supporter") so the form reads as a task the operator
             *  recognises, not as DHIS2 metadata jargon. */}
            <label className="cap-input">
              <span className="cap-input__label"
                    style={{ display: 'flex', alignItems: 'baseline',
                      justifyContent: 'space-between' }}>
                <span>
                  {pickedType
                    ? directionalLabel(pickedType, flipped)
                    : 'Target tracked entity'}
                  <span className="cap-input__req">*</span>
                </span>
                {pickedType && !creatingTarget && (
                  <button type="button"
                          className="cap-link-btn"
                          data-test="tr-rel-new-target"
                          style={{ fontSize: 13, padding: 0,
                            background: 'none', border: 0,
                            color: 'var(--der-primary)', cursor: 'pointer' }}
                          onClick={() => setCreatingTarget(true)}>
                    + Create new
                  </button>
                )}
              </span>
              <select className="cap-input__ctl"
                      data-test="tr-rel-target-select"
                      value={pickedTargetTei}
                      disabled={!pickedType || creatingTarget}
                      onChange={(e) => setPickedTargetTei(e.target.value)}>
                <option value="">— Select target —</option>
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
                  No other tracked entities loaded for this
                  program at this facility yet — use
                  <strong style={{ padding: '0 3px' }}>
                    + Create new
                  </strong>
                  above to register one.
                </span>
              )}
              {selfLink && (
                <span className="cap-field-warn cap-field-warn--err">
                  An entity cannot link to itself.
                </span>
              )}
            </label>

            {/* Inline "create new target" panel. Opens when there
             *  are no eligible TEIs OR when the operator clicks
             *  "+ Create new" above. Reuses the TEI-registration
             *  FormEngine so the new record carries the full TEA
             *  set configured for the target TET. Spans both grid
             *  columns so the form has room; the normal target
             *  pickers below are disabled while this is open. */}
            {creatingTarget && (
              <div className="cap-rel-new-target"
                   data-test="tr-rel-new-target-panel"
                   style={{ gridColumn: '1 / -1',
                     background: 'var(--der-surface-subtle)',
                     border: '1px solid var(--der-border-soft)',
                     borderRadius: 4, padding: '14px 16px',
                     marginTop: 4 }}>
                <div style={{ display: 'flex', alignItems: 'center',
                  marginBottom: 12 }}>
                  <strong style={{ fontSize: 14 }}>
                    New {pickedType
                      ? directionalLabel(pickedType, flipped)
                      : 'target'}
                  </strong>
                  <span style={{ flex: 1 }} />
                  <span className="cap-sub"
                        style={{ fontSize: 13,
                          color: 'var(--der-text-muted)' }}>
                    Register a new record to link to
                  </span>
                </div>
                {createState === 'loading-form' && (
                  <p className="cap-sub">Loading attributes…</p>
                )}
                {createMsg && (
                  <div className="cap-strip cap-strip--err"
                       data-test="tr-rel-new-target-err"
                       style={{ marginBottom: 10 }}>
                    {createMsg}
                  </div>
                )}
                {newTargetSections.length > 0
                  && createState !== 'loading-form' && (
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
                          data-test="tr-rel-new-target-cancel"
                          style={{ padding: '5px 13px', fontSize: 13 }}
                          disabled={createState === 'submitting'}
                          onClick={() => {
                            setCreatingTarget(false);
                            setCreateMsg(null);
                            setCreateState('idle');
                            setNewTargetValues({});
                          }}>
                    Cancel
                  </button>
                  <button type="button"
                          className="cap-btn cap-btn--primary"
                          data-test="tr-rel-new-target-save"
                          style={{ padding: '5px 13px', fontSize: 13 }}
                          disabled={createState === 'submitting'
                            || createState === 'loading-form'
                            || newTargetSections.length === 0}
                          onClick={() => { void createNewTarget(); }}>
                    {createState === 'submitting' ? 'Creating…'
                      : 'Create ' + (pickedType
                        ? directionalLabel(pickedType, flipped)
                        : 'record')}
                  </button>
                </div>
              </div>
            )}

            {/* Target enrolment — ENROLLMENT or EVENT target. */}
            {pickedTargetTei !== '' && theirKind !== 'TRACKED_ENTITY' && (
              <label className="cap-input">
                <span className="cap-input__label">
                  Target enrolment<span className="cap-input__req">*</span>
                </span>
                <select className="cap-input__ctl"
                        data-test="tr-rel-target-enrollment"
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
                {targetEnrollments.length === 0 && (
                  <span className="cap-input__help">
                    That tracked entity has no enrolments in the
                    required program.
                  </span>
                )}
              </label>
            )}
            {/* Target event — EVENT target only. "+ Create new"
             *  opens the inline event-create panel below so an
             *  empty-events target isn't a dead end. */}
            {pickedTargetTei !== '' && theirKind === 'EVENT' && (
              <label className="cap-input">
                <span className="cap-input__label"
                      style={{ display: 'flex', alignItems: 'baseline',
                        justifyContent: 'space-between' }}>
                  <span>
                    Target event<span className="cap-input__req">*</span>
                  </span>
                  {pickedTargetEnrollment && !creatingEvent && (
                    <button type="button"
                            className="cap-link-btn"
                            data-test="tr-rel-new-event"
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
                        data-test="tr-rel-target-event"
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
                {targetEvents.length === 0 && !creatingEvent && (
                  <span className="cap-input__help">
                    That tracked entity has no events in the required
                    stage — use
                    <strong style={{ padding: '0 3px' }}>
                      + Create new
                    </strong>
                    above to add one.
                  </span>
                )}
              </label>
            )}

            {/* Inline "create new target event" panel. Spans both
             *  grid columns; minimal form (just the occurred-on
             *  date). The event is created in ACTIVE state with
             *  no data values — operator fills the clinical form
             *  later through the normal stage editor. */}
            {creatingEvent && theirKind === 'EVENT' && (
              <div className="cap-rel-new-target"
                   data-test="tr-rel-new-event-panel"
                   style={{ gridColumn: '1 / -1',
                     background: 'var(--der-surface-subtle)',
                     border: '1px solid var(--der-border-soft)',
                     borderRadius: 4, padding: '14px 16px',
                     marginTop: 4 }}>
                <div style={{ display: 'flex', alignItems: 'center',
                  marginBottom: 12 }}>
                  <strong style={{ fontSize: 14 }}>
                    New event
                  </strong>
                  <span style={{ flex: 1 }} />
                  <span className="cap-sub"
                        style={{ fontSize: 13,
                          color: 'var(--der-text-muted)' }}>
                    Create a placeholder event — fill details in the
                    stage editor later
                  </span>
                </div>
                {eventCreateMsg && (
                  <div className="cap-strip cap-strip--err"
                       data-test="tr-rel-new-event-err"
                       style={{ marginBottom: 10 }}>
                    {eventCreateMsg}
                  </div>
                )}
                <label className="cap-input"
                       style={{ maxWidth: 260 }}>
                  <span className="cap-input__label">
                    Occurred on<span className="cap-input__req">*</span>
                  </span>
                  <input type="date" className="cap-input__ctl"
                         data-test="tr-rel-new-event-date"
                         value={newEventDate}
                         onChange={(e) => setNewEventDate(e.target.value)} />
                </label>
                <div style={{ display: 'flex',
                  justifyContent: 'flex-end', gap: 10,
                  marginTop: 14, paddingTop: 14,
                  borderTop: '1px solid var(--der-border-soft)' }}>
                  <button type="button"
                          className="cap-btn cap-btn--secondary"
                          data-test="tr-rel-new-event-cancel"
                          style={{ padding: '5px 13px', fontSize: 13 }}
                          disabled={eventCreateState === 'submitting'}
                          onClick={() => {
                            setCreatingEvent(false);
                            setEventCreateMsg(null);
                            setEventCreateState('idle');
                            setNewEventDate(todayIsoDate());
                          }}>
                    Cancel
                  </button>
                  <button type="button"
                          className="cap-btn cap-btn--primary"
                          data-test="tr-rel-new-event-save"
                          style={{ padding: '5px 13px', fontSize: 13 }}
                          disabled={eventCreateState === 'submitting'
                            || newEventDate === ''}
                          onClick={() => { void createNewTargetEvent(); }}>
                    {eventCreateState === 'submitting' ? 'Creating…'
                      : 'Create event'}
                  </button>
                </div>
              </div>
            )}
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
                    onClick={resetCompose}
                    style={{ padding: '5px 13px', fontSize: 13 }}>
              Cancel
            </button>
            <button type="button"
                    className="cap-btn cap-btn--primary"
                    data-test="tr-rel-link"
                    disabled={!canSave}
                    onClick={async () => {
                      if (!pickedType || !ourKind || !theirKind) return;
                      setSubmit('submitting'); setSubmitMsg(null);
                      // Canonical from/to — our side is "from" unless
                      // flipped, in which case our side is "to".
                      const fromEntityType = flipped
                        ? theirKind : ourKind;
                      const fromEntityUid = flipped ? theirUid : ourUid;
                      const toEntityType = flipped ? ourKind : theirKind;
                      const toEntityUid = flipped ? ourUid : theirUid;
                      const res = await api.submitTrackerRelationship({
                        relationshipType: pickedTypeId,
                        fromEntityType, fromEntityUid,
                        toEntityType, toEntityUid,
                        bidirectional: pickedType.bidirectional,
                      });
                      if (res.ok) {
                        const r = await api.listTrackerRelationships(tei);
                        setRows(Array.isArray(r) ? r : []);
                        resetCompose();
                      } else {
                        setSubmit('err');
                        setSubmitMsg(res.message);
                      }
                    }}
                    style={{ padding: '5px 13px', fontSize: 13 }}>
              {submit === 'submitting' ? 'Saving…'
                : pickedType
                  ? 'Add ' + directionalLabel(pickedType, flipped)
                  : 'Save relationship'}
            </button>
          </div>
        </div>
      )}

      {rows.length === 0 ? (
        <div className="cap-placeholder" data-test="tr-rel-empty">
          {status === 'err'
            ? 'Relationships could not be loaded.'
            : 'No linked tracked entities yet.'}
        </div>
      ) : (() => {
        // Build a display-row array once, with the typeLabel +
        // identity resolved up-front so filters can run over the
        // same materialised values the table renders. Keeps the
        // row-render tight and the filter cheap.
        const typeByUid = new Map(types.map((t) => [t.id, t]));
        const q = filterText.trim().toLowerCase();
        const display = rows.map((r, i) => {
          const toUid = endpointUid(r.to);
          const otherSide = toUid === tei ? r.from : r.to;
          const identity = endpointIdentity(otherSide);
          const kind: 'TRACKED_ENTITY' | 'ENROLLMENT' | 'EVENT' =
                otherSide?.event ? 'EVENT'
              : otherSide?.enrollment ? 'ENROLLMENT'
              : 'TRACKED_ENTITY';
          const meta = r.relationshipType
            ? typeByUid.get(r.relationshipType) : undefined;
          const typeLabel = meta
            ? (meta.fromToName ?? meta.toFromName
                ?? meta.displayName)
            : (r.relationshipName ?? r.relationshipType ?? '—');
          return { r, i, toUid, otherSide, identity, kind,
            typeLabel, typeUid: r.relationshipType ?? '',
            status: r.syncStatus ?? 'LOCAL' };
        });
        const filtered = display.filter((d) =>
          (filterType === '' || d.typeUid === filterType)
          && (filterStatus === '' || d.status === filterStatus)
          && (q === '' || d.typeLabel.toLowerCase().includes(q)
              || d.identity.primary.toLowerCase().includes(q)
              || (d.identity.secondary ?? '').toLowerCase()
                  .includes(q)));
        // Options for the type filter: pick types actually present
        // in rows so the dropdown doesn't list types the operator
        // can't action from here.
        const typeOptions = Array.from(new Set(
          display.map((d) => d.typeUid))).filter((u) => u !== '')
          .map((u) => ({
            uid: u,
            label: display.find((d) => d.typeUid === u)?.typeLabel
              ?? u,
          })).sort((a, b) => a.label.localeCompare(b.label));
        return (
          <div className="cap-rel-list" data-test="tr-rel-list">
            {/* Filter bar — type + sync status + text search.
             *  Flat flex row, collapses on narrow viewports. */}
            <div className="cap-rel-filterbar">
              <label className="cap-input cap-input--inline">
                <span className="cap-input__label">Type</span>
                <select className="cap-input__ctl"
                        data-test="tr-rel-filter-type"
                        value={filterType}
                        onChange={(e) => setFilterType(e.target.value)}>
                  <option value="">All types</option>
                  {typeOptions.map((t) => (
                    <option key={t.uid} value={t.uid}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="cap-input cap-input--inline">
                <span className="cap-input__label">Sync</span>
                <select className="cap-input__ctl"
                        data-test="tr-rel-filter-status"
                        value={filterStatus}
                        onChange={(e) =>
                          setFilterStatus(e.target.value)}>
                  <option value="">All states</option>
                  <option value="SYNCED">Synced to DHIS2</option>
                  <option value="PENDING">Pending sync</option>
                  <option value="LOCAL">Device only</option>
                  <option value="FAILED">Sync failed</option>
                  <option value="CONFLICT">Conflict — review</option>
                  <option value="BLOCKED">Blocked</option>
                </select>
              </label>
              <label className="cap-input cap-input--inline"
                     style={{ flex: 1 }}>
                <span className="cap-input__label">Search</span>
                <input type="search" className="cap-input__ctl"
                       data-test="tr-rel-filter-text"
                       value={filterText}
                       placeholder="Type label, target name, UID…"
                       onChange={(e) =>
                         setFilterText(e.target.value)} />
              </label>
              <span className="cap-sub"
                    style={{ alignSelf: 'end', paddingBottom: 6 }}>
                {filtered.length} of {display.length}
              </span>
            </div>
            {/* DER-standard borderless table — unified list,
             *  single row per link. Type · Target · Direction ·
             *  Sync · Captured · ⋯. */}
            <table className="cap-table cap-table--compact cap-rel-table"
                   data-test="tr-rel-table">
              <thead>
                <tr>
                  <th>Type</th>
                  <th>Target</th>
                  <th>Direction</th>
                  <th>Sync</th>
                  <th>Captured</th>
                  <th style={{ width: 40 }}></th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 && (
                  <tr>
                    <td className="cap-table__cell"
                        colSpan={6}
                        style={{ color: 'var(--der-text-muted)',
                          padding: '14px 12px' }}>
                      No links match the current filters.
                    </td>
                  </tr>
                )}
                {filtered.map(({ r, i, toUid, otherSide,
                  identity, kind, typeLabel }) => {
                  const uid = r.relationship;
                  const captured = formatTimestamp(
                    r.lastUpdated ?? r.createdAt ?? '');
                  // Resolve the click target the same way the
                  // RowMenu's Open action does — so a whole-row
                  // click behaves identically to the menu item.
                  const openTarget = (): void => {
                    if (kind === 'TRACKED_ENTITY') {
                      navTracker.detail(programUid, toUid ?? '');
                      return;
                    }
                    if (kind === 'ENROLLMENT') {
                      const t = otherSide?.enrollment?.teiUid;
                      if (t) navTracker.detail(programUid, t);
                      return;
                    }
                    const enrol =
                      otherSide?.event?.enrollmentUid;
                    if (enrol) {
                      navTracker.editEvent(programUid, enrol,
                        toUid ?? '');
                    }
                  };
                  return (
                    <tr key={(uid ?? '') + i}
                        className="cap-table__row"
                        tabIndex={0}
                        data-test={'tr-rel-row-' + (uid ?? i)}
                        onClick={(e) => {
                          // Don't swallow clicks on the menu/actions
                          // column — the ⋯ button has its own
                          // handler that must not double-trigger.
                          const t = e.target as HTMLElement;
                          if (t.closest('[data-rowmenu]')) return;
                          openTarget();
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            openTarget();
                          }
                        }}>
                      <td className="cap-table__cell">
                        <strong>{typeLabel}</strong>
                        {r.bidirectional && (
                          <span className="cap-sub"
                                style={{ marginLeft: 6,
                                  fontSize: 12 }}>
                            ↔
                          </span>
                        )}
                      </td>
                      <td className="cap-table__cell">
                        <div className="cap-rel-table__target">
                          <RelKindIcon kind={kind} />
                          <span className="cap-rel-table__name"
                                title={identity.secondary
                                  ?? identity.primary}>
                            {identity.primary}
                          </span>
                          {endpointSummaryFields(otherSide)
                              .map((f, idx) => (
                            <span key={idx}
                                  className="cap-rel-table__col"
                                  title={`${f.label}: ${f.value}`}>
                              <span className="cap-rel-table__col-label">
                                {f.label}
                              </span>
                              <span className="cap-rel-table__col-value">
                                {f.value}
                              </span>
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="cap-table__cell"
                          style={{ color: 'var(--der-text-muted)' }}>
                        {r.bidirectional
                          ? '↔ both ways' : '→ linked to'}
                      </td>
                      <td className="cap-table__cell">
                        <SyncBadge status={r.syncStatus ?? 'LOCAL'} />
                      </td>
                      <td className="cap-table__cell"
                          style={{ color: 'var(--der-text-muted)',
                            whiteSpace: 'nowrap' }}>
                        {captured}
                      </td>
                      <td className="cap-table__cell"
                          style={{ textAlign: 'right' }}>
                        {uid && (
                          <RowMenu uid={uid}
                                    targetUid={toUid ?? ''}
                                    targetKind={kind}
                                    targetSide={otherSide}
                                    programUid={programUid}
                                    teiUid={tei}
                                    customActions={typeByUid.get(
                                      r.relationshipType ?? '')
                                      ?.customActions ?? []}
                                    onUnlink={async () => {
                                      const ok = window.confirm(
                                        'Unlink this relationship?'
                                        + ' The link will be '
                                        + 'removed on the facility '
                                        + 'edge and queued for '
                                        + 'central sync.');
                                      if (!ok) return;
                                      const res = await api
                                        .deleteTrackerRelationship(uid);
                                      if (res.ok) {
                                        const fresh = await api
                                          .listTrackerRelationships(
                                            tei);
                                        setRows(
                                          Array.isArray(fresh)
                                            ? fresh : []);
                                      } else {
                                        window.alert(
                                          'Unlink failed: '
                                          + res.message);
                                      }
                                    }} />
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        );
      })()}
    </>
  );
}

/** Sync-state pill rendered next to each relationship row (REL-C-008).
 *  Reads the row's syncStatus from the edge response and colours a
 *  small pill so the operator sees at a glance whether a link is
 *  only on the device, drained, or in a failure state needing
 *  attention. Pure presentational; no interaction. */
function SyncBadge({ status }: { status: RelSyncStatus }): JSX.Element {
  const label = status === 'SYNCED'   ? 'Synced to DHIS2'
              : status === 'PENDING'  ? 'Pending sync'
              : status === 'LOCAL'    ? 'Device only'
              : status === 'FAILED'   ? 'Sync failed'
              : status === 'BLOCKED'  ? 'Blocked'
              : status === 'CONFLICT' ? 'Conflict — review'
              : status;
  const title =
      status === 'SYNCED' ? 'Central DHIS2 has accepted this link.'
    : status === 'PENDING' ? 'Queued for central sync — will post on '
        + 'the next drain pass.'
    : status === 'LOCAL' ? 'Saved only on this device — drain '
        + 'hasn’t picked it up yet.'
    : status === 'FAILED' ? 'Central rejected the sync — check the '
        + 'operations journal for details.'
    : status === 'BLOCKED' ? 'Metadata missing locally — cannot '
        + 'attempt sync.'
    : status === 'CONFLICT' ? 'Central version differs — review in '
        + 'the conflict queue.'
    : '';
  const cls = 'cap-rel-sync cap-rel-sync--' + status.toLowerCase();
  return (
    <span className={cls} data-test={'tr-rel-sync-' + status}
          title={title} style={{ marginLeft: 10 }}>
      {label}
    </span>
  );
}

/** Bucket rows by relationship type so the list renders grouped
 *  sections (REL-C-012). Label prefers the type's directional
 *  name from the mirror — falls back to displayName or the raw
 *  type UID if neither is known yet. Groups are ordered by the
 *  most recent row's createdAt (newest cluster first); rows
 *  within a group preserve the server's newest-first order. */
function groupRowsByType(
  rows: ReadonlyArray<RelRow>, types: ReadonlyArray<RelTypeRow>,
): Array<{ key: string; label: string; rows: RelRow[] }> {
  const byType = new Map<string, RelRow[]>();
  for (const r of rows) {
    const k = r.relationshipType ?? '_';
    const list = byType.get(k) ?? [];
    list.push(r);
    byType.set(k, list);
  }
  const typeByUid = new Map(types.map((t) => [t.id, t]));
  const out: Array<{ key: string; label: string;
    rows: RelRow[]; latest: string }> = [];
  for (const [k, list] of byType.entries()) {
    const meta = typeByUid.get(k);
    const label = meta
      ? (meta.fromToName ?? meta.toFromName ?? meta.displayName)
      : (list[0]?.relationshipName ?? k);
    const latest = list.map((r) =>
      r.lastUpdated ?? r.createdAt ?? '').sort().reverse()[0] ?? '';
    out.push({ key: k, label, rows: list, latest });
  }
  out.sort((a, b) => b.latest.localeCompare(a.latest));
  return out.map(({ key, label, rows: rs }) => ({ key, label,
    rows: rs }));
}

/** Split the endpoint into a two-line identity: a primary
 *  headline (what the operator thinks of the record as — a TEI
 *  name, "Enrolment in HIV Pro", "Appointment event · Nov 8") and
 *  an optional secondary line with status + dates. Falls back to
 *  the raw UID when no display enrichment is available. */
/** Up to 3 label/value pairs to render under the target name,
 *  pulled from the server-enriched payload (TEA values for TEIs,
 *  stage-DE values for events — all driven by DHIS2 metadata, not
 *  hardcoded). Empty array when the row couldn't be enriched or
 *  the endpoint is an enrolment (enrolment enrichment reuses the
 *  TEI's own summary under teiSummaryFields). */
function endpointSummaryFields(endpoint: RelRow['from']):
    ReadonlyArray<{ label: string; value: string }> {
  if (!endpoint) return [];
  if (endpoint.trackedEntity?.summaryFields) {
    return endpoint.trackedEntity.summaryFields;
  }
  if (endpoint.enrollment?.teiSummaryFields) {
    return endpoint.enrollment.teiSummaryFields;
  }
  if (endpoint.event?.summaryFields) {
    return endpoint.event.summaryFields;
  }
  return [];
}

function endpointIdentity(endpoint: RelRow['from']): {
  primary: string;
  secondary: string | null;
} {
  if (!endpoint) return { primary: '—', secondary: null };
  if (endpoint.trackedEntity) {
    const t = endpoint.trackedEntity;
    const name = t.displayName && t.displayName.trim() !== ''
      ? t.displayName : null;
    if (name) {
      return {
        primary: name,
        secondary: t.trackedEntity
          ? 'Tracked entity · ' + t.trackedEntity : null,
      };
    }
    return {
      primary: 'Tracked entity',
      secondary: t.trackedEntity ?? null,
    };
  }
  if (endpoint.enrollment?.enrollment) {
    const e = endpoint.enrollment;
    // Prefer the TEI's human name as the primary — operators
    // recognise the person first, the program second.
    const headline = e.teiDisplayName
      ? e.teiDisplayName
      : e.programName
      ? `Enrolment · ${e.programName}`
      : 'Enrolment';
    const parts: string[] = [];
    if (e.teiDisplayName && e.programName) {
      parts.push(`Enrolment · ${e.programName}`);
    }
    if (e.enrollmentDate) parts.push(formatDate(e.enrollmentDate));
    if (e.status) parts.push(e.status);
    return {
      primary: headline,
      secondary: parts.join(' · '),
    };
  }
  if (endpoint.event?.event) {
    const ev = endpoint.event;
    const headline = ev.programStageName
      ? `Event · ${ev.programStageName}`
      : ev.programName
      ? `Event · ${ev.programName}`
      : 'Event';
    const parts: string[] = [];
    if (ev.occurredDate) parts.push(formatDate(ev.occurredDate));
    if (ev.status) parts.push(ev.status);
    parts.push(ev.event);
    return {
      primary: headline,
      secondary: parts.join(' · '),
    };
  }
  return { primary: '—', secondary: null };
}

/** Icon-only visual cue for the target endpoint's kind — matches
 *  the modern-icon rail pattern (3b5beb1). 16px stroke SVG inside
 *  a soft tinted circle so the icon kind reads at a glance even
 *  when the operator is scanning a long list. */
function RelKindIcon(
  { kind }: { kind: 'TRACKED_ENTITY' | 'ENROLLMENT' | 'EVENT' },
): JSX.Element {
  const common = {
    width: 16, height: 16, viewBox: '0 0 24 24',
    fill: 'none', stroke: 'currentColor',
    strokeWidth: 1.75, strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true,
  };
  const path = kind === 'TRACKED_ENTITY' ? (
    <>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21c0-4.4 3.6-8 8-8s8 3.6 8 8" />
    </>
  ) : kind === 'ENROLLMENT' ? (
    <>
      <rect x="4" y="5" width="16" height="15" rx="2" />
      <path d="M8 3v4M16 3v4M4 10h16" />
    </>
  ) : (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </>
  );
  return (
    <span className={'cap-rel-card__icon cap-rel-card__icon--' + kind}
          title={kind === 'TRACKED_ENTITY' ? 'Tracked entity'
            : kind === 'ENROLLMENT' ? 'Enrolment' : 'Event'}>
      <svg {...common}>{path}</svg>
    </span>
  );
}

/** Row-level context menu — replaces the single Unlink button.
 *  Dropdown opens on click, closes on blur / click outside / Esc.
 *  Spec §REL-UX-010 + §REL-SEC-005 — Unlink is destructive and
 *  confirmed via a modal from the caller. Copy UID is a utility
 *  for admins troubleshooting with a database shell. */
function RowMenu(
  { uid, targetUid, targetKind, targetSide, programUid, teiUid,
    customActions, onUnlink }: {
    uid: string; targetUid: string;
    targetKind: 'TRACKED_ENTITY' | 'ENROLLMENT' | 'EVENT';
    targetSide: RelEndpoint | undefined;
    programUid: string;
    teiUid: string;
    customActions: ReadonlyArray<CustomAction>;
    onUnlink: () => Promise<void> | void;
  },
): JSX.Element {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent): void => {
      const el = e.target as HTMLElement | null;
      if (el && el.closest('[data-rowmenu="' + uid + '"]')) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('click', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('click', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [open, uid]);

  /** Navigate to the target record. Kind-specific routes:
   *  - TRACKED_ENTITY → tracker detail page
   *  - ENROLLMENT     → tracker detail page for the enrolment's TEI
   *  - EVENT          → stage-form edit page for the event */
  function openTarget(): void {
    setOpen(false);
    if (targetKind === 'TRACKED_ENTITY') {
      navTracker.detail(programUid, targetUid);
      return;
    }
    if (targetKind === 'ENROLLMENT') {
      const teiUid = targetSide?.enrollment?.teiUid;
      if (!teiUid) {
        window.alert('Linked record has no resolvable TEI on '
          + 'this device.');
        return;
      }
      navTracker.detail(programUid, teiUid);
      return;
    }
    // EVENT — jump to the edit page. We need the enrolment UID
    // from the endpoint detail; navTracker.editEvent needs
    // programUid + enrolmentUid + eventUid.
    const enrolUid = targetSide?.event?.enrollmentUid;
    if (!enrolUid) {
      window.alert('Linked event has no resolvable enrolment on '
        + 'this device.');
      return;
    }
    navTracker.editEvent(programUid, enrolUid, targetUid);
  }

  const openLabel = targetKind === 'TRACKED_ENTITY'
      ? 'Open tracked entity'
    : targetKind === 'ENROLLMENT' ? 'Open enrolment'
    : 'Open event';

  return (
    <div className="cap-rel-card__menu" data-rowmenu={uid}>
      <button type="button"
              className="cap-rel-card__menu-trigger"
              data-test={'tr-rel-menu-' + uid}
              aria-haspopup="menu"
              aria-expanded={open}
              title="Actions"
              onClick={() => setOpen((v) => !v)}>
        ⋯
      </button>
      {open && (
        <div className="cap-rel-card__menu-pop" role="menu">
          <button type="button" role="menuitem"
                  data-test={'tr-rel-menu-open-' + uid}
                  onClick={openTarget}>
            {openLabel}
          </button>
          <button type="button" role="menuitem"
                  data-test={'tr-rel-menu-copy-' + uid}
                  onClick={() => {
                    void navigator.clipboard?.writeText(targetUid);
                    setOpen(false);
                  }}>
            Copy target UID
          </button>
          <button type="button" role="menuitem"
                  data-test={'tr-rel-menu-copy-rel-' + uid}
                  onClick={() => {
                    void navigator.clipboard?.writeText(uid);
                    setOpen(false);
                  }}>
            Copy relationship UID
          </button>
          {customActions.length > 0 && (
            <div className="cap-rel-card__menu-sep"
                 role="separator" />
          )}
          {customActions.map((a, i) => (
            <button key={i} type="button" role="menuitem"
                    data-test={'tr-rel-menu-custom-' + i + '-' + uid}
                    className={a.destructive
                      ? 'cap-rel-card__menu-item--destructive'
                      : undefined}
                    onClick={() => {
                      setOpen(false);
                      const url = a.urlTemplate
                        .replaceAll('{targetUid}', targetUid)
                        .replaceAll('{relationshipUid}', uid)
                        .replaceAll('{teiUid}', teiUid);
                      const newTab = a.opensInNewTab !== false;
                      if (newTab) {
                        window.open(url, '_blank', 'noopener');
                      } else {
                        window.location.href = url;
                      }
                    }}>
              {a.label}
            </button>
          ))}
          <div className="cap-rel-card__menu-sep"
               role="separator" />
          <button type="button" role="menuitem"
                  className="cap-rel-card__menu-item--destructive"
                  data-test={'tr-rel-unlink-' + uid}
                  onClick={() => {
                    setOpen(false);
                    void onUnlink();
                  }}>
            Unlink
          </button>
        </div>
      )}
    </div>
  );
}

function formatTimestamp(iso: string): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString(undefined, {
    year: 'numeric', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function endpointUid(endpoint: RelRow['from']): string | null {
  if (!endpoint) return null;
  return endpoint.trackedEntity?.trackedEntity
    ?? endpoint.enrollment?.enrollment
    ?? endpoint.event?.event
    ?? null;
}

/** Human-friendly endpoint label.  The server enrichment provides
 *  programName / stage name / dates for ENROLLMENT and EVENT
 *  endpoints; fall back to the UID when a field is missing so the
 *  row never shows a bare "undefined". */
function describeEndpoint(endpoint: RelRow['from']): string {
  if (!endpoint) return '—';
  if (endpoint.trackedEntity) {
    const t = endpoint.trackedEntity;
    return t.displayName ? `${t.displayName} (${t.trackedEntity})`
      : (t.trackedEntity ?? 'tracked entity');
  }
  if (endpoint.enrollment?.enrollment) {
    const e = endpoint.enrollment;
    const parts: string[] = ['Enrolment'];
    if (e.programName) parts.push(e.programName);
    if (e.enrollmentDate) parts.push(formatDate(e.enrollmentDate));
    if (e.status) parts.push(e.status);
    return parts.join(' · ');
  }
  if (endpoint.event?.event) {
    const ev = endpoint.event;
    const parts: string[] = ['Event'];
    if (ev.programStageName) {
      parts.push(ev.programStageName);
    } else if (ev.programName) {
      parts.push(ev.programName);
    }
    if (ev.occurredDate) parts.push(formatDate(ev.occurredDate));
    if (ev.status) parts.push(ev.status);
    return parts.join(' · ');
  }
  return '—';
}

/** YYYY-MM-DD for today in the operator's local zone — HTML5
 *  date inputs expect this exact shape. */
function todayIsoDate(): string {
  const d = new Date();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mm}-${dd}`;
}

/** 11-char DHIS2 UID generator — duplicates the edgeApi helper
 *  so we can pass the UID into submitEvent and immediately use
 *  it to select the new event without parsing the server echo. */
function generateDhis2UidLocal(): string {
  const alpha = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
  const alphanum = alpha + '0123456789';
  let out = alpha[Math.floor(Math.random() * alpha.length)];
  for (let i = 0; i < 10; i++) {
    out += alphanum[Math.floor(Math.random() * alphanum.length)];
  }
  return out;
}

function formatDate(iso: string): string {
  const slice = iso.length >= 10 ? iso.slice(0, 10) : iso;
  const d = new Date(slice);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined,
    { year: 'numeric', month: 'short', day: 'numeric' });
}
