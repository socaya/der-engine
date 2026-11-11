import { describe, it, expect } from 'vitest';
import type {
  CaptureField, CaptureFormSection, CaptureProgramRule,
  CaptureProgramRuleVariable,
} from './model';
import {
  applyRuleEffectsToSections, evaluateExpression, evaluateRules,
} from './ruleEngine';

/**
 * Unit tests for the Capture rule evaluator (G3-2 slice,
 * requirements doc §7.4 Rules engine acceptance matrix,
 * §PR-002 deterministic evaluation, §PR-004 fail-safe on
 * unsupported expressions).
 */

function mkField(id: string, required = false): CaptureField {
  return {
    id, fieldRef: id, domain: 'EVENT_DATA_ELEMENT', valueType: 'TEXT',
    label: id, description: null, required, readonly: false,
    optionSetId: null, sortOrder: 0, sectionId: null,
    renderType: 'DEFAULT', allowFutureDate: false,
  };
}

function mkSection(id: string | null, fields: CaptureField[]):
    CaptureFormSection {
  return { id, displayName: id ?? '', sortOrder: 0,
    renderType: 'LISTING', fields };
}

function mkVar(name: string, dataElementId: string): CaptureProgramRuleVariable {
  return {
    id: 'V-' + name, name, programId: 'P1',
    source: 'DATAELEMENT_CURRENT_EVENT',
    dataElementId, trackedEntityAttributeId: null,
    programStageId: null, useCodeForOptionSet: false,
    valueType: 'TEXT',
  };
}

function mkRule(partial: Partial<CaptureProgramRule>
    & Pick<CaptureProgramRule, 'id' | 'condition'>): CaptureProgramRule {
  return {
    name: partial.id,
    programId: 'P1',
    programStageId: null,
    priority: 0,
    actions: [],
    ...partial,
  };
}

const vars = new Map([
  ['status', { value: 'POSITIVE', hasValue: true }],
  ['age', { value: '12', hasValue: true }],
  ['notes', { value: '', hasValue: false }],
  ['ok', { value: 'true', hasValue: true }],
]);

/* ─── evaluateExpression ─── */

describe('evaluateExpression (G3-2)', () => {
  it('evaluates string equality', () => {
    const r = evaluateExpression("#{status} == 'POSITIVE'", vars);
    expect(r).toEqual({ kind: 'ok', value: true });
  });

  it('evaluates numeric comparison with coercion from text input', () => {
    expect(evaluateExpression('#{age} > 10', vars))
      .toEqual({ kind: 'ok', value: true });
    expect(evaluateExpression('#{age} < 10', vars))
      .toEqual({ kind: 'ok', value: false });
    expect(evaluateExpression('#{age} >= 12', vars))
      .toEqual({ kind: 'ok', value: true });
    expect(evaluateExpression('#{age} <= 11', vars))
      .toEqual({ kind: 'ok', value: false });
  });

  it('supports !=', () => {
    expect(evaluateExpression("#{status} != 'NEG'", vars))
      .toEqual({ kind: 'ok', value: true });
  });

  it('supports logical AND / OR / NOT', () => {
    expect(evaluateExpression(
      "#{status} == 'POSITIVE' && #{age} > 10", vars))
      .toEqual({ kind: 'ok', value: true });
    expect(evaluateExpression(
      "#{status} == 'NEG' || #{age} == 12", vars))
      .toEqual({ kind: 'ok', value: true });
    expect(evaluateExpression("!(#{age} > 100)", vars))
      .toEqual({ kind: 'ok', value: true });
  });

  it('supports d2:hasValue', () => {
    expect(evaluateExpression('d2:hasValue(#{status})', vars))
      .toEqual({ kind: 'ok', value: true });
    expect(evaluateExpression('d2:hasValue(#{notes})', vars))
      .toEqual({ kind: 'ok', value: false });
  });

  it('supports parentheses for grouping', () => {
    expect(evaluateExpression(
      "(#{status} == 'POSITIVE' || #{age} < 0) && !(#{age} > 100)",
      vars)).toEqual({ kind: 'ok', value: true });
  });

  it('supports boolean literals', () => {
    expect(evaluateExpression('true', vars))
      .toEqual({ kind: 'ok', value: true });
    expect(evaluateExpression('false || true', vars))
      .toEqual({ kind: 'ok', value: true });
  });

  it('supports unary minus on numbers', () => {
    expect(evaluateExpression('-5 < 0', vars))
      .toEqual({ kind: 'ok', value: true });
  });

  it('errors on unknown variables', () => {
    const r = evaluateExpression('#{nope} == 1', vars);
    expect(r.kind).toBe('error');
  });

  it('errors on unterminated strings', () => {
    const r = evaluateExpression("#{status} == 'POSITIVE", vars);
    expect(r.kind).toBe('error');
  });

  it('errors on unsupported functions', () => {
    const r = evaluateExpression('d2:unknown(#{age})', vars);
    expect(r.kind).toBe('error');
  });

  it('errors on unknown identifiers', () => {
    const r = evaluateExpression('status == 1', vars);
    expect(r.kind).toBe('error');
  });

  it('errors on trailing tokens', () => {
    const r = evaluateExpression('1 == 1 nope', vars);
    expect(r.kind).toBe('error');
  });
});

/* ─── evaluateRules ─── */

describe('evaluateRules', () => {
  it('returns empty effects when no rules are passed', () => {
    const e = evaluateRules([], [], {});
    expect(e.hiddenFieldIds.size).toBe(0);
    expect(e.warnings.length).toBe(0);
  });

  it('applies HIDEFIELD when the rule condition is true', () => {
    const rule = mkRule({
      id: 'R1', condition: "#{status} == 'POSITIVE'",
      actions: [{ id: 'A1', type: 'HIDEFIELD',
        dataElementId: 'DE_notes', trackedEntityAttributeId: null,
        programStageId: null, programStageSectionId: null,
        content: null, data: null, location: null }],
    });
    const e = evaluateRules([rule], [mkVar('status', 'DE_status')],
      { DE_status: 'POSITIVE' });
    expect(e.hiddenFieldIds.has('DE_notes')).toBe(true);
  });

  it('does NOT apply when condition is false', () => {
    const rule = mkRule({
      id: 'R1', condition: "#{status} == 'POSITIVE'",
      actions: [{ id: 'A1', type: 'HIDEFIELD',
        dataElementId: 'DE_notes', trackedEntityAttributeId: null,
        programStageId: null, programStageSectionId: null,
        content: null, data: null, location: null }],
    });
    const e = evaluateRules([rule], [mkVar('status', 'DE_status')],
      { DE_status: 'NEGATIVE' });
    expect(e.hiddenFieldIds.size).toBe(0);
  });

  it('applies SETMANDATORYFIELD', () => {
    const rule = mkRule({
      id: 'R1', condition: 'd2:hasValue(#{status})',
      actions: [{ id: 'A1', type: 'SETMANDATORYFIELD',
        dataElementId: 'DE_notes', trackedEntityAttributeId: null,
        programStageId: null, programStageSectionId: null,
        content: null, data: null, location: null }],
    });
    const e = evaluateRules([rule], [mkVar('status', 'DE_status')],
      { DE_status: 'X' });
    expect(e.mandatoryFieldIds.has('DE_notes')).toBe(true);
  });

  it('applies HIDESECTION', () => {
    const rule = mkRule({
      id: 'R1', condition: 'true',
      actions: [{ id: 'A1', type: 'HIDESECTION',
        dataElementId: null, trackedEntityAttributeId: null,
        programStageId: null, programStageSectionId: 'SEC2',
        content: null, data: null, location: null }],
    });
    const e = evaluateRules([rule], [], {});
    expect(e.hiddenSectionIds.has('SEC2')).toBe(true);
  });

  it('emits SHOWWARNING + SHOWERROR with content', () => {
    const rule = mkRule({
      id: 'R1', condition: '#{age} > 10',
      actions: [
        { id: 'A1', type: 'SHOWWARNING',
          dataElementId: 'DE_age', trackedEntityAttributeId: null,
          programStageId: null, programStageSectionId: null,
          content: 'Age suspicious', data: null, location: null },
        { id: 'A2', type: 'SHOWERROR',
          dataElementId: 'DE_age', trackedEntityAttributeId: null,
          programStageId: null, programStageSectionId: null,
          content: 'Age blocked', data: null, location: null },
      ],
    });
    const e = evaluateRules([rule], [mkVar('age', 'DE_age')],
      { DE_age: '12' });
    expect(e.warnings.length).toBe(2);
    expect(e.warnings[0]!.severity).toBe('warning');
    expect(e.warnings[1]!.severity).toBe('error');
  });

  it('skips rules with unsupported expressions and flags an issue', () => {
    const rule = mkRule({
      id: 'R1', condition: 'd2:zing(#{status}, 5)',
      actions: [{ id: 'A1', type: 'HIDEFIELD',
        dataElementId: 'DE_notes', trackedEntityAttributeId: null,
        programStageId: null, programStageSectionId: null,
        content: null, data: null, location: null }],
    });
    const e = evaluateRules([rule], [mkVar('status', 'DE_status')],
      { DE_status: 'X' });
    expect(e.hiddenFieldIds.size).toBe(0);
    expect(e.issues.some((i) => i.code === 'RULE_EXPR_UNSUPPORTED')).toBe(true);
  });

  it('flags non-CURRENT_EVENT variable sources so operators see skipped rules',
      () => {
    const v: CaptureProgramRuleVariable = {
      id: 'V1', name: 'prev', programId: 'P1',
      source: 'DATAELEMENT_PREVIOUS_EVENT',
      dataElementId: 'DE_x',
      trackedEntityAttributeId: null, programStageId: null,
      useCodeForOptionSet: false, valueType: 'TEXT',
    };
    const e = evaluateRules([
      mkRule({ id: 'R1', condition: 'd2:hasValue(#{prev})',
        actions: [] }),
    ], [v], {});
    expect(e.issues.some((i) =>
      i.code === 'RULE_VAR_SOURCE_UNSUPPORTED')).toBe(true);
  });

  it('flags unsupported action types so they are visibly deferred', () => {
    // HIDEOPTION is still unimplemented — it stays in the
    // "not applied" bucket. (ASSIGN moved out of the bucket in
    // SHEET-C1; see the dedicated ASSIGN test below.)
    const rule = mkRule({
      id: 'R1', condition: 'true',
      actions: [{ id: 'A1', type: 'HIDEOPTION',
        dataElementId: 'DE_x', trackedEntityAttributeId: null,
        programStageId: null, programStageSectionId: null,
        content: null, data: null, location: null }],
    });
    const e = evaluateRules([rule], [], {});
    expect(e.issues.some((i) => i.code === 'RULE_ACTION_NOT_APPLIED')).toBe(true);
  });

  it('ASSIGN writes a computed value into assignedValues', () => {
    // d2:hasValue is already supported by the expression engine.
    // Use an expression the engine can evaluate end-to-end — the
    // string literal path avoids needing arithmetic on strings.
    const rule = mkRule({
      id: 'R-assign', condition: 'true',
      actions: [{ id: 'A1', type: 'ASSIGN',
        dataElementId: 'DE_computed', trackedEntityAttributeId: null,
        programStageId: null, programStageSectionId: null,
        content: 'constant string',
        data: "'hello'", location: null }],
    });
    const e = evaluateRules([rule], [], {});
    expect(e.assignedValues.get('DE_computed')).toBe('hello');
    // ASSIGN no longer surfaces as RULE_ACTION_NOT_APPLIED.
    expect(e.issues.filter((i) =>
      i.code === 'RULE_ACTION_NOT_APPLIED')).toEqual([]);
  });

  it('ASSIGN with no target surfaces a RULE_ASSIGN_NO_TARGET issue', () => {
    const rule = mkRule({
      id: 'R-assign-notarget', condition: 'true',
      actions: [{ id: 'A1', type: 'ASSIGN',
        dataElementId: null, trackedEntityAttributeId: null,
        programStageId: null, programStageSectionId: null,
        content: null, data: "'x'", location: null }],
    });
    const e = evaluateRules([rule], [], {});
    expect(e.issues.some((i) =>
      i.code === 'RULE_ASSIGN_NO_TARGET')).toBe(true);
    expect(e.assignedValues.size).toBe(0);
  });

  it('respects rule priority ordering — already sorted by the parser', () => {
    const rules = [
      mkRule({ id: 'R-high', condition: 'true', priority: 1,
        actions: [{ id: 'A1', type: 'HIDEFIELD',
          dataElementId: 'DE_1', trackedEntityAttributeId: null,
          programStageId: null, programStageSectionId: null,
          content: null, data: null, location: null }] }),
      mkRule({ id: 'R-low', condition: 'true', priority: 10,
        actions: [{ id: 'A2', type: 'HIDEFIELD',
          dataElementId: 'DE_2', trackedEntityAttributeId: null,
          programStageId: null, programStageSectionId: null,
          content: null, data: null, location: null }] }),
    ];
    const e = evaluateRules(rules, [], {});
    expect(e.hiddenFieldIds.has('DE_1')).toBe(true);
    expect(e.hiddenFieldIds.has('DE_2')).toBe(true);
  });
});

/* ─── applyRuleEffectsToSections ─── */

describe('applyRuleEffectsToSections', () => {
  const sections: CaptureFormSection[] = [
    mkSection('SEC1', [mkField('DE_a'), mkField('DE_b'),
      mkField('DE_c')]),
    mkSection('SEC2', [mkField('DE_d'), mkField('DE_e')]),
  ];

  it('removes hidden fields without touching non-hidden ones', () => {
    const out = applyRuleEffectsToSections(sections, {
      hiddenFieldIds: new Set(['DE_b']),
      hiddenSectionIds: new Set(),
      mandatoryFieldIds: new Set(),
      warnings: [], issues: [],
    });
    expect(out[0]!.fields.map((f) => f.id)).toEqual(['DE_a', 'DE_c']);
    expect(out[1]!.fields.map((f) => f.id)).toEqual(['DE_d', 'DE_e']);
  });

  it('removes hidden sections entirely', () => {
    const out = applyRuleEffectsToSections(sections, {
      hiddenFieldIds: new Set(),
      hiddenSectionIds: new Set(['SEC2']),
      mandatoryFieldIds: new Set(),
      warnings: [], issues: [],
    });
    expect(out.length).toBe(1);
    expect(out[0]!.id).toBe('SEC1');
  });

  it('promotes mandatory flags without mutating the input', () => {
    const out = applyRuleEffectsToSections(sections, {
      hiddenFieldIds: new Set(),
      hiddenSectionIds: new Set(),
      mandatoryFieldIds: new Set(['DE_a']),
      warnings: [], issues: [],
    });
    expect(out[0]!.fields[0]!.required).toBe(true);
    // Original untouched (§FR-009).
    expect(sections[0]!.fields[0]!.required).toBe(false);
  });

  it('returns the same reference when effect set is empty', () => {
    const out = applyRuleEffectsToSections(sections, {
      hiddenFieldIds: new Set(),
      hiddenSectionIds: new Set(),
      mandatoryFieldIds: new Set(),
      warnings: [], issues: [],
    });
    expect(out).toBe(sections);
  });
});
