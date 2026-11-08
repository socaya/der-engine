import type {
  CaptureParseIssue, CaptureProgramRule, CaptureProgramRuleVariable,
  CaptureRuleAction, CaptureValueType, RuleActionType,
  RuleVariableSource,
} from './model';

/**
 * Program-rule + rule-variable parser for the unified Capture app
 * (requirements doc §11 "Program rules and business logic",
 * §PR-001 to §PR-008). Pure data-in/data-out so every branch can
 * be exercised from a fixture. No execution yet — execution
 * follows in G3-2 behind a proven typed model.
 */

export interface RawProgramRuleAction {
  readonly id: string;
  readonly programRuleActionType?: string;
  readonly content?: string;
  readonly data?: string;
  readonly dataElement?: { id?: string } | null;
  readonly trackedEntityAttribute?: { id?: string } | null;
  readonly programStage?: { id?: string } | null;
  readonly programStageSection?: { id?: string } | null;
  readonly location?: string;
}

export interface RawProgramRule {
  readonly id: string;
  readonly displayName?: string;
  readonly name?: string;
  readonly program?: { id?: string } | null;
  readonly programStage?: { id?: string } | null;
  readonly condition?: string;
  readonly priority?: number | null;
  readonly programRuleActions?: ReadonlyArray<RawProgramRuleAction>;
}

export interface RawProgramRuleVariable {
  readonly id: string;
  readonly displayName?: string;
  readonly name?: string;
  readonly program?: { id?: string } | null;
  readonly programRuleVariableSourceType?: string;
  readonly dataElement?: { id?: string } | null;
  readonly trackedEntityAttribute?: { id?: string } | null;
  readonly programStage?: { id?: string } | null;
  readonly useCodeForOptionSet?: boolean;
  readonly valueType?: string;
}

const KNOWN_RULE_ACTIONS: ReadonlySet<RuleActionType> = new Set<
  RuleActionType>([
    'HIDEFIELD', 'HIDESECTION', 'HIDEPROGRAMSTAGE',
    'SETMANDATORYFIELD',
    'SHOWWARNING', 'WARNINGONCOMPLETE',
    'SHOWERROR', 'ERRORONCOMPLETE',
    'ASSIGN',
    'HIDEOPTION', 'HIDEOPTIONGROUP', 'SHOWOPTIONGROUP',
  ]);

const KNOWN_VARIABLE_SOURCES: ReadonlySet<RuleVariableSource> = new Set<
  RuleVariableSource>([
    'DATAELEMENT_CURRENT_EVENT',
    'DATAELEMENT_NEWEST_EVENT_PROGRAM',
    'DATAELEMENT_NEWEST_EVENT_PROGRAM_STAGE',
    'DATAELEMENT_PREVIOUS_EVENT',
    'TEI_ATTRIBUTE',
    'CALCULATED_VALUE',
  ]);

const KNOWN_VALUE_TYPES: ReadonlySet<CaptureValueType> = new Set<
  CaptureValueType>([
    'TEXT', 'LONG_TEXT',
    'INTEGER', 'INTEGER_POSITIVE', 'INTEGER_NEGATIVE',
    'INTEGER_ZERO_OR_POSITIVE', 'NUMBER', 'PERCENTAGE',
    'BOOLEAN', 'TRUE_ONLY',
    'DATE', 'DATETIME', 'TIME', 'AGE',
    'EMAIL', 'URL', 'PHONE_NUMBER',
    'ORGANISATION_UNIT',
    'FILE_RESOURCE', 'IMAGE',
    'COORDINATE', 'GEOJSON',
  ]);

export function parseProgramRuleVariable(
  raw: RawProgramRuleVariable,
  issues: CaptureParseIssue[],
): CaptureProgramRuleVariable {
  const sourceRaw = (raw.programRuleVariableSourceType ?? '').toUpperCase();
  const source: RuleVariableSource =
    KNOWN_VARIABLE_SOURCES.has(sourceRaw as RuleVariableSource)
      ? (sourceRaw as RuleVariableSource)
      : 'UNKNOWN';
  if (source === 'UNKNOWN') {
    issues.push({ severity: 'warning', code: 'UNKNOWN_RULE_VAR_SOURCE',
      message: `Rule variable ${raw.id} uses unsupported source `
        + `"${raw.programRuleVariableSourceType}"; evaluation will skip`
        + ' rules that depend on it',
      path: 'programRuleVariables[' + raw.id + ']' });
  }
  const valueTypeRaw = (raw.valueType ?? 'TEXT').toUpperCase();
  const valueType: CaptureValueType =
    KNOWN_VALUE_TYPES.has(valueTypeRaw as CaptureValueType)
      ? (valueTypeRaw as CaptureValueType)
      : 'UNKNOWN';
  return {
    id: raw.id,
    name: raw.name ?? raw.displayName ?? raw.id,
    programId: raw.program?.id ?? '',
    source,
    dataElementId: raw.dataElement?.id ?? null,
    trackedEntityAttributeId: raw.trackedEntityAttribute?.id ?? null,
    programStageId: raw.programStage?.id ?? null,
    useCodeForOptionSet: raw.useCodeForOptionSet ?? false,
    valueType,
  };
}

export function parseProgramRuleAction(
  raw: RawProgramRuleAction,
  issues: CaptureParseIssue[],
  rulePath: string,
): CaptureRuleAction {
  const typeRaw = (raw.programRuleActionType ?? '').toUpperCase();
  const type: RuleActionType =
    KNOWN_RULE_ACTIONS.has(typeRaw as RuleActionType)
      ? (typeRaw as RuleActionType)
      : 'UNKNOWN';
  // Two distinct 'unknown' causes:
  //   (a) server responded with a type we don't recognise — real
  //       compatibility gap, worth a warning.
  //   (b) server responded with just {id} because the DER mirror
  //       doesn't expand nested programRuleActions[] inline
  //       (observed on /api/programRules). That's not an action
  //       the admin can fix — it's a bulk-fetch gap we patch in
  //       the rule-engine loader. Silence it to keep the strip
  //       usable.
  const serverReturnedPlaceholder =
    raw.programRuleActionType === undefined
    && raw.content === undefined
    && raw.data === undefined
    && !raw.dataElement && !raw.trackedEntityAttribute
    && !raw.programStage && !raw.programStageSection;
  if (type === 'UNKNOWN' && !serverReturnedPlaceholder) {
    issues.push({ severity: 'warning', code: 'UNKNOWN_RULE_ACTION',
      message: `Rule action ${raw.id} uses unsupported type `
        + `"${raw.programRuleActionType}"; rule effect will not be `
        + 'applied',
      path: rulePath + '.actions[' + raw.id + ']' });
  }
  return {
    id: raw.id,
    type,
    dataElementId: raw.dataElement?.id ?? null,
    trackedEntityAttributeId: raw.trackedEntityAttribute?.id ?? null,
    programStageId: raw.programStage?.id ?? null,
    programStageSectionId: raw.programStageSection?.id ?? null,
    content: raw.content ?? null,
    data: raw.data ?? null,
    location: raw.location ?? null,
  };
}

export function parseProgramRule(
  raw: RawProgramRule,
  issues: CaptureParseIssue[],
): CaptureProgramRule {
  const path = 'programRules[' + raw.id + ']';
  const actions = (raw.programRuleActions ?? [])
    .map((a) => parseProgramRuleAction(a, issues, path));
  if (!raw.condition || raw.condition.trim() === '') {
    issues.push({ severity: 'warning', code: 'EMPTY_RULE_CONDITION',
      message: `Rule ${raw.id} has no condition; will be skipped`,
      path });
  }
  return {
    id: raw.id,
    name: raw.name ?? raw.displayName ?? raw.id,
    programId: raw.program?.id ?? '',
    programStageId: raw.programStage?.id ?? null,
    condition: raw.condition ?? '',
    priority: raw.priority ?? 0,
    actions,
  };
}

/** Enrich a raw rule list in place by swapping its id-only
 *  {@code programRuleActions} stubs with the full action records
 *  pulled from the bulk-fetch endpoint. The DER mirror's nested
 *  expansion on /api/programRules is shallow, so we have to join
 *  manually to get programRuleActionType + content + data. */
export function enrichRulesWithActions(
  rawRules: readonly RawProgramRule[],
  rawActions: readonly (RawProgramRuleAction
    & { programRule?: { id?: string } })[],
): RawProgramRule[] {
  const byRuleId = new Map<string, RawProgramRuleAction[]>();
  for (const a of rawActions) {
    const ruleId = a.programRule?.id;
    if (!ruleId) continue;
    const list = byRuleId.get(ruleId) ?? [];
    list.push(a);
    byRuleId.set(ruleId, list);
  }
  return rawRules.map((r) => {
    const full = byRuleId.get(r.id);
    if (!full) return r;
    return { ...r, programRuleActions: full };
  });
}

/** Parse a batch of raw rules + variables scoped to one program,
 *  sort rules by priority ascending (DHIS2 convention: lower
 *  number = higher precedence), and return the typed collection
 *  with a merged issue list. */
export function parseProgramRules(
  rawRules: readonly RawProgramRule[],
  rawVariables: readonly RawProgramRuleVariable[],
): {
  rules: readonly CaptureProgramRule[];
  variables: readonly CaptureProgramRuleVariable[];
  issues: readonly CaptureParseIssue[];
} {
  const issues: CaptureParseIssue[] = [];
  const rules = rawRules.map((r) => parseProgramRule(r, issues));
  const variables = rawVariables.map((v) =>
    parseProgramRuleVariable(v, issues));
  const sortedRules = [...rules].sort((a, b) => a.priority - b.priority);
  return { rules: sortedRules, variables, issues };
}
