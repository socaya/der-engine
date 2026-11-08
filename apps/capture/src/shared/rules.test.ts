import { describe, it, expect } from 'vitest';
import type { CaptureParseIssue } from './model';
import {
  parseProgramRule, parseProgramRuleAction, parseProgramRuleVariable,
  parseProgramRules,
  type RawProgramRule, type RawProgramRuleAction,
  type RawProgramRuleVariable,
} from './rules';

/**
 * Unit tests for the Capture rule + rule-variable parser (G3-1,
 * requirements doc §11 PR-001/PR-004). Execution comes in G3-2;
 * this slice verifies that every supported source/action type
 * passes through and every unsupported one surfaces an issue
 * rather than vanishing (§MD-006, §PR-004).
 */

describe('parseProgramRuleVariable', () => {
  it('maps a DATAELEMENT_CURRENT_EVENT variable with all optional fields', () => {
    const issues: CaptureParseIssue[] = [];
    const raw: RawProgramRuleVariable = {
      id: 'V1', name: 'age', program: { id: 'P1' },
      programRuleVariableSourceType: 'DATAELEMENT_CURRENT_EVENT',
      dataElement: { id: 'DE1' }, valueType: 'INTEGER',
      useCodeForOptionSet: true,
    };
    const v = parseProgramRuleVariable(raw, issues);
    expect(v).toEqual({
      id: 'V1', name: 'age', programId: 'P1',
      source: 'DATAELEMENT_CURRENT_EVENT',
      dataElementId: 'DE1',
      trackedEntityAttributeId: null,
      programStageId: null,
      useCodeForOptionSet: true,
      valueType: 'INTEGER',
    });
    expect(issues).toEqual([]);
  });

  it('flags unknown source types without dropping the variable', () => {
    const issues: CaptureParseIssue[] = [];
    const v = parseProgramRuleVariable(
      { id: 'V2', name: 'weird',
        programRuleVariableSourceType: 'BOGUS' }, issues);
    expect(v.source).toBe('UNKNOWN');
    expect(issues.some((i) => i.code === 'UNKNOWN_RULE_VAR_SOURCE')).toBe(true);
  });

  it('falls back to displayName then id when name is missing', () => {
    const issues: CaptureParseIssue[] = [];
    expect(parseProgramRuleVariable(
      { id: 'V3', displayName: 'fromDisplay' }, issues).name)
      .toBe('fromDisplay');
    expect(parseProgramRuleVariable({ id: 'V4' }, issues).name).toBe('V4');
  });

  it('treats a missing value type as TEXT and unknown as UNKNOWN', () => {
    const issues: CaptureParseIssue[] = [];
    expect(parseProgramRuleVariable({ id: 'V5' }, issues).valueType)
      .toBe('TEXT');
    expect(parseProgramRuleVariable(
      { id: 'V6', valueType: 'BIZARRO' }, issues).valueType)
      .toBe('UNKNOWN');
  });

  it('defaults useCodeForOptionSet to false when unspecified', () => {
    const issues: CaptureParseIssue[] = [];
    expect(parseProgramRuleVariable({ id: 'V7' }, issues).useCodeForOptionSet)
      .toBe(false);
  });

  it('accepts a TEI_ATTRIBUTE source for tracker programs', () => {
    const issues: CaptureParseIssue[] = [];
    const v = parseProgramRuleVariable({ id: 'V8', name: 'tei_name',
      programRuleVariableSourceType: 'TEI_ATTRIBUTE',
      trackedEntityAttribute: { id: 'TEA1' } }, issues);
    expect(v.source).toBe('TEI_ATTRIBUTE');
    expect(v.trackedEntityAttributeId).toBe('TEA1');
  });
});

describe('parseProgramRuleAction', () => {
  it('maps a HIDEFIELD action with the data-element reference', () => {
    const issues: CaptureParseIssue[] = [];
    const raw: RawProgramRuleAction = {
      id: 'A1', programRuleActionType: 'HIDEFIELD',
      dataElement: { id: 'DE1' }, location: 'FEEDBACK',
    };
    const a = parseProgramRuleAction(raw, issues, 'rule');
    expect(a.type).toBe('HIDEFIELD');
    expect(a.dataElementId).toBe('DE1');
    expect(a.location).toBe('FEEDBACK');
    expect(issues).toEqual([]);
  });

  it('flags unknown action types but keeps the action record', () => {
    const issues: CaptureParseIssue[] = [];
    const a = parseProgramRuleAction(
      { id: 'A2', programRuleActionType: 'CUSTOM_SIDE_EFFECT' },
      issues, 'rule');
    expect(a.type).toBe('UNKNOWN');
    expect(issues.some((i) => i.code === 'UNKNOWN_RULE_ACTION')).toBe(true);
  });

  it('passes through content + data payloads for SHOWWARNING', () => {
    const issues: CaptureParseIssue[] = [];
    const a = parseProgramRuleAction(
      { id: 'A3', programRuleActionType: 'SHOWWARNING',
        content: 'Please confirm', data: 'd2:hasValue(#{var})' },
      issues, 'rule');
    expect(a.content).toBe('Please confirm');
    expect(a.data).toBe('d2:hasValue(#{var})');
  });

  it('nulls out references that are absent', () => {
    const issues: CaptureParseIssue[] = [];
    const a = parseProgramRuleAction(
      { id: 'A4', programRuleActionType: 'HIDESECTION' },
      issues, 'rule');
    expect(a.dataElementId).toBeNull();
    expect(a.trackedEntityAttributeId).toBeNull();
    expect(a.programStageSectionId).toBeNull();
  });
});

describe('parseProgramRule', () => {
  const raw: RawProgramRule = {
    id: 'R1', name: 'hide-notes-when-negative', program: { id: 'P1' },
    condition: "#{status} == 'NEGATIVE'",
    priority: 5,
    programRuleActions: [
      { id: 'A1', programRuleActionType: 'HIDEFIELD',
        dataElement: { id: 'DE_notes' } },
    ],
  };

  it('maps a rule with actions and priority preserved', () => {
    const issues: CaptureParseIssue[] = [];
    const r = parseProgramRule(raw, issues);
    expect(r.id).toBe('R1');
    expect(r.programId).toBe('P1');
    expect(r.condition).toBe("#{status} == 'NEGATIVE'");
    expect(r.priority).toBe(5);
    expect(r.actions.length).toBe(1);
    expect(r.actions[0]!.type).toBe('HIDEFIELD');
    expect(issues).toEqual([]);
  });

  it('flags an empty condition so the evaluator can skip the rule safely', () => {
    const issues: CaptureParseIssue[] = [];
    const r = parseProgramRule({ ...raw, condition: '' }, issues);
    expect(r.condition).toBe('');
    expect(issues.some((i) => i.code === 'EMPTY_RULE_CONDITION')).toBe(true);
  });

  it('defaults priority to 0 and programStageId to null when absent', () => {
    const issues: CaptureParseIssue[] = [];
    const r = parseProgramRule({ id: 'R2', program: { id: 'P1' },
      condition: 'true' }, issues);
    expect(r.priority).toBe(0);
    expect(r.programStageId).toBeNull();
  });

  it('handles rules with zero actions', () => {
    const issues: CaptureParseIssue[] = [];
    const r = parseProgramRule({ id: 'R3', program: { id: 'P1' },
      condition: 'true' }, issues);
    expect(r.actions).toEqual([]);
  });

  it('falls back to id when neither name nor displayName is set', () => {
    const issues: CaptureParseIssue[] = [];
    expect(parseProgramRule({ id: 'R4' }, issues).name).toBe('R4');
  });
});

describe('parseProgramRules (batch)', () => {
  it('returns rules sorted by priority ascending', () => {
    const rules: RawProgramRule[] = [
      { id: 'R1', condition: 'true', priority: 10 },
      { id: 'R2', condition: 'true', priority: 1 },
      { id: 'R3', condition: 'true', priority: 5 },
    ];
    const r = parseProgramRules(rules, []);
    expect(r.rules.map((x) => x.id)).toEqual(['R2', 'R3', 'R1']);
  });

  it('merges parse issues from both rules and variables', () => {
    const r = parseProgramRules(
      [{ id: 'R1', condition: '',
         programRuleActions: [{ id: 'A1',
           programRuleActionType: 'MYSTERY' }] }],
      [{ id: 'V1', programRuleVariableSourceType: 'MYSTERY' }],
    );
    const codes = r.issues.map((i) => i.code).sort();
    expect(codes).toContain('EMPTY_RULE_CONDITION');
    expect(codes).toContain('UNKNOWN_RULE_ACTION');
    expect(codes).toContain('UNKNOWN_RULE_VAR_SOURCE');
  });

  it('returns stable output for empty inputs', () => {
    const r = parseProgramRules([], []);
    expect(r.rules).toEqual([]);
    expect(r.variables).toEqual([]);
    expect(r.issues).toEqual([]);
  });
});
