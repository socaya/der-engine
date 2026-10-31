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
  /** For aggregate: DATASET_SECTION. For tracker/event: PROGRAM_STAGE. */
  sectionKind: 'DATASET_SECTION' | 'PROGRAM_STAGE' | 'EVENT_INSTANCE';
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

/** List DataSets by name. Used in Step 2 when type=AGGREGATE. */
export async function listDataSets(): Promise<MetadataOption[]> {
  const d = await dhisGet<DhisListResponse<MetadataOption>>(
    '/api/dataSets?fields=id,displayName&paging=false',
  );
  return ((d.dataSets as MetadataOption[] | undefined) ?? []).map((x) => ({
    id: x.id, displayName: x.displayName,
  }));
}

/** List Programs filtered by programType. */
export async function listPrograms(type: 'EVENT' | 'TRACKER'): Promise<MetadataOption[]> {
  const filter = type === 'EVENT'
    ? 'programType:eq:WITHOUT_REGISTRATION'
    : 'programType:eq:WITH_REGISTRATION';
  const d = await dhisGet<DhisListResponse<MetadataOption>>(
    `/api/programs?fields=id,displayName,programType&filter=${filter}&paging=false`,
  );
  return ((d.programs as MetadataOption[] | undefined) ?? []).map((x) => ({
    id: x.id, displayName: x.displayName, programType: x.programType,
  }));
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

/** For a chosen Program, list its stages (one breakable unit per stage). */
export async function listProgramStages(programId: string): Promise<Breakable[]> {
  const d = await dhisGet<DhisListResponse<{ id: string; displayName: string }>>(
    `/api/programStages?filter=program.id:eq:${programId}`
    + '&fields=id,displayName&paging=false',
  );
  const rows = (d.programStages as { id: string; displayName: string }[] | undefined) ?? [];
  return rows.map((s) => ({
    id: s.id, displayName: s.displayName, sectionKind: 'PROGRAM_STAGE',
  }));
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
  steps: {
    breakable: Breakable;
    ownerDeviceId: string | null;
    ownerRole: 'OPERATOR' | 'REVIEWER' | 'ADMIN';
    /** Per-step field selection. Empty → "capture everything in the
     *  section/stage" (server treats fields=[] as unscoped). */
    fields?: { fieldRef: string;
                 requirement: 'REQUIRED' | 'OPTIONAL' | 'READONLY' | 'HIDDEN' }[];
  }[];
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
  // Linear dependency chain — each step depends on the previous one.
  const dependencies: edgeApi.CaptureWorkflowDependency[] = [];
  for (let i = 1; i < stepsPayload.length; i++) {
    dependencies.push({
      stepId: stepsPayload[i].stepId!,
      dependsOnStepId: stepsPayload[i - 1].stepId!,
      kind: 'COMPLETES_BEFORE',
    });
  }
  return {
    workflowId: opts.workflowId,
    displayName: opts.displayName,
    boundMetadataKind,
    boundMetadataId: opts.metadata.id,
    enabled: true,
    steps: stepsPayload,
    dependencies,
  };
}

/** Decides whether the wizard can round-trip an existing workflow or
 *  whether the operator needs the technical designer. */
export function isWizardCompatible(w: edgeApi.CaptureWorkflowSummary): boolean {
  if (w.steps.length === 0) {
    return true;
  }
  const allowed: ReadonlySet<string> = new Set([
    'DATASET_SECTION', 'PROGRAM_STAGE', 'EVENT_INSTANCE',
  ]);
  return w.steps.every((s) => allowed.has(s.sectionKind ?? ''));
}
