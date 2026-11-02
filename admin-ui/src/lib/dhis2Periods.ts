/**
 * §2.3.99 — DHIS2 period-code helpers.
 *
 * The admin-UI Data screens show rows keyed by DHIS2 period codes
 * ({@code 202411}, {@code 2024Q4}, {@code 2024W47}, …). To filter
 * them, operators pick a period type and then a specific period —
 * same two-step UX DHIS2's own data entry app uses.
 *
 * This module is the shared truth for both:
 *   - the catalogue of DHIS2 period types operators can pick from, and
 *   - a {@link recentPeriods} generator that produces the N most
 *     recent valid codes for a given type (newest first) so the
 *     period dropdown is a searchable list rather than a free-text
 *     field prone to typos.
 *
 * The period formats match DHIS2 2.44's `PeriodType` outputs — see
 * {@code org.hisp.dhis.period.*} — so codes round-trip to Central
 * without any client-side massage.
 */

export type DhisPeriodType =
  | 'Daily'
  | 'Weekly'
  | 'Monthly'
  | 'BiMonthly'
  | 'Quarterly'
  | 'SixMonthly'
  | 'SixMonthlyApril'
  | 'Yearly'
  | 'FinancialApril'
  | 'FinancialJuly'
  | 'FinancialOct';

export const PERIOD_TYPES: ReadonlyArray<{
  value: DhisPeriodType;
  label: string;
}> = [
  { value: 'Daily',           label: 'Daily' },
  { value: 'Weekly',          label: 'Weekly (ISO)' },
  { value: 'Monthly',         label: 'Monthly' },
  { value: 'BiMonthly',       label: 'Bi-monthly' },
  { value: 'Quarterly',       label: 'Quarterly' },
  { value: 'SixMonthly',      label: 'Six-monthly (Jan)' },
  { value: 'SixMonthlyApril', label: 'Six-monthly (April)' },
  { value: 'Yearly',          label: 'Yearly' },
  { value: 'FinancialApril',  label: 'Financial year (April)' },
  { value: 'FinancialJuly',   label: 'Financial year (July)' },
  { value: 'FinancialOct',    label: 'Financial year (October)' },
];

export interface PeriodOption {
  readonly code: string;
  readonly label: string;
}

/** Returns the {@code count} most recent valid periods for the type,
 *  newest first. {@code now} is injected to keep generation
 *  deterministic in tests. */
export function recentPeriods(
  type: DhisPeriodType,
  count = 24,
  now: Date = new Date(),
): PeriodOption[] {
  switch (type) {
    case 'Daily':            return recentDaily(count, now);
    case 'Weekly':           return recentWeekly(count, now);
    case 'Monthly':          return recentMonthly(count, now);
    case 'BiMonthly':        return recentBiMonthly(count, now);
    case 'Quarterly':        return recentQuarterly(count, now);
    case 'SixMonthly':       return recentSixMonthly(count, now, /* jan */ 0);
    case 'SixMonthlyApril':  return recentSixMonthly(count, now, /* apr */ 3);
    case 'Yearly':           return recentYearly(count, now);
    case 'FinancialApril':   return recentFinancial(count, now, 3, 'April');
    case 'FinancialJuly':    return recentFinancial(count, now, 6, 'July');
    case 'FinancialOct':     return recentFinancial(count, now, 9, 'Oct');
    default:                 return [];
  }
}

/* -------------------------- generators -------------------------- */

function pad(n: number, w = 2): string {
  return n.toString().padStart(w, '0');
}

function recentDaily(count: number, now: Date): PeriodOption[] {
  const out: PeriodOption[] = [];
  for (let i = 0; i < count; i++) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const code = `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`;
    out.push({ code, label: `${code}` });
  }
  return out;
}

function recentMonthly(count: number, now: Date): PeriodOption[] {
  const out: PeriodOption[] = [];
  for (let i = 0; i < count; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const code = `${d.getFullYear()}${pad(d.getMonth() + 1)}`;
    const monthName = d.toLocaleString('en', { month: 'short' });
    out.push({ code, label: `${monthName} ${d.getFullYear()} (${code})` });
  }
  return out;
}

function recentBiMonthly(count: number, now: Date): PeriodOption[] {
  // DHIS2 bi-monthly codes: YYYY0M + 'B' where M is odd month (1,3,5,…).
  // Example Nov-Dec 2024 → '202406B' (6th bi-month). Pattern used
  // across the 2.44 UI apps.
  const out: PeriodOption[] = [];
  const curBi = Math.floor(now.getMonth() / 2) + 1; // 1..6
  for (let i = 0; i < count; i++) {
    const total = (now.getFullYear() * 6 + curBi - 1) - i; // 1-based → zero-based
    const year = Math.floor(total / 6);
    const bi   = (total % 6) + 1;
    const code = `${year}${pad(bi)}B`;
    out.push({ code, label: `${year} bi-${bi} (${code})` });
  }
  return out;
}

function recentQuarterly(count: number, now: Date): PeriodOption[] {
  const out: PeriodOption[] = [];
  const curQ = Math.floor(now.getMonth() / 3) + 1;
  for (let i = 0; i < count; i++) {
    const total = (now.getFullYear() * 4 + curQ - 1) - i;
    const year = Math.floor(total / 4);
    const q    = (total % 4) + 1;
    const code = `${year}Q${q}`;
    out.push({ code, label: `${code}` });
  }
  return out;
}

function recentSixMonthly(count: number, now: Date, offsetMonth: number): PeriodOption[] {
  // DHIS2: SixMonthly   → 2024S1 (Jan-Jun) / 2024S2 (Jul-Dec)
  //        SixMonthlyApril → 2024AprilS1 (Apr-Sep) / 2024AprilS2 (Oct-Mar)
  const out: PeriodOption[] = [];
  const month = (now.getMonth() - offsetMonth + 12) % 12;
  const curS = month < 6 ? 1 : 2;
  const infix = offsetMonth === 3 ? 'April' : '';
  for (let i = 0; i < count; i++) {
    const total = (now.getFullYear() * 2 + curS - 1) - i;
    const year = Math.floor(total / 2);
    const s    = (total % 2) + 1;
    const code = `${year}${infix}S${s}`;
    out.push({ code, label: `${code}` });
  }
  return out;
}

function recentYearly(count: number, now: Date): PeriodOption[] {
  const out: PeriodOption[] = [];
  for (let i = 0; i < count; i++) {
    const y = now.getFullYear() - i;
    out.push({ code: `${y}`, label: `${y}` });
  }
  return out;
}

function recentFinancial(
  count: number,
  now: Date,
  startMonthOneBased: number,
  suffix: 'April' | 'July' | 'Oct',
): PeriodOption[] {
  // Financial year labelled by its start year, e.g. 2024April =
  // Apr 2024 – Mar 2025. Current FY = year if month ≥ startMonth, else year-1.
  const curFyStart =
    now.getMonth() + 1 >= startMonthOneBased
      ? now.getFullYear()
      : now.getFullYear() - 1;
  const out: PeriodOption[] = [];
  for (let i = 0; i < count; i++) {
    const y = curFyStart - i;
    out.push({ code: `${y}${suffix}`, label: `FY ${y}/${y + 1} (${y}${suffix})` });
  }
  return out;
}

function recentWeekly(count: number, now: Date): PeriodOption[] {
  // ISO weeks: a week belongs to the year that owns its Thursday.
  const out: PeriodOption[] = [];
  const start = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
  for (let i = 0; i < count; i++) {
    const d = new Date(start);
    d.setUTCDate(d.getUTCDate() - i * 7);
    const { isoYear, isoWeek } = toIsoWeek(d);
    const code = `${isoYear}W${pad(isoWeek)}`;
    out.push({ code, label: code });
  }
  return out;
}

function toIsoWeek(d: Date): { isoYear: number; isoWeek: number } {
  // Nearest Thursday rule.
  const date = new Date(d);
  date.setUTCDate(date.getUTCDate() + 3 - ((date.getUTCDay() + 6) % 7));
  const isoYear = date.getUTCFullYear();
  const jan4 = new Date(Date.UTC(isoYear, 0, 4));
  const diffMs = date.getTime() - jan4.getTime();
  const isoWeek = 1 + Math.round(diffMs / 86400000 / 7);
  return { isoYear, isoWeek };
}
