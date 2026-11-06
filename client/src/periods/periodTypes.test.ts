import { describe, expect, it } from 'vitest';
import {
  generatePeriods,
  isSupportedPeriodType,
  type PeriodType,
} from './periodTypes';

const ANCHOR = new Date(Date.UTC(2026, 10, 6)); // 2026-11-06

describe('generatePeriods', () => {
  it('Daily: 3 periods ending at anchor', () => {
    const p = generatePeriods('Daily', 3, ANCHOR);
    expect(p[0].id).toBe('20261106');
    expect(p[1].id).toBe('20261105');
    expect(p[2].id).toBe('20261104');
    expect(p[0].label).toBe('2026-11-06');
  });

  it('Monthly: produces YYYYMM ids', () => {
    const p = generatePeriods('Monthly', 3, ANCHOR);
    expect(p.map((x) => x.id)).toEqual(['202611', '202610', '202609']);
    expect(p[0].label).toBe('November 2026');
  });

  it('Quarterly: Q1-Q4 ids relative to anchor', () => {
    const p = generatePeriods('Quarterly', 2, new Date(Date.UTC(2026, 7, 1)));
    expect(p[0].id).toBe('2026Q3');
    expect(p[0].label).toBe('Q3 2026');
    expect(p[1].id).toBe('2026Q2');
  });

  it('Weekly: ISO-week ids', () => {
    const p = generatePeriods('Weekly', 1, ANCHOR);
    expect(p[0].id).toMatch(/^2026W\d+$/);
  });

  it('WeeklyWednesday falls through to the Weekly formatter', () => {
    const p = generatePeriods('WeeklyWednesday', 1, ANCHOR);
    expect(p[0].id).toMatch(/^2026W\d+$/);
  });

  it('BiWeekly: 2 bi-weeks relative to anchor', () => {
    const p = generatePeriods('BiWeekly', 2, ANCHOR);
    expect(p[0].id).toMatch(/^2026BiW\d+$/);
    expect(p[1].id).toMatch(/^2026BiW\d+$/);
  });

  it('BiMonthly: returns 2-month bi-month ids', () => {
    const p = generatePeriods('BiMonthly', 2, new Date(Date.UTC(2026, 10, 1)));
    expect(p[0].id).toMatch(/^2026\d{2}B$/);
  });

  it('SixMonthly: S1 for Jan-Jun, S2 for Jul-Dec', () => {
    const p1 = generatePeriods('SixMonthly', 1, new Date(Date.UTC(2026, 2, 1)));
    expect(p1[0].id).toBe('2026S1');
    const p2 = generatePeriods('SixMonthly', 1, new Date(Date.UTC(2026, 9, 1)));
    expect(p2[0].id).toBe('2026S2');
  });

  it('SixMonthlyApril: S1 for Apr-Sep, S2 for Oct-Mar', () => {
    const p1 = generatePeriods('SixMonthlyApril', 1, new Date(Date.UTC(2026, 5, 1)));
    expect(p1[0].id).toBe('2026AprilS1');
    const p2 = generatePeriods('SixMonthlyApril', 1, new Date(Date.UTC(2026, 10, 1)));
    expect(p2[0].id).toBe('2026AprilS2');
    const p3 = generatePeriods('SixMonthlyApril', 1, new Date(Date.UTC(2026, 1, 1)));
    expect(p3[0].id).toBe('2025AprilS2');
  });

  it('Yearly: anchor year + previous', () => {
    const p = generatePeriods('Yearly', 2, ANCHOR);
    expect(p.map((x) => x.id)).toEqual(['2026', '2025']);
  });

  it('FinancialApril: year starts April', () => {
    const march = generatePeriods('FinancialApril', 1, new Date(Date.UTC(2026, 2, 1)));
    expect(march[0].id).toBe('2025April');
    const may = generatePeriods('FinancialApril', 1, new Date(Date.UTC(2026, 4, 1)));
    expect(may[0].id).toBe('2026April');
  });

  it('FinancialJuly: year starts July', () => {
    const june = generatePeriods('FinancialJuly', 1, new Date(Date.UTC(2026, 5, 1)));
    expect(june[0].id).toBe('2025July');
  });

  it('FinancialOct: year starts October', () => {
    const sep = generatePeriods('FinancialOct', 1, new Date(Date.UTC(2026, 8, 1)));
    expect(sep[0].id).toBe('2025Oct');
  });
});

describe('isSupportedPeriodType', () => {
  it('accepts every supported literal', () => {
    const literals: PeriodType[] = [
      'Daily', 'Weekly', 'WeeklyWednesday', 'WeeklyThursday',
      'WeeklySaturday', 'WeeklySunday', 'BiWeekly', 'Monthly',
      'BiMonthly', 'Quarterly', 'SixMonthly', 'SixMonthlyApril',
      'Yearly', 'FinancialApril', 'FinancialJuly', 'FinancialOct',
    ];
    for (const l of literals) {
      expect(isSupportedPeriodType(l)).toBe(true);
    }
  });

  it('rejects null, undefined, and unknown strings', () => {
    expect(isSupportedPeriodType(null)).toBe(false);
    expect(isSupportedPeriodType(undefined)).toBe(false);
    expect(isSupportedPeriodType('Fortnightly')).toBe(false);
  });
});
