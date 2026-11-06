import { describe, expect, it } from 'vitest';
import {
  generatePeriods,
  isSupportedPeriodType,
  type PeriodType,
} from './periodTypes';

const ANCHOR = new Date(Date.UTC(2026, 10, 6)); // Fri 2026-11-06

describe('generatePeriods — ID formats match DHIS2', () => {
  it('Daily: YYYYMMDD', () => {
    const p = generatePeriods('Daily', 3, ANCHOR);
    expect(p.map((x) => x.id)).toEqual(['20261106', '20261105', '20261104']);
  });

  it('Monthly: YYYYMM', () => {
    const p = generatePeriods('Monthly', 3, ANCHOR);
    expect(p.map((x) => x.id)).toEqual(['202611', '202610', '202609']);
  });

  it('Quarterly: YYYYQn', () => {
    const p = generatePeriods('Quarterly', 2, new Date(Date.UTC(2026, 7, 1)));
    expect(p.map((x) => x.id)).toEqual(['2026Q3', '2026Q2']);
  });

  it('QuarterlyNov: YYYYNovQn', () => {
    const p = generatePeriods('QuarterlyNov', 1, new Date(Date.UTC(2026, 10, 15)));
    expect(p[0].id).toMatch(/^2026NovQ\d$/);
  });

  it('Weekly: YYYYWn (Mon-anchored, ISO)', () => {
    const p = generatePeriods('Weekly', 1, ANCHOR);
    expect(p[0].id).toMatch(/^2026W\d+$/);
  });

  it('WeeklyWednesday / Thursday / Saturday / Sunday use their suffix', () => {
    expect(generatePeriods('WeeklyWednesday', 1, ANCHOR)[0].id)
      .toMatch(/^2026WedW\d+$/);
    expect(generatePeriods('WeeklyThursday', 1, ANCHOR)[0].id)
      .toMatch(/^2026ThuW\d+$/);
    expect(generatePeriods('WeeklySaturday', 1, ANCHOR)[0].id)
      .toMatch(/^2026SatW\d+$/);
    expect(generatePeriods('WeeklySunday', 1, ANCHOR)[0].id)
      .toMatch(/^2026SunW\d+$/);
  });

  it('BiWeekly: YYYYBiWn', () => {
    const p = generatePeriods('BiWeekly', 2, ANCHOR);
    expect(p[0].id).toMatch(/^2026BiW\d+$/);
    expect(p[1].id).toMatch(/^2026BiW\d+$/);
  });

  it('BiMonthly: YYYYMMB with odd start month', () => {
    const p = generatePeriods('BiMonthly', 2, new Date(Date.UTC(2026, 10, 15)));
    // Nov is month idx 10 → bi-month Nov-Dec starts at 11 → "202611B"
    expect(p[0].id).toBe('202611B');
    // Previous bi-month: Sep-Oct → "202609B"
    expect(p[1].id).toBe('202609B');
  });

  it('SixMonthly: YYYYSn (S1 Jan-Jun, S2 Jul-Dec)', () => {
    expect(generatePeriods('SixMonthly', 1, new Date(Date.UTC(2026, 2, 1)))[0].id).toBe('2026S1');
    expect(generatePeriods('SixMonthly', 1, new Date(Date.UTC(2026, 9, 1)))[0].id).toBe('2026S2');
  });

  it('SixMonthlyApril: YYYYAprilSn (S1 Apr-Sep, S2 Oct-Mar)', () => {
    expect(generatePeriods('SixMonthlyApril', 1, new Date(Date.UTC(2026, 5, 1)))[0].id)
      .toBe('2026AprilS1');
    expect(generatePeriods('SixMonthlyApril', 1, new Date(Date.UTC(2026, 10, 1)))[0].id)
      .toBe('2026AprilS2');
    expect(generatePeriods('SixMonthlyApril', 1, new Date(Date.UTC(2026, 1, 1)))[0].id)
      .toBe('2025AprilS2');
  });

  it('SixMonthlyNov: YYYYNovSn (S1 Nov-Apr, S2 May-Oct)', () => {
    expect(generatePeriods('SixMonthlyNov', 1, new Date(Date.UTC(2026, 10, 15)))[0].id)
      .toBe('2026NovS1');
    expect(generatePeriods('SixMonthlyNov', 1, new Date(Date.UTC(2026, 5, 1)))[0].id)
      .toBe('2026NovS2');
  });

  it('Yearly: YYYY', () => {
    expect(generatePeriods('Yearly', 2, ANCHOR).map((x) => x.id)).toEqual(['2026', '2025']);
  });

  it('Financial{April,July,Oct,Nov}: YYYY<suffix>', () => {
    expect(generatePeriods('FinancialApril', 1, new Date(Date.UTC(2026, 2, 1)))[0].id)
      .toBe('2025April');
    expect(generatePeriods('FinancialApril', 1, new Date(Date.UTC(2026, 4, 1)))[0].id)
      .toBe('2026April');
    expect(generatePeriods('FinancialJuly', 1, new Date(Date.UTC(2026, 5, 1)))[0].id)
      .toBe('2025July');
    expect(generatePeriods('FinancialOct', 1, new Date(Date.UTC(2026, 8, 1)))[0].id)
      .toBe('2025Oct');
    expect(generatePeriods('FinancialNov', 1, new Date(Date.UTC(2026, 11, 1)))[0].id)
      .toBe('2026Nov');
  });
});

describe('generatePeriods — DHIS2-style labels', () => {
  it('Daily: weekday + full month name', () => {
    const p = generatePeriods('Daily', 1, ANCHOR);
    expect(p[0].label).toBe('Friday 06 November 2026');
  });

  it('Monthly: full month name', () => {
    expect(generatePeriods('Monthly', 1, ANCHOR)[0].label).toBe('November 2026');
    expect(generatePeriods('Monthly', 1, new Date(Date.UTC(2026, 9, 15)))[0].label)
      .toBe('October 2026');
  });

  it('Quarterly: "Qn YYYY (Mon–Mon)"', () => {
    expect(generatePeriods('Quarterly', 1, new Date(Date.UTC(2026, 10, 1)))[0].label)
      .toBe('Q4 2026 (Oct–Dec)');
  });

  it('SixMonthly: "Sn YYYY (Month–Month)"', () => {
    expect(generatePeriods('SixMonthly', 1, new Date(Date.UTC(2026, 10, 1)))[0].label)
      .toBe('S2 2026 (July–December)');
  });

  it('SixMonthlyApril S2 spans two years', () => {
    expect(generatePeriods('SixMonthlyApril', 1, new Date(Date.UTC(2026, 11, 1)))[0].label)
      .toBe('S2 2026 (Oct 2026 – Mar 2027)');
  });

  it('BiMonthly: "Month–Month YYYY"', () => {
    expect(generatePeriods('BiMonthly', 1, new Date(Date.UTC(2026, 10, 15)))[0].label)
      .toBe('November–December 2026');
  });

  it('Yearly: just the year', () => {
    expect(generatePeriods('Yearly', 1, ANCHOR)[0].label).toBe('2026');
  });

  it('FinancialJuly: "July YYYY – June YYYY+1"', () => {
    expect(generatePeriods('FinancialJuly', 1, new Date(Date.UTC(2026, 7, 1)))[0].label)
      .toBe('July 2026 – June 2027');
  });

  it('Weekly label contains the date range', () => {
    const label = generatePeriods('Weekly', 1, ANCHOR)[0].label;
    expect(label).toMatch(/^Week \d+, 2026 \(.+\)$/);
  });

  it('BiWeekly label contains the 14-day range', () => {
    const label = generatePeriods('BiWeekly', 1, ANCHOR)[0].label;
    expect(label).toMatch(/^Bi-week \d+, 2026 \(.+\)$/);
  });
});

describe('isSupportedPeriodType', () => {
  it('accepts every DHIS2 PeriodType literal', () => {
    const literals: PeriodType[] = [
      'Daily', 'Weekly', 'WeeklyWednesday', 'WeeklyThursday',
      'WeeklySaturday', 'WeeklySunday', 'BiWeekly', 'Monthly',
      'BiMonthly', 'Quarterly', 'QuarterlyNov',
      'SixMonthly', 'SixMonthlyApril', 'SixMonthlyNov',
      'Yearly', 'FinancialApril', 'FinancialJuly',
      'FinancialOct', 'FinancialNov',
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
