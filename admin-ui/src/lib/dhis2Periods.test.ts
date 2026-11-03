import { describe, expect, it } from 'vitest';
import { PERIOD_TYPES, recentPeriods, type DhisPeriodType } from './dhis2Periods';

/** Fixed reference date for all deterministic generations.
 *  Chosen so every branch (bimonthly wrap, FY-start-month pivot,
 *  ISO-week year boundary) is exercised by at least one case. */
const NOW = new Date('2026-11-03T12:00:00Z');

describe('dhis2Periods — catalogue', () => {
  it('ships exactly the 11 DHIS2 period types', () => {
    expect(PERIOD_TYPES.map((p) => p.value)).toEqual([
      'Daily', 'Weekly', 'Monthly', 'BiMonthly', 'Quarterly',
      'SixMonthly', 'SixMonthlyApril', 'Yearly',
      'FinancialApril', 'FinancialJuly', 'FinancialOct',
    ]);
  });

  it('every entry has a non-empty label', () => {
    for (const entry of PERIOD_TYPES) {
      expect(entry.label).toBeTruthy();
      expect(entry.label.length).toBeGreaterThan(0);
    }
  });
});

describe('dhis2Periods — recentPeriods', () => {
  it('returns count items newest-first for Daily', () => {
    const out = recentPeriods('Daily', 3, NOW);
    expect(out).toHaveLength(3);
    expect(out[0].code).toBe('20261103');
    expect(out[1].code).toBe('20261102');
    expect(out[2].code).toBe('20261101');
  });

  it('returns Monthly codes in reverse-chronological order', () => {
    const out = recentPeriods('Monthly', 4, NOW);
    expect(out[0].code).toBe('202611');
    expect(out[1].code).toBe('202610');
    expect(out[2].code).toBe('202609');
    expect(out[3].code).toBe('202608');
    expect(out[0].label).toContain('Nov 2026');
  });

  it('BiMonthly uses the 1-based odd-month code with B suffix', () => {
    const out = recentPeriods('BiMonthly', 3, NOW);
    /* Nov-Dec 2026 is the 6th bi-month → 202606B */
    expect(out[0].code).toBe('202606B');
    expect(out[1].code).toBe('202605B');
    expect(out[0].label).toMatch(/2026 bi-6/);
  });

  it('Quarterly produces YYYYQn newest-first', () => {
    const out = recentPeriods('Quarterly', 2, NOW);
    expect(out[0].code).toBe('2026Q4');
    expect(out[1].code).toBe('2026Q3');
  });

  it('SixMonthly (Jan) distinguishes H1 and H2 of the year', () => {
    const out = recentPeriods('SixMonthly', 3, NOW);
    expect(out[0].code).toBe('2026S2');
    expect(out[1].code).toBe('2026S1');
    expect(out[2].code).toBe('2025S2');
  });

  it('SixMonthlyApril uses the April infix', () => {
    const out = recentPeriods('SixMonthlyApril', 2, NOW);
    /* Nov is in Oct-Mar window → S2 of FY2026Apr */
    expect(out[0].code).toContain('AprilS');
    expect(out[1].code).toContain('AprilS');
  });

  it('Yearly returns four-digit codes newest-first', () => {
    const out = recentPeriods('Yearly', 3, NOW);
    expect(out).toEqual([
      { code: '2026', label: '2026' },
      { code: '2025', label: '2025' },
      { code: '2024', label: '2024' },
    ]);
  });

  it('FinancialApril — Nov belongs to FY starting Apr of same year', () => {
    const out = recentPeriods('FinancialApril', 2, NOW);
    expect(out[0].code).toBe('2026April');
    expect(out[0].label).toContain('FY 2026/2027');
    expect(out[1].code).toBe('2025April');
  });

  it('FinancialJuly — Nov belongs to FY starting Jul of same year', () => {
    const out = recentPeriods('FinancialJuly', 2, NOW);
    expect(out[0].code).toBe('2026July');
    expect(out[1].code).toBe('2025July');
  });

  it('FinancialOct — Nov belongs to FY starting Oct of same year', () => {
    const out = recentPeriods('FinancialOct', 2, NOW);
    expect(out[0].code).toBe('2026Oct');
    expect(out[1].code).toBe('2025Oct');
  });

  it('Financial pivot: Jan belongs to prior FY', () => {
    const janNow = new Date('2026-01-15T00:00:00Z');
    const out = recentPeriods('FinancialApril', 1, janNow);
    /* Jan 2026 is still in FY2025April (Apr 2025 - Mar 2026) */
    expect(out[0].code).toBe('2025April');
  });

  it('Weekly uses ISO week numbering', () => {
    const out = recentPeriods('Weekly', 2, NOW);
    expect(out[0].code).toMatch(/^\d{4}W\d{2}$/);
    expect(out[1].code).toMatch(/^\d{4}W\d{2}$/);
  });

  it('Weekly handles the ISO year boundary (Jan 1 belonging to prior year week 52/53)', () => {
    const jan1 = new Date('2027-01-01T00:00:00Z'); // Friday
    const out = recentPeriods('Weekly', 1, jan1);
    /* Jan 1 2027 is a Friday — ISO week 53 of 2026 */
    expect(out[0].code).toBe('2026W53');
  });

  it('defaults count to 24 when omitted', () => {
    expect(recentPeriods('Monthly', undefined, NOW)).toHaveLength(24);
  });

  it('defaults now to new Date() when omitted', () => {
    /* Just assert the call doesn't throw and returns at least one entry. */
    const out = recentPeriods('Yearly');
    expect(out.length).toBeGreaterThan(0);
    expect(out[0].code).toMatch(/^\d{4}$/);
  });

  it('unknown period type returns empty array', () => {
    const bogus = 'NotAType' as DhisPeriodType;
    expect(recentPeriods(bogus, 5, NOW)).toEqual([]);
  });
});
