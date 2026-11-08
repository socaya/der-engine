/**
 * Immutable typed domain contracts for the unified Capture app
 * (requirements doc §6.2 "Recommended normalized model"). These
 * are the *parsed* shapes the UI consumes — not DHIS2 wire JSON.
 * The parser in {@link ./parser.ts} normalizes raw server JSON
 * into these objects, per MD-001 ("Normalize server-specific
 * JSON into immutable typed objects").
 */

export type ProgramType = 'WITH_REGISTRATION' | 'WITHOUT_REGISTRATION';

export type FieldDomain = 'ATTRIBUTE' | 'EVENT_DATA_ELEMENT';

export type FieldRequirement = 'REQUIRED' | 'OPTIONAL' | 'READONLY';

/** DHIS2 value types that the form engine recognises today. Unknown
 *  types fall through to a plain {@code text} input and are
 *  flagged on the parse report (§MD-006). */
export type CaptureValueType =
  | 'TEXT' | 'LONG_TEXT'
  | 'INTEGER' | 'INTEGER_POSITIVE' | 'INTEGER_NEGATIVE'
  | 'INTEGER_ZERO_OR_POSITIVE' | 'NUMBER' | 'PERCENTAGE'
  | 'BOOLEAN' | 'TRUE_ONLY'
  | 'DATE' | 'DATETIME' | 'TIME' | 'AGE'
  | 'EMAIL' | 'URL' | 'PHONE_NUMBER'
  | 'ORGANISATION_UNIT'
  | 'FILE_RESOURCE' | 'IMAGE'
  | 'COORDINATE' | 'GEOJSON'
  | 'UNKNOWN';

/** DHIS2 per-field renderType hint (Phase 2 — surfaced from the
 *  server's FormField.renderType). Nullable at the wire; anything
 *  the client doesn't recognise maps to DEFAULT and the field
 *  falls back to the value-type-chosen input. */
export type FieldRenderType =
  | 'DEFAULT'
  | 'DROPDOWN'
  | 'VERTICAL_RADIOBUTTONS'
  | 'HORIZONTAL_RADIOBUTTONS'
  | 'VERTICAL_CHECKBOXES'
  | 'HORIZONTAL_CHECKBOXES'
  | 'TOGGLE'
  | 'SPINNER'
  | 'SLIDER'
  | 'LINEAR_SCALE'
  | 'AUTOCOMPLETE';

/** DHIS2 per-section renderType hint (Phase 1 — surfaced from the
 *  server's FormSection.renderType). LISTING is the default
 *  responsive grid; MATRIX renders a row×col table; SEQUENTIAL
 *  renders one field at a time with Prev/Next. */
export type SectionRenderType =
  | 'LISTING'
  | 'MATRIX'
  | 'SEQUENTIAL';

export interface CaptureField {
  readonly id: string;
  /** Composite UID the form engine uses to key inputs — DE UID for
   *  event fields, TEA UID for tracker attribute fields, plus
   *  disambiguator when applicable. */
  readonly fieldRef: string;
  readonly domain: FieldDomain;
  readonly valueType: CaptureValueType;
  readonly label: string;
  readonly description: string | null;
  readonly required: boolean;
  readonly readonly: boolean;
  readonly optionSetId: string | null;
  readonly sortOrder: number;
  readonly sectionId: string | null;
  readonly renderType: FieldRenderType;
}

export interface CaptureFormSection {
  readonly id: string | null;
  readonly displayName: string;
  readonly sortOrder: number;
  readonly renderType: SectionRenderType;
  readonly fields: readonly CaptureField[];
}

export interface CaptureStage {
  readonly id: string;
  readonly displayName: string;
  readonly repeatable: boolean;
  readonly sortOrder: number;
}

export interface CaptureProgram {
  readonly id: string;
  readonly displayName: string;
  readonly programType: ProgramType;
  readonly trackedEntityTypeId: string | null;
  readonly orgUnitIds: readonly string[];
  readonly stages: readonly CaptureStage[];
  /** Deterministic hash of the structural metadata used to drive
   *  rendering — MD-007. A change to any stage, section, field or
   *  requirement flips the fingerprint. */
  readonly metadataFingerprint: string;
}

export interface CaptureRecordContext {
  readonly programId: string;
  readonly organisationUnitId: string;
  readonly trackedEntityId: string | null;
  readonly enrollmentId: string | null;
  readonly stageId: string | null;
  readonly eventId: string | null;
  readonly occurredAt: string | null;
  readonly scheduledAt: string | null;
  readonly attributeOptionComboId: string | null;
}

/** Program-rule variable source — maps to DHIS2's
 *  {@code programRuleVariableSourceType} enum. Narrowed to the
 *  values the parser knows how to resolve; everything else is
 *  flagged on the issue list (§MD-005, §MD-006). */
export type RuleVariableSource =
  | 'DATAELEMENT_CURRENT_EVENT'
  | 'DATAELEMENT_NEWEST_EVENT_PROGRAM'
  | 'DATAELEMENT_NEWEST_EVENT_PROGRAM_STAGE'
  | 'DATAELEMENT_PREVIOUS_EVENT'
  | 'TEI_ATTRIBUTE'
  | 'CALCULATED_VALUE'
  | 'UNKNOWN';

export interface CaptureProgramRuleVariable {
  readonly id: string;
  readonly name: string;
  readonly programId: string;
  readonly source: RuleVariableSource;
  readonly dataElementId: string | null;
  readonly trackedEntityAttributeId: string | null;
  readonly programStageId: string | null;
  readonly useCodeForOptionSet: boolean;
  readonly valueType: CaptureValueType;
}

/** Program-rule action type (§7.4 Rules engine acceptance matrix).
 *  Narrowed to the actions the UI can safely honor today. Actions
 *  outside this set are flagged on the issue list — rules that
 *  depend on them are retained but not executed, so the UI never
 *  silently misrepresents server semantics (§PR-004). */
export type RuleActionType =
  | 'HIDEFIELD' | 'HIDESECTION' | 'HIDEPROGRAMSTAGE'
  | 'SETMANDATORYFIELD'
  | 'SHOWWARNING' | 'WARNINGONCOMPLETE'
  | 'SHOWERROR'   | 'ERRORONCOMPLETE'
  | 'ASSIGN'
  | 'HIDEOPTION'  | 'HIDEOPTIONGROUP' | 'SHOWOPTIONGROUP'
  | 'UNKNOWN';

export interface CaptureRuleAction {
  readonly id: string;
  readonly type: RuleActionType;
  readonly dataElementId: string | null;
  readonly trackedEntityAttributeId: string | null;
  readonly programStageId: string | null;
  readonly programStageSectionId: string | null;
  readonly content: string | null;
  readonly data: string | null;
  readonly location: string | null;
}

export interface CaptureProgramRule {
  readonly id: string;
  readonly name: string;
  readonly programId: string;
  readonly programStageId: string | null;
  readonly condition: string;
  readonly priority: number;
  readonly actions: readonly CaptureRuleAction[];
}

/** Issues the parser surfaces alongside a parsed program (§MD-006).
 *  Unknown value types, missing stage sections, duplicate field
 *  UIDs and anything else that would lead to silently-wrong
 *  rendering lands in this list. Never thrown — the UI decides
 *  whether to block or warn. */
export interface CaptureParseIssue {
  readonly severity: 'warning' | 'error';
  readonly code: string;
  readonly message: string;
  readonly path?: string;
}

export interface ParsedStageForm {
  readonly stage: CaptureStage;
  readonly sections: readonly CaptureFormSection[];
  readonly issues: readonly CaptureParseIssue[];
  readonly metadataFingerprint: string;
}
