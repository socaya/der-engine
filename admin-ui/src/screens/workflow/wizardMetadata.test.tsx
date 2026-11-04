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

  it('PROGRAM_SECTION → intersects programTeaFields with section-declared TEAs', async () => {
    vi.spyOn(globalThis, 'fetch' as never).mockImplementation(stubFetch((url) => {
      if (url.includes('/api/programSections/')) {
        return { ok: true, body: {
          trackedEntityAttributes: [{ id: 'tea-2' }, { id: 'tea-1' }],
        } };
      }
      /* programTeaFields (via /api/programs/<pid>). */
      return { ok: true, body: { programTrackedEntityAttributes: [
        { displayName: 'Given name', mandatory: true,
          trackedEntityAttribute: { id: 'tea-1' } },
        { displayName: 'Age', mandatory: false,
          trackedEntityAttribute: { id: 'tea-2' } },
        { displayName: 'Extra', mandatory: false,
          trackedEntityAttribute: { id: 'tea-extra' } },
      ] } };
    }) as never);
    const out = await md.listFieldCandidates({
      id: 'section-1', displayName: 'Demo Section',
      sectionKind: 'PROGRAM_SECTION',
      parentId: 'p-1',
    } as never);
    /* Section declares [tea-2, tea-1] → that order; extras from the
     * program (tea-extra) are NOT in the section, so filtered out. */
    expect(out.map((f) => f.id)).toEqual(['tea-2', 'tea-1']);
  });

  it('PROGRAM_SECTION → programSection fetch rejection falls back to all programTeaFields', async () => {
    vi.spyOn(globalThis, 'fetch' as never).mockImplementation(stubFetch((url) => {
      if (url.includes('/api/programSections/')) {
        return { ok: false, body: {} };
      }
      return { ok: true, body: { programTrackedEntityAttributes: [
        { displayName: 'Given name', mandatory: true,
          trackedEntityAttribute: { id: 'tea-1' } },
      ] } };
    }) as never);
    const out = await md.listFieldCandidates({
      id: 'section-1', displayName: 'Demo Section',
      sectionKind: 'PROGRAM_SECTION',
      parentId: 'p-1',
    } as never);
    expect(out.map((f) => f.id)).toEqual(['tea-1']);
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

/* ──────────────────────────────────────────────────────────────
 * Depth-lift: listProgramStages + fetchEnrolmentBreakables +
 * listSectionsForStages. Previously uncovered (lines 188-323).
 * All three hang off md.listProgramStages which fans out across
 * four /api endpoints with branching per response. Each test
 * stubs fetch with a per-path matcher so a single call drives
 * the specific branch under test.
 * ────────────────────────────────────────────────────────────── */

describe('wizardMetadata.listProgramStages', () => {
  it('event program (WITHOUT_REGISTRATION) returns stages without an enrolment row', async () => {
    vi.spyOn(globalThis, 'fetch' as never).mockImplementation(stubFetch((p) => {
      if (p.startsWith('/api/programStages')) {
        return { ok: true, body: { programStages: [
          { id: 'st-1', displayName: 'Visit 1', program: { id: 'p-ev' }, repeatable: false },
          { id: 'st-x', displayName: 'Other',   program: { id: 'other-prog' } },
        ] } };
      }
      if (p.startsWith('/api/programStageSections')) {
        return { ok: true, body: { programStageSections: [] } };
      }
      if (p.startsWith('/api/programs/')) {
        return { ok: true, body: { id: 'p-ev', programType: 'WITHOUT_REGISTRATION' } };
      }
      return { ok: false, status: 404 };
    }) as never);
    const out = await md.listProgramStages('p-ev');
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({
      id: 'st-1', displayName: 'Visit 1', sectionKind: 'PROGRAM_STAGE',
    });
  });

  it('tracker program prepends an Enrolment row before each stage', async () => {
    vi.spyOn(globalThis, 'fetch' as never).mockImplementation(stubFetch((p) => {
      if (p.startsWith('/api/programStages')) {
        return { ok: true, body: { programStages: [
          { id: 'st-1', displayName: 'ANC-1', program: { id: 'p-tr' }, repeatable: true },
        ] } };
      }
      if (p.startsWith('/api/programStageSections')) {
        return { ok: true, body: { programStageSections: [] } };
      }
      if (p === '/api/programs/p-tr') {
        return { ok: true, body: {
          id: 'p-tr', programType: 'WITH_REGISTRATION',
          programSections: [{ id: 'ps-demo' }, { id: 'ps-outcome' }],
        } };
      }
      if (p.startsWith('/api/programSections')) {
        return { ok: true, body: { programSections: [
          { id: 'ps-demo',    displayName: 'Demographics',
            program: { id: 'p-tr' }, sortOrder: 1 },
          { id: 'ps-outcome', displayName: 'Outcome',
            program: { id: 'p-tr' }, sortOrder: 2 },
          { id: 'ps-foreign', displayName: 'Foreign',
            program: { id: 'other-prog' }, sortOrder: 1 },
        ] } };
      }
      return { ok: false, status: 404 };
    }) as never);
    const out = await md.listProgramStages('p-tr');
    /* Enrolment + 2 program-sections, then the single stage. */
    expect(out.map((b) => b.sectionKind)).toEqual([
      'ENROLLMENT_FORM', 'PROGRAM_SECTION', 'PROGRAM_SECTION', 'PROGRAM_STAGE',
    ]);
    expect(out[0].displayName).toBe('Enrolment');
    expect(out[1].displayName).toBe('Demographics');
    expect(out[2].displayName).toBe('Outcome');
    /* Stage inherits repeatable=true from its payload. */
    const stageRow = out[3] as { repeatable?: boolean };
    expect(stageRow.repeatable).toBe(true);
  });

  it('tracker program with no programSections returns Enrolment + stages only', async () => {
    vi.spyOn(globalThis, 'fetch' as never).mockImplementation(stubFetch((p) => {
      if (p.startsWith('/api/programStages')) {
        return { ok: true, body: { programStages: [
          { id: 'st-1', displayName: 'Visit', program: { id: 'p-tr' } },
        ] } };
      }
      if (p.startsWith('/api/programStageSections')) {
        return { ok: true, body: { programStageSections: [] } };
      }
      if (p.startsWith('/api/programs/')) {
        return { ok: true, body: {
          id: 'p-tr', programType: 'WITH_REGISTRATION',
          programSections: [],
        } };
      }
      return { ok: false, status: 404 };
    }) as never);
    const out = await md.listProgramStages('p-tr');
    expect(out.map((b) => b.sectionKind)).toEqual(
      ['ENROLLMENT_FORM', 'PROGRAM_STAGE']);
  });

  it('tracker program swallows a programSections fetch failure and returns stages only', async () => {
    vi.spyOn(globalThis, 'fetch' as never).mockImplementation(stubFetch((p) => {
      if (p.startsWith('/api/programStages')) {
        return { ok: true, body: { programStages: [
          { id: 'st-1', displayName: 'Visit', program: { id: 'p-tr' } },
        ] } };
      }
      if (p.startsWith('/api/programStageSections')) {
        return { ok: true, body: { programStageSections: [] } };
      }
      if (p.startsWith('/api/programs/')) {
        return { ok: true, body: {
          id: 'p-tr', programType: 'WITH_REGISTRATION',
          programSections: [{ id: 'ps-x' }],
        } };
      }
      if (p.startsWith('/api/programSections')) {
        /* 500 → wizardMetadata catches the dhisGet reject + sets
         * rows=[], so no PROGRAM_SECTION rows appear. The
         * Enrolment row stays because it's emitted before the
         * section fetch. */
        return { ok: false, status: 500 };
      }
      return { ok: false, status: 404 };
    }) as never);
    const out = await md.listProgramStages('p-tr');
    expect(out.map((b) => b.sectionKind)).toEqual(
      ['ENROLLMENT_FORM', 'PROGRAM_STAGE']);
  });

  it('includes PROGRAM_STAGE_SECTION children indented under their stage', async () => {
    vi.spyOn(globalThis, 'fetch' as never).mockImplementation(stubFetch((p) => {
      if (p.startsWith('/api/programStages')) {
        return { ok: true, body: { programStages: [
          { id: 'st-1', displayName: 'Visit', program: { id: 'p-ev' }, repeatable: false },
        ] } };
      }
      if (p.startsWith('/api/programStageSections')) {
        return { ok: true, body: { programStageSections: [
          { id: 'sec-a', displayName: 'Vitals',
            programStage: { id: 'st-1' } },
          { id: 'sec-foreign', displayName: 'Foreign',
            programStage: { id: 'st-other' } },
        ] } };
      }
      if (p.startsWith('/api/programs/')) {
        return { ok: true, body: { id: 'p-ev', programType: 'WITHOUT_REGISTRATION' } };
      }
      return { ok: false, status: 404 };
    }) as never);
    const out = await md.listProgramStages('p-ev');
    expect(out).toHaveLength(2);
    expect(out[0]).toMatchObject({ id: 'st-1', sectionKind: 'PROGRAM_STAGE' });
    expect(out[1]).toMatchObject({
      id: 'sec-a', sectionKind: 'PROGRAM_STAGE_SECTION', parentId: 'st-1',
    });
  });

  it('tolerates a 500 on the enrolment-program fetch — treats program as event-shaped', async () => {
    vi.spyOn(globalThis, 'fetch' as never).mockImplementation(stubFetch((p) => {
      if (p.startsWith('/api/programStages')) {
        return { ok: true, body: { programStages: [
          { id: 'st-1', displayName: 'Visit', program: { id: 'p-ev' } },
        ] } };
      }
      if (p.startsWith('/api/programStageSections')) {
        return { ok: true, body: { programStageSections: [] } };
      }
      if (p.startsWith('/api/programs/')) {
        /* fetchEnrolmentBreakables swallows the throw and returns
         * []. No ENROLLMENT_FORM row prepended. */
        return { ok: false, status: 500 };
      }
      return { ok: false, status: 404 };
    }) as never);
    const out = await md.listProgramStages('p-ev');
    expect(out.map((b) => b.sectionKind)).toEqual(['PROGRAM_STAGE']);
  });

  it('returns [] when the stages endpoint returns no payload', async () => {
    vi.spyOn(globalThis, 'fetch' as never).mockImplementation(stubFetch((p) => {
      if (p.startsWith('/api/programStages')) return { ok: true, body: {} };
      if (p.startsWith('/api/programStageSections')) return { ok: true, body: {} };
      if (p.startsWith('/api/programs/')) {
        return { ok: true, body: { id: 'p-ev', programType: 'WITHOUT_REGISTRATION' } };
      }
      return { ok: false, status: 404 };
    }) as never);
    expect(await md.listProgramStages('p-ev')).toEqual([]);
  });

  it('listSectionsForStages tolerates a stages-sections fetch rejection', async () => {
    /* Covers the dhisGet failure branch inside
     * listSectionsForStages — if the fetch rejects the function
     * sets rows=[] and the main loop simply emits no child
     * sections. The stage row still renders. */
    vi.spyOn(globalThis, 'fetch' as never).mockImplementation(stubFetch((p) => {
      if (p.startsWith('/api/programStages')) {
        return { ok: true, body: { programStages: [
          { id: 'st-1', displayName: 'Visit', program: { id: 'p-ev' } },
        ] } };
      }
      if (p.startsWith('/api/programStageSections')) {
        return { ok: false, status: 500 };
      }
      if (p.startsWith('/api/programs/')) {
        return { ok: true, body: { id: 'p-ev', programType: 'WITHOUT_REGISTRATION' } };
      }
      return { ok: false, status: 404 };
    }) as never);
    const out = await md.listProgramStages('p-ev');
    expect(out).toHaveLength(1);
    expect(out[0].sectionKind).toBe('PROGRAM_STAGE');
  });
});

describe('wizardMetadata.dhisGet error path', () => {
  it('rejecting fetch (!r.ok) propagates a readable Error', async () => {
    vi.spyOn(globalThis, 'fetch' as never).mockImplementation(stubFetch(() => ({
      ok: false, status: 403, body: { message: 'forbidden' },
    })) as never);
    /* listDataSets uses dhisGet; a 403 should bubble as a thrown
     * Error naming the path + status. */
    await expect(md.listDataSets()).rejects.toThrow(/failed: 403/);
  });
});
