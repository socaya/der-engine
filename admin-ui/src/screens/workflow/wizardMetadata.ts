import * as edgeApi from '../../api/edgeApi';

export type WizardWorkflowType = 'AGGREGATE' | 'EVENT' | 'TRACKER';

export interface MetadataOption {
  id: string;
  displayName: string;
  /** Only populated for programs — distinguishes event vs tracker. */
  programType?: 'WITH_REGISTRATION' | 'WITHOUT_REGISTRATION';
}

export interface Breakable {
  id: string;
  displayName: string;
  /** Aggregate: DATASET_SECTION. Event: EVENT_INSTANCE. Tracker:
   *  PROGRAM_STAGE (whole stage) or PROGRAM_STAGE_SECTION (one of
   *  the stage's inner sections). */
  sectionKind: 'DATASET_SECTION' | 'PROGRAM_STAGE'
             | 'PROGRAM_STAGE_SECTION' | 'EVENT_INSTANCE';
  /** For PROGRAM_STAGE_SECTION: the parent stage's breakable id,
   *  so the wizard can render sections nested under their stage. */
  parentId?: string;
  /** DHIS2 program stage flag: can the stage be filled multiple times
   *  per enrollment? Surfaced for PROGRAM_STAGE / child stage sections
   *  so operators can see which steps repeat (e.g. visit vs enrolment). */
  repeatable?: boolean;
}

/** One data element / attribute offered inside a breakable step. */
export interface FieldCandidate {
  id: string;
  displayName: string;
  /** Flagged compulsory upstream — pre-tick + preselect REQUIRED. */
  compulsory: boolean;
}

export async function listFieldCandidates(breakable: Breakable): Promise<FieldCandidate[]> {
  const r = await fetch(
    `/edge-api/v1/metadata/field-candidates`
      + `?kind=${encodeURIComponent(breakable.sectionKind)}`
      + `&ref=${encodeURIComponent(breakable.id)}`,
    { credentials: 'include', headers: { Accept: 'application/json' } },
  );
  if (!r.ok) {
    return [];
  }
  const body = (await r.json()) as { fields?: FieldCandidate[] };
  return body.fields ?? [];
}

interface DhisListResponse<T> {
  pager?: unknown;
  [key: string]: unknown | T[];
}

async function dhisGet<T>(path: string): Promise<T> {
  const r = await fetch(path, {
    credentials: 'include',
    headers: { Accept: 'application/json' },
  });
  if (!r.ok) {
    throw new Error(`metadata fetch ${path} failed: ${r.status}`);
  }
  return (await r.json()) as T;
}

/** List DataSets by name. */
export async function listDataSets(): Promise<MetadataOption[]> {
  const d = await dhisGet<DhisListResponse<MetadataOption>>(
    '/api/dataSets?pageSize=500',
  );
  return ((d.dataSets as MetadataOption[] | undefined) ?? []).map((x) => ({
    id: x.id, displayName: x.displayName,
  }));
}

/** List Programs filtered by programType. The DER mirror's /api/programs
 *  endpoint ignores DHIS2's `filter=` parameter, so we fetch all programs
 *  (with a large pageSize) and filter client-side by programType. */
export async function listPrograms(type: 'EVENT' | 'TRACKER'): Promise<MetadataOption[]> {
  const wanted = type === 'EVENT' ? 'WITHOUT_REGISTRATION' : 'WITH_REGISTRATION';
  const d = await dhisGet<DhisListResponse<MetadataOption>>(
    '/api/programs?fields=id,displayName,programType&pageSize=500',
  );
  const all = (d.programs as MetadataOption[] | undefined) ?? [];
  return all
    .filter((x) => x.programType === wanted)
    .map((x) => ({ id: x.id, displayName: x.displayName, programType: x.programType }));
}

/** For a chosen DataSet, list its sections (breakable units). */
export async function listDataSetSections(dataSetId: string): Promise<Breakable[]> {
  const d = await dhisGet<{ sections?: { id: string; displayName: string }[] }>(
    `/api/dataSets/${dataSetId}?fields=id,displayName,sections%5Bid,displayName%5D`,
  );
  const sections = d.sections ?? [];
  if (sections.length === 0) {
    // DataSet with no sections → treat the whole form as one breakable.
    return [{ id: dataSetId, displayName: 'Whole form',
               sectionKind: 'DATASET_SECTION' }];
  }
  return sections.map((s) => ({
    id: s.id, displayName: s.displayName, sectionKind: 'DATASET_SECTION',
  }));
}

/** For a chosen Program, list its stages (one breakable unit per
 *  stage). Each stage that itself has program-stage-sections gets a
 *  matching list of nested PROGRAM_STAGE_SECTION breakables appended
 *  after it, with `parentId` pointing at the stage. The wizard
 *  renders those indented and the operator may pick either the whole
 *  stage or specific sections. */
export async function listProgramStages(programId: string): Promise<Breakable[]> {
  // The DER mirror's /api/programStages controller ignores DHIS2's
  // `filter=` parameter, so we page through all stages and keep only
  // those whose payload.program.id matches. Mirror payload includes
  // the full stage body (including the parent program ref).
  const stagesResp = await dhisGet<DhisListResponse<{
    id: string; displayName: string;
    program?: { id: string };
    repeatable?: boolean;
  }>>('/api/programStages?pageSize=500');
  type S = {
    id: string; displayName: string;
    program?: { id: string };
    repeatable?: boolean;
  };
  const allStages: S[] = (stagesResp.programStages as S[] | undefined) ?? [];
  const stages: S[] = allStages.filter((s) => s.program?.id === programId);
  const stageIds = new Set(stages.map((s) => s.id));
  const sectionsByStage = await listSectionsForStages(stageIds);
  const repeatableByStage = new Map<string, boolean>();
  for (const s of stages) repeatableByStage.set(s.id, s.repeatable === true);
  const out: Breakable[] = [];
  for (const s of stages) {
    out.push({ id: s.id, displayName: s.displayName,
                sectionKind: 'PROGRAM_STAGE',
                repeatable: s.repeatable === true });
    const children = sectionsByStage.get(s.id) ?? [];
    for (const sec of children) {
      out.push({ ...sec, parentId: s.id,
                  repeatable: repeatableByStage.get(s.id) ?? false });
    }
  }
  return out;
}

async function listSectionsForStages(
    stageIds: Set<string>): Promise<Map<string, Breakable[]>> {
  if (stageIds.size === 0) {
    return new Map();
  }
  // DER mirror ignores DHIS2 fields=/filter=/paging=, so page in bulk
  // (pageSize=500) and filter client-side by payload.programStage.id.
  let rows: { id: string; displayName: string;
               programStage?: { id: string } }[] = [];
  try {
    const d = await dhisGet<DhisListResponse<{
      id: string; displayName: string; programStage?: { id: string };
    }>>('/api/programStageSections?pageSize=500');
    rows = (d.programStageSections as typeof rows | undefined) ?? [];
  } catch {
    rows = [];
  }
  const out = new Map<string, Breakable[]>();
  for (const s of rows) {
    const stageId = s.programStage?.id;
    if (!stageId || !stageIds.has(stageId)) {
      continue;
    }
    const list = out.get(stageId) ?? [];
    list.push({ id: s.id, displayName: s.displayName,
                 sectionKind: 'PROGRAM_STAGE_SECTION' });
    out.set(stageId, list);
  }
  return out;
}

/** Fetch display name for a single DataSet or Program by UID. Used
 *  when loading an existing workflow back into the wizard — the
 *  workflow stores just `boundMetadataId`. */
export async function fetchMetadataName(
    kind: 'DATA_SET' | 'PROGRAM', id: string): Promise<MetadataOption> {
  const path = kind === 'DATA_SET'
    ? `/api/dataSets/${id}?fields=id,displayName`
    : `/api/programs/${id}?fields=id,displayName,programType`;
  const d = await dhisGet<MetadataOption>(path);
  return {
    id: d.id, displayName: d.displayName, programType: d.programType,
  };
}

/** Reverse-map an existing workflow's binding to a wizard type.
 *  Needs an extra fetch when the binding is PROGRAM to tell event
 *  vs tracker apart. */
export async function detectWorkflowType(
    boundMetadataKind: string, boundMetadataId: string,
): Promise<{ type: WizardWorkflowType; metadata: MetadataOption }> {
  if (boundMetadataKind === 'DATA_SET') {
    const m = await fetchMetadataName('DATA_SET', boundMetadataId);
    return { type: 'AGGREGATE', metadata: m };
  }
  const m = await fetchMetadataName('PROGRAM', boundMetadataId);
  return {
    type: m.programType === 'WITHOUT_REGISTRATION' ? 'EVENT' : 'TRACKER',
    metadata: m,
  };
}

/** Payload builder — turns wizard state into saveWorkflow input.
 *  Pass `workflowId` to produce an update (PUT) payload; omit for
 *  create (POST). */
export function buildWorkflowPayload(opts: {
  workflowId?: string;
  displayName: string;
  type: WizardWorkflowType;
  metadata: MetadataOption;
  /** Workflow-level toggles (§2.3.27 — exposed to the wizard). */
  enabled?: boolean;
  requiresApproval?: boolean;
  defaultDeviceId?: string | null;
  steps: {
    breakable: Breakable;
    ownerDeviceId: string | null;
    ownerRole: 'OPERATOR' | 'REVIEWER' | 'ADMIN';
    /** Per-step field selection. Empty → "capture everything in the
     *  section/stage" (server treats fields=[] as unscoped). */
    fields?: { fieldRef: string;
                 requirement: 'REQUIRED' | 'OPTIONAL' | 'READONLY' | 'HIDDEN' }[];
  }[];
  /** Explicit dependencies, keyed by breakable id. Omit to fall back
   *  to the historical linear chain built from step order. */
  explicitDependencies?: { fromBreakableId: string;
                            toBreakableId: string;
                            kind: 'COMPLETES_BEFORE' }[];
}): Parameters<typeof edgeApi.saveWorkflow>[0] {
  const boundMetadataKind = opts.type === 'AGGREGATE' ? 'DATA_SET' : 'PROGRAM';
  const stepsPayload: edgeApi.CaptureWorkflowStep[] = opts.steps.map((s, ix) => ({
    stepId: crypto.randomUUID(),
    ordinal: ix,
    displayName: s.breakable.displayName,
    ownerRole: s.ownerRole,
    ownerDeviceId: s.ownerDeviceId,
    stepKind: 'CAPTURE',
    sectionKind: s.breakable.sectionKind,
    sectionRef: s.breakable.id,
    fields: s.fields ?? [],
  }));
  // Resolve each step's breakable id to its freshly-minted stepId.
  const stepIdByBreakable = new Map<string, string>();
  opts.steps.forEach((s, ix) => {
    stepIdByBreakable.set(s.breakable.id, stepsPayload[ix].stepId!);
  });
  let dependencies: edgeApi.CaptureWorkflowDependency[];
  if (opts.explicitDependencies && opts.explicitDependencies.length > 0) {
    dependencies = opts.explicitDependencies
      .map((d) => {
        const from = stepIdByBreakable.get(d.fromBreakableId);
        const to = stepIdByBreakable.get(d.toBreakableId);
        if (!from || !to || from === to) return null;
        return { stepId: to, dependsOnStepId: from, kind: d.kind };
      })
      .filter((d): d is edgeApi.CaptureWorkflowDependency => d != null);
  } else {
    // Linear chain fallback — each step depends on the previous one.
    dependencies = [];
    for (let i = 1; i < stepsPayload.length; i++) {
      dependencies.push({
        stepId: stepsPayload[i].stepId!,
        dependsOnStepId: stepsPayload[i - 1].stepId!,
        kind: 'COMPLETES_BEFORE',
      });
    }
  }
  return {
    workflowId: opts.workflowId,
    displayName: opts.displayName,
    boundMetadataKind,
    boundMetadataId: opts.metadata.id,
    enabled: opts.enabled ?? true,
    requiresApproval: opts.requiresApproval ?? false,
    defaultDeviceId: opts.defaultDeviceId ?? null,
    steps: stepsPayload,
    dependencies,
  };
}

/** Section kinds the wizard offers natively on step 3. Other kinds
 *  still open — they appear as read-only "custom step" rows the
 *  operator can enable/disable and reassign, but can't change the
 *  section binding of. */
export const WIZARD_NATIVE_KINDS: ReadonlySet<string> = new Set([
  'DATASET_SECTION', 'PROGRAM_STAGE', 'PROGRAM_STAGE_SECTION',
  'EVENT_INSTANCE',
]);

/** §2.3.27 — the wizard now opens any workflow; non-native section
 *  kinds render as advanced-badge rows that the operator can still
 *  enable/reassign/field-pick inside the wizard. Returning true
 *  everywhere lets edits land through the guided editor without the
 *  "advanced options" hard-stop that pilots were hitting. */
export function isWizardCompatible(w: edgeApi.CaptureWorkflowSummary): boolean {
  // Suppress the lint warning while keeping a public hook for a
  // future "detect truly unmodellable workflow" check if needed.
  void w;
  return true;
}
