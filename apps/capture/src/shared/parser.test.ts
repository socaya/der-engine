import { describe, it, expect } from 'vitest';
import {
  parseProgram, parseStageForm, parseTeiAttributesForm,
  computeFingerprint,
  type RawProgram, type RawStage, type RawStageForm, type RawTeiAttribute,
} from './parser';

/**
 * Unit tests for the Capture metadata parser (G2 slice,
 * requirements doc §6.2, MD-001..MD-007). Every parser branch
 * must be exercised so the UI never consumes a half-parsed shape.
 */

describe('parseProgram', () => {
  it('normalizes a WITHOUT_REGISTRATION event program', () => {
    const raw: RawProgram = {
      id: 'P1',
      displayName: 'Standalone events',
      programType: 'WITHOUT_REGISTRATION',
      organisationUnits: [{ id: 'OU1' }, { id: 'OU2' }],
    };
    const p = parseProgram(raw, []);
    expect(p.id).toBe('P1');
    expect(p.displayName).toBe('Standalone events');
    expect(p.programType).toBe('WITHOUT_REGISTRATION');
    expect(p.trackedEntityTypeId).toBeNull();
    expect(p.orgUnitIds).toEqual(['OU1', 'OU2']);
    expect(p.stages).toEqual([]);
    expect(p.metadataFingerprint).toMatch(/^[0-9a-f]{8}$/);
  });

  it('attaches stages in server order with explicit sort orders', () => {
    const stages: RawStage[] = [
      { stageUid: 'S2', displayName: 'Second',
        sortOrder: 2, repeatable: true },
      { stageUid: 'S1', displayName: 'First',
        sortOrder: 1, repeatable: false },
    ];
    const p = parseProgram({ id: 'P1' }, stages);
    // §MD-003 — preserve server order verbatim.
    expect(p.stages.map((s) => s.id)).toEqual(['S2', 'S1']);
    expect(p.stages[0]!.repeatable).toBe(true);
    expect(p.stages[1]!.repeatable).toBe(false);
  });

  it('falls back to name then id when displayName is missing', () => {
    expect(parseProgram({ id: 'P1', name: 'Only name' }, [])
      .displayName).toBe('Only name');
    expect(parseProgram({ id: 'P1' }, []).displayName).toBe('P1');
  });

  it('treats any non-WITH_REGISTRATION string as WITHOUT_REGISTRATION', () => {
    expect(parseProgram({ id: 'P1', programType: 'SOMETHING' }, [])
      .programType).toBe('WITHOUT_REGISTRATION');
    expect(parseProgram({ id: 'P1' }, []).programType)
      .toBe('WITHOUT_REGISTRATION');
    expect(parseProgram({ id: 'P1', programType: 'WITH_REGISTRATION' }, [])
      .programType).toBe('WITH_REGISTRATION');
  });

  it('captures the tracked entity type id when present', () => {
    expect(parseProgram({ id: 'P1',
      trackedEntityType: { id: 'TET1' } }, []).trackedEntityTypeId)
      .toBe('TET1');
    expect(parseProgram({ id: 'P1',
      trackedEntityType: {} }, []).trackedEntityTypeId).toBeNull();
    expect(parseProgram({ id: 'P1',
      trackedEntityType: null }, []).trackedEntityTypeId).toBeNull();
  });

  it('defaults stage repeatable to false and keeps display order', () => {
    const p = parseProgram({ id: 'P1' }, [
      { stageUid: 'S1' }, { stageUid: 'S2' },
    ]);
    expect(p.stages[0]!.repeatable).toBe(false);
    expect(p.stages[1]!.sortOrder).toBe(1);
  });
});

describe('parseStageForm', () => {
  const baseForm: RawStageForm = {
    sections: [
      { sectionUid: 'SEC1', displayName: 'Registration', sortOrder: 1,
        fields: [
          { dataElementUid: 'DE1',
            dataElementDisplayName: 'Age', valueType: 'INTEGER_POSITIVE',
            requirement: 'REQUIRED' },
          { dataElementUid: 'DE2',
            dataElementDisplayName: 'Notes', valueType: 'LONG_TEXT',
            requirement: 'OPTIONAL' },
        ] },
      { sectionUid: 'SEC2', displayName: 'Follow-up', sortOrder: 2,
        fields: [
          { dataElementUid: 'DE3',
            dataElementDisplayName: 'Date', valueType: 'DATE',
            requirement: 'READONLY' },
        ] },
    ],
  };

  it('normalizes sections, fields, requirement flags and value types', () => {
    const r = parseStageForm('S1', baseForm);
    expect(r.stage.id).toBe('S1');
    expect(r.sections.length).toBe(2);
    expect(r.sections[0]!.id).toBe('SEC1');
    expect(r.sections[0]!.displayName).toBe('Registration');
    expect(r.sections[0]!.fields.length).toBe(2);
    expect(r.sections[0]!.fields[0]!.required).toBe(true);
    expect(r.sections[0]!.fields[0]!.readonly).toBe(false);
    expect(r.sections[0]!.fields[0]!.valueType).toBe('INTEGER_POSITIVE');
    expect(r.sections[0]!.fields[0]!.domain).toBe('EVENT_DATA_ELEMENT');
    expect(r.sections[1]!.fields[0]!.readonly).toBe(true);
    expect(r.sections[1]!.fields[0]!.required).toBe(false);
    expect(r.issues).toEqual([]);
    expect(r.metadataFingerprint).toMatch(/^[0-9a-f]{8}$/);
  });

  it('flags unknown value types as warnings and falls back to UNKNOWN', () => {
    const r = parseStageForm('S1', { sections: [{
      sectionUid: null, fields: [
        { dataElementUid: 'DEx', valueType: 'FOO_BAR' },
      ],
    }] });
    expect(r.sections[0]!.fields[0]!.valueType).toBe('UNKNOWN');
    expect(r.issues.some((i) => i.code === 'UNKNOWN_VALUE_TYPE')).toBe(true);
  });

  it('flags missing value type and defaults to TEXT', () => {
    const r = parseStageForm('S1', { sections: [{
      sectionUid: null, fields: [{ dataElementUid: 'DEy' }],
    }] });
    expect(r.sections[0]!.fields[0]!.valueType).toBe('TEXT');
    expect(r.issues.some((i) => i.code === 'MISSING_VALUE_TYPE')).toBe(true);
  });

  it('detects duplicate field refs across the stage', () => {
    const r = parseStageForm('S1', { sections: [{
      sectionUid: null, fields: [
        { dataElementUid: 'DEa', fieldRef: 'ref-1', valueType: 'TEXT' },
        { dataElementUid: 'DEb', fieldRef: 'ref-1', valueType: 'TEXT' },
      ],
    }] });
    expect(r.issues.some((i) => i.code === 'DUPLICATE_FIELD')).toBe(true);
  });

  it('respects explicit sortOrder across sections (§MD-003)', () => {
    const r = parseStageForm('S1', { sections: [
      { sectionUid: 'B', displayName: 'Beta', sortOrder: 2, fields: [] },
      { sectionUid: 'A', displayName: 'Alpha', sortOrder: 1, fields: [] },
    ] });
    expect(r.sections.map((s) => s.id)).toEqual(['A', 'B']);
  });

  it('preserves server order verbatim when no sortOrder is given', () => {
    const r = parseStageForm('S1', { sections: [
      { sectionUid: 'B', displayName: 'Beta', fields: [] },
      { sectionUid: 'A', displayName: 'Alpha', fields: [] },
    ] });
    expect(r.sections.map((s) => s.id)).toEqual(['B', 'A']);
  });

  it('carries optionSetId through for options-aware fields', () => {
    const r = parseStageForm('S1', { sections: [{
      sectionUid: null, fields: [
        { dataElementUid: 'DEo', valueType: 'TEXT', optionSetUid: 'OS1' },
      ],
    }] });
    expect(r.sections[0]!.fields[0]!.optionSetId).toBe('OS1');
  });

  it('defaults requirement to OPTIONAL when absent', () => {
    const r = parseStageForm('S1', { sections: [{
      sectionUid: null, fields: [
        { dataElementUid: 'DEz', valueType: 'TEXT' },
      ],
    }] });
    expect(r.sections[0]!.fields[0]!.required).toBe(false);
    expect(r.sections[0]!.fields[0]!.readonly).toBe(false);
  });

  it('treats a missing sections array as an empty form', () => {
    const r = parseStageForm('S1', {});
    expect(r.sections).toEqual([]);
    expect(r.issues).toEqual([]);
  });

  it('uses stageMeta for displayName + repeatable when supplied', () => {
    const r = parseStageForm('S1', baseForm,
      { stageUid: 'S1', displayName: 'Clinic visit',
        repeatable: true, sortOrder: 3 });
    expect(r.stage.displayName).toBe('Clinic visit');
    expect(r.stage.repeatable).toBe(true);
    expect(r.stage.sortOrder).toBe(3);
  });

  it('falls back to the raw stage form displayName when stageMeta is null', () => {
    const r = parseStageForm('S1', { displayName: 'From form' });
    expect(r.stage.displayName).toBe('From form');
  });

  it('falls back to the uid when neither stageMeta nor raw gives a name', () => {
    const r = parseStageForm('S1', {});
    expect(r.stage.displayName).toBe('S1');
  });
});

describe('parseTeiAttributesForm', () => {
  const attrs: RawTeiAttribute[] = [
    { attributeUid: 'TEA_last', displayName: 'Last name',
      valueType: 'TEXT', mandatory: true, sortOrder: 2 },
    { attributeUid: 'TEA_first', displayName: 'First name',
      valueType: 'TEXT', mandatory: true, sortOrder: 1 },
    { attributeUid: 'TEA_dob', displayName: 'Date of birth',
      valueType: 'DATE', mandatory: false, sortOrder: 3 },
  ];

  it('normalizes attributes into one identity section', () => {
    const r = parseTeiAttributesForm(attrs);
    expect(r.sections.length).toBe(1);
    expect(r.sections[0]!.id).toBe('identity');
    expect(r.sections[0]!.fields.map((f) => f.id)).toEqual([
      'TEA_first', 'TEA_last', 'TEA_dob',
    ]);
    expect(r.sections[0]!.fields.every((f) =>
      f.domain === 'ATTRIBUTE')).toBe(true);
  });

  it('marks uniqueAttribute TEAs with a description note', () => {
    const r = parseTeiAttributesForm([
      { attributeUid: 'TEA_art', displayName: 'ART number',
        valueType: 'TEXT', uniqueAttribute: true },
      { attributeUid: 'TEA_sex', displayName: 'Sex',
        valueType: 'TEXT' },
    ]);
    expect(r.sections[0]!.fields[0]!.description)
      .toBe('Must be unique across tracked entities');
    expect(r.sections[0]!.fields[1]!.description).toBeNull();
  });

  it('carries mandatory + optionSet through', () => {
    const r = parseTeiAttributesForm([
      { attributeUid: 'TEA_sex', displayName: 'Sex',
        valueType: 'TEXT', mandatory: true, optionSetUid: 'OS_sex' },
    ]);
    expect(r.sections[0]!.fields[0]!.required).toBe(true);
    expect(r.sections[0]!.fields[0]!.optionSetId).toBe('OS_sex');
  });

  it('returns empty sections when no attributes are configured', () => {
    const r = parseTeiAttributesForm([]);
    expect(r.sections).toEqual([]);
    expect(r.issues).toEqual([]);
  });

  it('flags unknown value types without dropping the field', () => {
    const r = parseTeiAttributesForm([
      { attributeUid: 'TEA_x', valueType: 'MYSTERY' },
    ]);
    expect(r.sections[0]!.fields[0]!.valueType).toBe('UNKNOWN');
    expect(r.issues.some((i) => i.code === 'UNKNOWN_VALUE_TYPE')).toBe(true);
  });

  it('detects duplicate attribute UIDs', () => {
    const r = parseTeiAttributesForm([
      { attributeUid: 'TEA_x', valueType: 'TEXT' },
      { attributeUid: 'TEA_x', valueType: 'TEXT' },
    ]);
    expect(r.issues.some((i) => i.code === 'DUPLICATE_FIELD')).toBe(true);
  });

  it('defaults mandatory to false when absent', () => {
    const r = parseTeiAttributesForm([
      { attributeUid: 'TEA_x', valueType: 'TEXT' },
    ]);
    expect(r.sections[0]!.fields[0]!.required).toBe(false);
  });

  it('uses attributeUid as the label when displayName is missing', () => {
    const r = parseTeiAttributesForm([
      { attributeUid: 'TEA_anon', valueType: 'TEXT' },
    ]);
    expect(r.sections[0]!.fields[0]!.label).toBe('TEA_anon');
  });

  it('computes a stable fingerprint across equal inputs', () => {
    const a = parseTeiAttributesForm(attrs).metadataFingerprint;
    const b = parseTeiAttributesForm(attrs).metadataFingerprint;
    expect(a).toBe(b);
    expect(a).toMatch(/^[0-9a-f]{8}$/);
  });
});

describe('computeFingerprint', () => {
  it('is deterministic for equivalent inputs regardless of key order', () => {
    const a = computeFingerprint({ x: 1, y: [2, 3], z: 'ok' });
    const b = computeFingerprint({ z: 'ok', y: [2, 3], x: 1 });
    expect(a).toBe(b);
  });

  it('changes when any structural value changes', () => {
    const base = computeFingerprint({ s: ['A', 'B'] });
    const changed = computeFingerprint({ s: ['A', 'B', 'C'] });
    expect(base).not.toBe(changed);
  });

  it('distinguishes null from missing', () => {
    expect(computeFingerprint({ a: null }))
      .not.toBe(computeFingerprint({}));
  });

  it('returns an 8-char lowercase hex string', () => {
    expect(computeFingerprint({ hello: 'world' })).toMatch(/^[0-9a-f]{8}$/);
  });

  it('handles nested arrays and objects', () => {
    const v = { a: [1, { b: 2, c: [true, false, null] }] };
    expect(computeFingerprint(v)).toMatch(/^[0-9a-f]{8}$/);
  });
});
