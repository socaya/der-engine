/**
 * Live-validation helpers for D-CAP-3 capture forms.
 *
 * DHIS2 server-side validation rules (metadata/validationRule) are
 * cross-field expressions that run on the ADR-0007 rules engine when
 * data lands on the server. These helpers complement that with
 * per-field constraints the client can enforce as the operator types:
 *
 *   - REQUIRED fields must be non-empty before submit is allowed.
 *   - Numeric value types reject non-numeric input, and the
 *     INTEGER_POSITIVE / INTEGER_NEGATIVE / INTEGER_ZERO_OR_POSITIVE /
 *     PERCENTAGE / UNIT_INTERVAL ranges are checked inline.
 *   - BOOLEAN / TRUE_ONLY normalise to boolean values.
 *
 * Result is a Map<fieldRef, FieldIssue> that both the renderer (for
 * inline error text) and the screen (for the submit disable + the
 * summary strip) can consume.
 */

import type {
  CaptureFormAssembly,
  CaptureFormField,
} from '../api/edgeApi';
import type { FieldValue } from '../components/CaptureFormRenderer';

export type IssueSeverity = 'ERROR' | 'WARNING';

export interface FieldIssue {
  readonly severity: IssueSeverity;
  readonly message: string;
}

export type FieldIssueMap = ReadonlyMap<string, FieldIssue>;

const NUMBER_REGEX = /^-?\d+(\.\d+)?$/;
const INTEGER_REGEX = /^-?\d+$/;

function numericIssue(valueType: string, raw: string): FieldIssue | null {
  if (raw === '') return null;
  switch (valueType) {
    case 'NUMBER':
    case 'PERCENTAGE':
    case 'UNIT_INTERVAL':
      if (!NUMBER_REGEX.test(raw)) {
        return { severity: 'ERROR', message: 'Must be a number.' };
      }
      break;
    case 'INTEGER':
    case 'INTEGER_POSITIVE':
    case 'INTEGER_NEGATIVE':
    case 'INTEGER_ZERO_OR_POSITIVE':
      if (!INTEGER_REGEX.test(raw)) {
        return { severity: 'ERROR', message: 'Must be a whole number.' };
      }
      break;
    default:
      return null;
  }
  // Regex passed → Number() is guaranteed finite, no NaN/Infinity branch.
  const n = Number(raw);
  if (valueType === 'INTEGER_POSITIVE' && n <= 0) {
    return { severity: 'ERROR', message: 'Must be greater than zero.' };
  }
  if (valueType === 'INTEGER_NEGATIVE' && n >= 0) {
    return { severity: 'ERROR', message: 'Must be less than zero.' };
  }
  if (valueType === 'INTEGER_ZERO_OR_POSITIVE' && n < 0) {
    return { severity: 'ERROR', message: 'Must be zero or greater.' };
  }
  if (valueType === 'PERCENTAGE' && (n < 0 || n > 100)) {
    return { severity: 'ERROR', message: 'Must be between 0 and 100.' };
  }
  if (valueType === 'UNIT_INTERVAL' && (n < 0 || n > 1)) {
    return { severity: 'ERROR', message: 'Must be between 0 and 1.' };
  }
  return null;
}

/** Validate a single field against its D-CAP-3 metadata + current value. */
export function validateField(
  field: CaptureFormField,
  value: FieldValue | undefined,
): FieldIssue | null {
  const raw = value === undefined
    ? ''
    : typeof value === 'boolean' ? (value ? 'true' : 'false') : value;

  if (field.requirement === 'REQUIRED' && raw === '') {
    return { severity: 'ERROR', message: 'This field is required.' };
  }
  const n = numericIssue(field.valueType, raw);
  if (n) return n;
  return null;
}

export function validateForm(
  form: CaptureFormAssembly,
  values: Record<string, FieldValue>,
): FieldIssueMap {
  const out = new Map<string, FieldIssue>();
  for (const section of form.sections) {
    for (const field of section.fields) {
      if (field.requirement === 'READONLY') continue;
      const issue = validateField(field, values[field.fieldRef]);
      if (issue) out.set(field.fieldRef, issue);
    }
  }
  return out;
}

export function hasBlockingErrors(issues: FieldIssueMap): boolean {
  for (const { severity } of issues.values()) {
    if (severity === 'ERROR') return true;
  }
  return false;
}
