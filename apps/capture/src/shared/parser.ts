import type {
  CaptureField, CaptureFormSection, CaptureParseIssue, CaptureProgram,
  CaptureStage, CaptureValueType, ParsedStageForm, ProgramType,
} from './model';

/**
 * Metadata parser for the unified Capture app
 * (requirements doc §6.1/§6.2). Each {@code parse*} function:
 *
 *   • takes raw server JSON (shape kept wide so DER/DHIS2 variants
 *     can be accommodated without upstream type changes);
 *   • returns an immutable typed object from {@link ./model};
 *   • collects actionable issues on the side rather than throwing
 *     (MD-006 "Fail safely on unsupported or inconsistent
 *     metadata").
 *
 * The parser does NOT hit the network and does NOT depend on
 * React. It is pure data-in/data-out so we can test every branch
 * from a fixture.
 */

export interface RawProgram {
  readonly id: string;
  readonly displayName?: string;
  readonly name?: string;
  readonly programType?: string;
  readonly trackedEntityType?: { id?: string } | null;
  readonly organisationUnits?: ReadonlyArray<{ id: string }>;
}

export interface RawStage {
  readonly stageUid: string;
  readonly displayName?: string;
  readonly repeatable?: boolean;
  readonly sortOrder?: number;
}

export interface RawStageField {
  readonly fieldRef?: string;
  readonly dataElementUid: string;
  readonly dataElementDisplayName?: string;
  readonly valueType?: string;
  readonly optionSetUid?: string | null;
  readonly requirement?: 'REQUIRED' | 'OPTIONAL' | 'READONLY';
  readonly sortOrder?: number;
  readonly description?: string | null;
}

export interface RawStageSection {
  readonly sectionUid?: string | null;
  readonly displayName?: string;
  readonly sortOrder?: number;
  readonly fields?: ReadonlyArray<RawStageField>;
}

export interface RawStageForm {
  readonly displayName?: string;
  readonly bindingUid?: string;
  readonly sections?: ReadonlyArray<RawStageSection>;
}

export interface RawTeiAttribute {
  readonly attributeUid: string;
  readonly displayName?: string;
  readonly valueType?: string;
  readonly optionSetUid?: string | null;
  readonly searchable?: boolean;
  readonly uniqueAttribute?: boolean;
  readonly mandatory?: boolean;
  readonly sortOrder?: number;
}

/** Supported DHIS2 value types. Anything else is flagged as a
 *  warning and rendered as plain text to keep the data flow
 *  deterministic (§MD-006 — never silently discard metadata). */
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

export function parseProgram(
  raw: RawProgram,
  stages: readonly RawStage[] = [],
): CaptureProgram {
  const programType: ProgramType =
    raw.programType === 'WITH_REGISTRATION'
      ? 'WITH_REGISTRATION' : 'WITHOUT_REGISTRATION';
  const parsedStages: CaptureStage[] = stages.map((s, i) => ({
    id: s.stageUid,
    displayName: s.displayName ?? s.stageUid,
    repeatable: s.repeatable ?? false,
    sortOrder: s.sortOrder ?? i,
  }));
  return {
    id: raw.id,
    displayName: raw.displayName ?? raw.name ?? raw.id,
    programType,
    trackedEntityTypeId: raw.trackedEntityType?.id ?? null,
    orgUnitIds: (raw.organisationUnits ?? []).map((o) => o.id),
    stages: parsedStages,
    metadataFingerprint: computeFingerprint({
      id: raw.id, programType,
      stages: parsedStages.map((s) => ({
        id: s.id, repeatable: s.repeatable, sortOrder: s.sortOrder,
      })),
    }),
  };
}

export function parseStageForm(
  programStageUid: string,
  raw: RawStageForm,
  stageMeta: RawStage | null = null,
): ParsedStageForm {
  const issues: CaptureParseIssue[] = [];
  const seenFieldIds = new Set<string>();

  const stage: CaptureStage = {
    id: programStageUid,
    displayName: stageMeta?.displayName ?? raw.displayName
      ?? programStageUid,
    repeatable: stageMeta?.repeatable ?? false,
    sortOrder: stageMeta?.sortOrder ?? 0,
  };

  const sections: CaptureFormSection[] = (raw.sections ?? []).map(
    (s, i) => {
      const sectionId = s.sectionUid ?? null;
      const fields: CaptureField[] = (s.fields ?? []).map((f, fi) => {
        const valueType = normalizeValueType(f.valueType, issues,
          `sections[${i}].fields[${fi}]`);
        const requirement = f.requirement ?? 'OPTIONAL';
        const fieldRef = f.fieldRef ?? f.dataElementUid;
        if (seenFieldIds.has(fieldRef)) {
          issues.push({ severity: 'warning', code: 'DUPLICATE_FIELD',
            message: `Duplicate field ref ${fieldRef} in stage form`,
            path: `sections[${i}].fields[${fi}]` });
        }
        seenFieldIds.add(fieldRef);
        const field: CaptureField = {
          id: f.dataElementUid,
          fieldRef,
          domain: 'EVENT_DATA_ELEMENT',
          valueType,
          label: f.dataElementDisplayName ?? f.dataElementUid,
          description: f.description ?? null,
          required: requirement === 'REQUIRED',
          readonly: requirement === 'READONLY',
          optionSetId: f.optionSetUid ?? null,
          sortOrder: f.sortOrder ?? fi,
          sectionId,
        };
        return field;
      });
      return {
        id: sectionId,
        displayName: s.displayName ?? '',
        sortOrder: s.sortOrder ?? i,
        fields,
      };
    },
  );

  // MD-003 — preserve server order. Only sort when the server gave
  // us explicit sortOrders; otherwise the array order from the
  // server is the order the operator sees.
  const anySectionHasExplicitOrder = (raw.sections ?? []).some(
    (s) => typeof s.sortOrder === 'number');
  const orderedSections = anySectionHasExplicitOrder
    ? [...sections].sort((a, b) => a.sortOrder - b.sortOrder)
    : sections;

  return {
    stage,
    sections: orderedSections,
    issues,
    metadataFingerprint: computeFingerprint({
      stageId: stage.id,
      sections: orderedSections.map((s) => ({
        id: s.id, fields: s.fields.map((f) => ({
          id: f.id, requirement: f.required ? 'REQUIRED'
            : f.readonly ? 'READONLY' : 'OPTIONAL',
          valueType: f.valueType, optionSetId: f.optionSetId,
        })),
      })),
    }),
  };
}

/**
 * Convert the DHIS2 program-tracked-entity-attribute list into the
 * shared {@link CaptureFormSection} shape so the same
 * {@code FormEngine} that renders event forms can render tracker
 * registration forms (requirements doc §10 "Shared dynamic form
 * component", §TR-010). Attributes land in one "Identity" section
 * ordered by sortOrder ascending; required / unique / searchable
 * flags are translated into the typed CaptureField shape.
 */
export function parseTeiAttributesForm(
  rawAttrs: readonly RawTeiAttribute[],
): ParsedStageForm {
  const issues: CaptureParseIssue[] = [];
  const seenFieldIds = new Set<string>();
  const ordered = [...rawAttrs].sort((a, b) =>
    (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
  const fields: CaptureField[] = ordered.map((a, i) => {
    const valueType = normalizeValueType(a.valueType, issues,
      `attributes[${i}]`);
    if (seenFieldIds.has(a.attributeUid)) {
      issues.push({ severity: 'warning', code: 'DUPLICATE_FIELD',
        message: `Duplicate attribute UID ${a.attributeUid}`,
        path: `attributes[${i}]` });
    }
    seenFieldIds.add(a.attributeUid);
    return {
      id: a.attributeUid,
      fieldRef: a.attributeUid,
      domain: 'ATTRIBUTE',
      valueType,
      label: a.displayName ?? a.attributeUid,
      description: null,
      required: a.mandatory ?? false,
      readonly: false,
      optionSetId: a.optionSetUid ?? null,
      sortOrder: a.sortOrder ?? i,
      sectionId: 'identity',
    };
  });
  const section: CaptureFormSection = {
    id: 'identity',
    displayName: 'Identity',
    sortOrder: 0,
    fields,
  };
  return {
    stage: {
      id: '__registration',
      displayName: 'Register new tracked entity',
      repeatable: false,
      sortOrder: 0,
    },
    sections: fields.length === 0 ? [] : [section],
    issues,
    metadataFingerprint: computeFingerprint({
      kind: 'teiAttributes',
      fields: fields.map((f) => ({ id: f.id, valueType: f.valueType,
        required: f.required, optionSetId: f.optionSetId })),
    }),
  };
}

function normalizeValueType(
  raw: string | undefined,
  issues: CaptureParseIssue[],
  path: string,
): CaptureValueType {
  if (!raw) {
    issues.push({ severity: 'warning', code: 'MISSING_VALUE_TYPE',
      message: 'Field has no value type; defaulting to TEXT', path });
    return 'TEXT';
  }
  const upper = raw.toUpperCase() as CaptureValueType;
  if (KNOWN_VALUE_TYPES.has(upper)) return upper;
  issues.push({ severity: 'warning', code: 'UNKNOWN_VALUE_TYPE',
    message: `Unknown value type "${raw}"; falling back to TEXT`,
    path });
  return 'UNKNOWN';
}

/**
 * Deterministic 32-bit FNV-1a hash of the canonical JSON of a
 * value. Used for metadata fingerprints — we don't need
 * cryptographic strength, we need "same input → same output,
 * different input → different output with high probability"
 * so the UI can detect metadata drift (MD-007). Pure JS so it
 * works in both the browser and the test runner.
 */
export function computeFingerprint(value: unknown): string {
  const text = canonicalJson(value);
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

/** Deterministic JSON — object keys sorted so logically-equal
 *  inputs always hash to the same fingerprint. */
function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return '[' + value.map(canonicalJson).join(',') + ']';
  }
  const keys = Object.keys(value as Record<string, unknown>).sort();
  const pairs = keys.map((k) => JSON.stringify(k) + ':'
    + canonicalJson((value as Record<string, unknown>)[k]));
  return '{' + pairs.join(',') + '}';
}
