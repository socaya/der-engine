import { describe, expect, it } from 'vitest';
import {
  hasBlockingErrors,
  validateField,
  validateForm,
} from './validation';
import type { CaptureFormAssembly, CaptureFormField } from '../api/edgeApi';

function field(partial: Partial<CaptureFormField> & { fieldRef: string }): CaptureFormField {
  return {
    fieldRef: partial.fieldRef,
    dataElementUid: partial.dataElementUid ?? partial.fieldRef,
    categoryOptionComboUid: partial.categoryOptionComboUid ?? null,
    dataElementDisplayName: partial.dataElementDisplayName ?? partial.fieldRef,
    categoryOptionComboDisplayName: partial.categoryOptionComboDisplayName ?? null,
    valueType: partial.valueType ?? 'TEXT',
    optionSetUid: partial.optionSetUid ?? null,
    requirement: partial.requirement ?? 'OPTIONAL',
  };
}

describe('validateField', () => {
  it('REQUIRED empty field is an ERROR', () => {
    const issue = validateField(
      field({ fieldRef: 'x', requirement: 'REQUIRED' }), undefined);
    expect(issue?.severity).toBe('ERROR');
    expect(issue?.message).toMatch(/required/);
  });

  it('OPTIONAL empty field passes', () => {
    expect(validateField(field({ fieldRef: 'x' }), '')).toBeNull();
  });

  it('NUMBER accepts numeric input, rejects non-numeric', () => {
    const f = field({ fieldRef: 'n', valueType: 'NUMBER' });
    expect(validateField(f, '12.5')).toBeNull();
    expect(validateField(f, 'abc')?.message).toMatch(/number/);
  });

  it('INTEGER rejects decimals', () => {
    const f = field({ fieldRef: 'n', valueType: 'INTEGER' });
    expect(validateField(f, '12')).toBeNull();
    expect(validateField(f, '1.5')?.message).toMatch(/whole/);
  });

  it('INTEGER_POSITIVE rejects zero + negatives', () => {
    const f = field({ fieldRef: 'n', valueType: 'INTEGER_POSITIVE' });
    expect(validateField(f, '1')).toBeNull();
    expect(validateField(f, '0')?.message).toMatch(/greater than zero/);
    expect(validateField(f, '-1')?.message).toMatch(/greater than zero/);
  });

  it('INTEGER_NEGATIVE rejects zero + positives', () => {
    const f = field({ fieldRef: 'n', valueType: 'INTEGER_NEGATIVE' });
    expect(validateField(f, '-1')).toBeNull();
    expect(validateField(f, '0')?.message).toMatch(/less than zero/);
    expect(validateField(f, '1')?.message).toMatch(/less than zero/);
  });

  it('INTEGER_ZERO_OR_POSITIVE accepts zero + positives, rejects negatives', () => {
    const f = field({ fieldRef: 'n', valueType: 'INTEGER_ZERO_OR_POSITIVE' });
    expect(validateField(f, '0')).toBeNull();
    expect(validateField(f, '5')).toBeNull();
    expect(validateField(f, '-1')?.message).toMatch(/zero or greater/);
  });

  it('PERCENTAGE enforces 0..100', () => {
    const f = field({ fieldRef: 'p', valueType: 'PERCENTAGE' });
    expect(validateField(f, '0')).toBeNull();
    expect(validateField(f, '100')).toBeNull();
    expect(validateField(f, '150')?.message).toMatch(/between 0 and 100/);
    expect(validateField(f, '-5')?.message).toMatch(/between 0 and 100/);
  });

  it('UNIT_INTERVAL enforces 0..1', () => {
    const f = field({ fieldRef: 'u', valueType: 'UNIT_INTERVAL' });
    expect(validateField(f, '0.5')).toBeNull();
    expect(validateField(f, '2')?.message).toMatch(/between 0 and 1/);
  });

  it('boolean values are treated as present (no empty-required error)', () => {
    const f = field({ fieldRef: 'b', valueType: 'BOOLEAN', requirement: 'REQUIRED' });
    expect(validateField(f, false)).toBeNull();
    expect(validateField(f, true)).toBeNull();
  });

  it('TEXT valueType passes through without numeric checks', () => {
    const f = field({ fieldRef: 't', valueType: 'TEXT' });
    expect(validateField(f, 'any text')).toBeNull();
  });
});

describe('validateForm + hasBlockingErrors', () => {
  function form(fields: CaptureFormField[]): CaptureFormAssembly {
    return {
      formType: 'AGGREGATE', bindingKind: 'DATA_SET', bindingUid: 'ds',
      displayName: 't', ownership: { ownerRole: null, ownerDeviceId: null, isMyStep: true },
      sections: [{ sectionUid: 's', displayName: 'S', fields }],
      upstreamContext: [],
    };
  }

  it('skips READONLY fields', () => {
    const f = field({ fieldRef: 'ro', requirement: 'READONLY' });
    const issues = validateForm(form([f]), {});
    expect(issues.size).toBe(0);
  });

  it('collects per-field issues', () => {
    const f1 = field({ fieldRef: 'req', requirement: 'REQUIRED' });
    const f2 = field({ fieldRef: 'num', valueType: 'INTEGER_POSITIVE' });
    const issues = validateForm(form([f1, f2]), { num: '-1' });
    expect(issues.get('req')?.severity).toBe('ERROR');
    expect(issues.get('num')?.message).toMatch(/greater than zero/);
  });

  it('hasBlockingErrors returns true when any issue is ERROR', () => {
    const issues = new Map([['x', { severity: 'ERROR' as const, message: 'm' }]]);
    expect(hasBlockingErrors(issues)).toBe(true);
  });

  it('hasBlockingErrors returns false when only WARNINGs', () => {
    const issues = new Map([['x', { severity: 'WARNING' as const, message: 'm' }]]);
    expect(hasBlockingErrors(issues)).toBe(false);
  });

  it('hasBlockingErrors returns false on empty map', () => {
    expect(hasBlockingErrors(new Map())).toBe(false);
  });
});
