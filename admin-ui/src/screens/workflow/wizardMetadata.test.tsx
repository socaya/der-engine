import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as md from './wizardMetadata';
import type * as edgeApi from '../../api/edgeApi';

type FetchFn = typeof globalThis.fetch;

function stubFetch(handler: (path: string) =>
    { ok: boolean; body?: unknown; status?: number }): FetchFn {
  return vi.fn(async (input: RequestInfo | URL) => {
    const url = typeof input === 'string' ? input
      : input instanceof URL ? input.toString() : input.url;
    const r = handler(url);
    return new Response(JSON.stringify(r.body ?? {}),
      { status: r.status ?? (r.ok ? 200 : 500) });
  }) as unknown as FetchFn;
}

beforeEach(() => {
  (globalThis as unknown as { crypto: Crypto }).crypto ??=
    { randomUUID: () => '00000000-0000-0000-0000-000000000000' } as never;
  if (!globalThis.crypto.randomUUID) {
    (globalThis.crypto as unknown as { randomUUID: () => string })
      .randomUUID = () => '00000000-0000-0000-0000-000000000000';
  }
});

afterEach(() => vi.restoreAllMocks());

describe('wizardMetadata.listDataSets', () => {
  it('maps the DHIS2 payload to {id,displayName}', async () => {
    vi.spyOn(globalThis, 'fetch' as never).mockImplementation(stubFetch(() => ({
      ok: true, body: { dataSets: [
        { id: 'ds-1', displayName: 'Weekly report' },
        { id: 'ds-2', displayName: 'Monthly report' },
      ] },
    })) as never);
    const out = await md.listDataSets();
    expect(out).toEqual([
      { id: 'ds-1', displayName: 'Weekly report' },
      { id: 'ds-2', displayName: 'Monthly report' },
    ]);
  });
  it('returns [] when upstream omits dataSets', async () => {
    vi.spyOn(globalThis, 'fetch' as never).mockImplementation(stubFetch(() => ({
      ok: true, body: {},
    })) as never);
    expect(await md.listDataSets()).toEqual([]);
  });
});

describe('wizardMetadata.listPrograms', () => {
  it('filters EVENT (WITHOUT_REGISTRATION)', async () => {
    vi.spyOn(globalThis, 'fetch' as never).mockImplementation(stubFetch(() => ({
      ok: true, body: { programs: [
        { id: 'p-1', displayName: 'EV', programType: 'WITHOUT_REGISTRATION' },
        { id: 'p-2', displayName: 'TR', programType: 'WITH_REGISTRATION' },
      ] },
    })) as never);
    const out = await md.listPrograms('EVENT');
    expect(out).toEqual([{
      id: 'p-1', displayName: 'EV', programType: 'WITHOUT_REGISTRATION',
    }]);
  });
  it('filters TRACKER (WITH_REGISTRATION)', async () => {
    vi.spyOn(globalThis, 'fetch' as never).mockImplementation(stubFetch(() => ({
      ok: true, body: { programs: [
        { id: 'p-1', displayName: 'EV', programType: 'WITHOUT_REGISTRATION' },
        { id: 'p-2', displayName: 'TR', programType: 'WITH_REGISTRATION' },
      ] },
    })) as never);
    const out = await md.listPrograms('TRACKER');
    expect(out).toHaveLength(1);
    expect(out[0].id).toBe('p-2');
  });
});

describe('wizardMetadata.listDataSetSections', () => {
  it('returns one "Whole form" row when the DS has no sections', async () => {
    vi.spyOn(globalThis, 'fetch' as never).mockImplementation(stubFetch(() => ({
      ok: true, body: { id: 'ds-1', displayName: 'DS', sections: [] },
    })) as never);
    const out = await md.listDataSetSections('ds-1');
    expect(out).toEqual([{
      id: 'ds-1', displayName: 'Whole form', sectionKind: 'DATASET_SECTION',
    }]);
  });
  it('maps sections to DATASET_SECTION breakables', async () => {
    vi.spyOn(globalThis, 'fetch' as never).mockImplementation(stubFetch(() => ({
      ok: true, body: { sections: [
        { id: 's-1', displayName: 'Births' },
        { id: 's-2', displayName: 'Deaths' },
      ] },
    })) as never);
    const out = await md.listDataSetSections('ds-1');
    expect(out).toHaveLength(2);
    expect(out[0]).toMatchObject({
      id: 's-1', sectionKind: 'DATASET_SECTION',
    });
  });
});

describe('wizardMetadata.detectWorkflowType', () => {
  it('DATA_SET → AGGREGATE', async () => {
    vi.spyOn(globalThis, 'fetch' as never).mockImplementation(stubFetch(() => ({
      ok: true, body: { id: 'ds-1', displayName: 'DS' },
    })) as never);
    const r = await md.detectWorkflowType('DATA_SET', 'ds-1');
    expect(r.type).toBe('AGGREGATE');
    expect(r.metadata.id).toBe('ds-1');
  });
  it('PROGRAM WITHOUT_REGISTRATION → EVENT', async () => {
    vi.spyOn(globalThis, 'fetch' as never).mockImplementation(stubFetch(() => ({
      ok: true, body: { id: 'p-1', displayName: 'P',
                        programType: 'WITHOUT_REGISTRATION' },
    })) as never);
    const r = await md.detectWorkflowType('PROGRAM', 'p-1');
    expect(r.type).toBe('EVENT');
  });
  it('PROGRAM WITH_REGISTRATION → TRACKER', async () => {
    vi.spyOn(globalThis, 'fetch' as never).mockImplementation(stubFetch(() => ({
      ok: true, body: { id: 'p-1', displayName: 'P',
                        programType: 'WITH_REGISTRATION' },
    })) as never);
    const r = await md.detectWorkflowType('PROGRAM', 'p-1');
    expect(r.type).toBe('TRACKER');
  });
});

describe('wizardMetadata.listFieldCandidates', () => {
  it('DATASET_SECTION → calls /metadata/field-candidates', async () => {
    const fetch = stubFetch((url) => {
      expect(url).toContain('/edge-api/v1/metadata/field-candidates');
      expect(url).toContain('kind=DATASET_SECTION');
      return { ok: true, body: { fields: [
        { id: 'de-1', displayName: 'Age', compulsory: false },
      ] } };
    });
    vi.spyOn(globalThis, 'fetch' as never).mockImplementation(fetch as never);
    const out = await md.listFieldCandidates({
      id: 's-1', displayName: 'Section', sectionKind: 'DATASET_SECTION',
    });
    expect(out).toEqual([{ id: 'de-1', displayName: 'Age', compulsory: false }]);
  });
  it('returns [] when the endpoint rejects', async () => {
    vi.spyOn(globalThis, 'fetch' as never).mockImplementation(stubFetch(() => ({
      ok: false, body: {},
    })) as never);
    const out = await md.listFieldCandidates({
      id: 'x', displayName: 'y', sectionKind: 'DATASET_SECTION',
    });
    expect(out).toEqual([]);
  });
  it('ENROLLMENT_FORM → fetches programTrackedEntityAttributes', async () => {
    vi.spyOn(globalThis, 'fetch' as never).mockImplementation(stubFetch(() => ({
      ok: true, body: { programTrackedEntityAttributes: [
        { displayName: 'Given name', mandatory: true,
          trackedEntityAttribute: { id: 'tea-1' } },
        { displayName: 'Age', mandatory: false,
          trackedEntityAttribute: { id: 'tea-2' } },
      ] },
    })) as never);
    const out = await md.listFieldCandidates({
      id: 'p-1', displayName: 'Enrolment',
      sectionKind: 'ENROLLMENT_FORM',
    });
    expect(out).toHaveLength(2);
    expect(out[0]).toMatchObject({ id: 'tea-1', compulsory: true });
  });
});

describe('wizardMetadata.buildWorkflowPayload', () => {
  it('AGGREGATE → emits DATA_SET binding and linear chain', () => {
    const payload = md.buildWorkflowPayload({
      displayName: 'ANC',
      type: 'AGGREGATE',
      metadata: { id: 'ds-1', displayName: 'DS' },
      enabled: true, requiresApproval: false, defaultDeviceId: null,
      steps: [
        {
          breakable: { id: 's-1', displayName: 'A',
                        sectionKind: 'DATASET_SECTION' },
          ownerDeviceId: null, ownerRole: 'OPERATOR',
          fields: [{ fieldRef: 'de-1', requirement: 'REQUIRED' }],
        },
        {
          breakable: { id: 's-2', displayName: 'B',
                        sectionKind: 'DATASET_SECTION' },
          ownerDeviceId: null, ownerRole: 'OPERATOR',
          fields: [],
        },
      ],
    });
    expect(payload.boundMetadataKind).toBe('DATA_SET');
    expect(payload.boundMetadataId).toBe('ds-1');
    expect(payload.steps?.length).toBe(2);
    expect(payload.steps?.[0]?.ordinal).toBe(0);
    expect(payload.steps?.[0]?.fields).toEqual([
      { fieldRef: 'de-1', requirement: 'REQUIRED' }]);
    // Linear chain: step 2 depends on step 1.
    expect(payload.dependencies?.length).toBe(1);
    expect(payload.dependencies?.[0]).toMatchObject({
      kind: 'COMPLETES_BEFORE',
    });
  });

  it('EVENT/TRACKER → emits PROGRAM binding', () => {
    const payload = md.buildWorkflowPayload({
      displayName: 'X', type: 'TRACKER',
      metadata: { id: 'p-1', displayName: 'P' },
      steps: [],
    });
    expect(payload.boundMetadataKind).toBe('PROGRAM');
    expect(payload.enabled).toBe(true);
    expect(payload.requiresApproval).toBe(false);
    expect(payload.defaultDeviceId).toBe(null);
    expect(payload.dependencies).toEqual([]);
  });

  it('explicit dependencies win over linear chain', () => {
    const payload = md.buildWorkflowPayload({
      displayName: 'X', type: 'EVENT',
      metadata: { id: 'p-1', displayName: 'P' },
      steps: [
        { breakable: { id: 'b-A', displayName: 'A',
                        sectionKind: 'EVENT_INSTANCE' },
          ownerDeviceId: null, ownerRole: 'OPERATOR', fields: [] },
        { breakable: { id: 'b-B', displayName: 'B',
                        sectionKind: 'EVENT_INSTANCE' },
          ownerDeviceId: null, ownerRole: 'OPERATOR', fields: [] },
      ],
      explicitDependencies: [
        { fromBreakableId: 'b-A', toBreakableId: 'b-B',
          kind: 'COMPLETES_BEFORE' },
        // Self-dep + missing refs filtered out.
        { fromBreakableId: 'nope', toBreakableId: 'b-A',
          kind: 'COMPLETES_BEFORE' },
      ],
    });
    expect(payload.dependencies).toHaveLength(1);
  });
});

describe('wizardMetadata.isWizardCompatible / WIZARD_NATIVE_KINDS', () => {
  it('returns true for everything (wizard is universal now)', () => {
    expect(md.isWizardCompatible({
      workflowId: 'x', displayName: 'y',
      boundMetadataKind: 'DATA_SET', boundMetadataId: 'ds',
      enabled: true, version: 1,
      steps: [], dependencies: [],
    } as edgeApi.CaptureWorkflowSummary)).toBe(true);
  });
  it('exposes the native kind set', () => {
    expect(md.WIZARD_NATIVE_KINDS.has('DATASET_SECTION')).toBe(true);
    expect(md.WIZARD_NATIVE_KINDS.has('PROGRAM_STAGE')).toBe(true);
    expect(md.WIZARD_NATIVE_KINDS.has('PROGRAM_SECTION')).toBe(false);
  });
});
