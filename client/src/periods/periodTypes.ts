/**
 * DHIS2 period-id generator.
 *
 * Produces DHIS2-canonical period identifiers for a given period type,
 * ending at `anchor` (default: today) and counting backwards `count`
 * steps. Used by the device-client aggregate entry to populate the
 * period picker from the dataset's periodType (fetched from the DER
 * server), so the operator never has to type a period id by hand.
 *
 * Supported types reflect the DHIS2 2.41-2.44 PeriodType vocabulary
 * DER's metadata mirror has recorded in production datasets.
 */

export type PeriodType =
  | 'Daily'
  | 'Weekly'
  | 'WeeklyWednesday'
  | 'WeeklyThursday'
  | 'WeeklySaturday'
  | 'WeeklySunday'
  | 'BiWeekly'
  | 'Monthly'
  | 'BiMonthly'
  | 'Quarterly'
  | 'SixMonthly'
  | 'SixMonthlyApril'
  | 'Yearly'
  | 'FinancialApril'
  | 'FinancialJuly'
  | 'FinancialOct';

export interface PeriodOption {
  readonly id: string;
  readonly label: string;
}

/** Format a Date as YYYYMMDD. */
function yyyymmdd(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(d.getUTCDate()).padStart(2, '0');
  return `${y}${m}${dd}`;
}

/** ISO 8601 week number (Monday-anchored). */
function isoWeek(d: Date): { year: number; week: number } {
  const date = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  // ISO: Thursday of the target week decides the year
  const day = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - day);
  const year = date.getUTCFullYear();
  const yearStart = new Date(Date.UTC(year, 0, 1));
  const week = Math.ceil(((date.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7);
  return { year, week };
}

function addDays(d: Date, days: number): Date {
  const n = new Date(d);
  n.setUTCDate(n.getUTCDate() + days);
  return n;
}

function addMonths(d: Date, months: number): Date {
  const n = new Date(d);
  n.setUTCMonth(n.getUTCMonth() + months);
  return n;
}

function monthLabel(y: number, m0: number): string {
  const names = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
  ];
  return `${names[m0]} ${y}`;
}

export function generatePeriods(
  type: PeriodType,
  count = 12,
  anchor: Date = new Date(),
): PeriodOption[] {
  const out: PeriodOption[] = [];
  switch (type) {
    case 'Daily': {
      for (let i = 0; i < count; i++) {
        const d = addDays(anchor, -i);
        out.push({ id: yyyymmdd(d), label: d.toISOString().slice(0, 10) });
      }
      break;
    }
    case 'Weekly':
    case 'WeeklyWednesday':
    case 'WeeklyThursday':
    case 'WeeklySaturday':
    case 'WeeklySunday': {
      for (let i = 0; i < count; i++) {
        const d = addDays(anchor, -i * 7);
        const { year, week } = isoWeek(d);
        out.push({ id: `${year}W${week}`, label: `Week ${week}, ${year}` });
      }
      break;
    }
    case 'BiWeekly': {
      for (let i = 0; i < count; i++) {
        const d = addDays(anchor, -i * 14);
        const { year, week } = isoWeek(d);
        const bw = Math.ceil(week / 2);
        out.push({ id: `${year}BiW${bw}`, label: `Bi-week ${bw}, ${year}` });
      }
      break;
    }
    case 'Monthly': {
      for (let i = 0; i < count; i++) {
        const d = addMonths(anchor, -i);
        const y = d.getUTCFullYear();
        const m = String(d.getUTCMonth() + 1).padStart(2, '0');
        out.push({ id: `${y}${m}`, label: monthLabel(y, d.getUTCMonth()) });
      }
      break;
    }
    case 'BiMonthly': {
      for (let i = 0; i < count; i++) {
        const d = addMonths(anchor, -i * 2);
        const y = d.getUTCFullYear();
        const bm = Math.floor(d.getUTCMonth() / 2) + 1;
        out.push({ id: `${y}${String(bm * 2 - 1).padStart(2, '0')}B`,
          label: `Bi-month ${bm}, ${y}` });
      }
      break;
    }
    case 'Quarterly': {
      for (let i = 0; i < count; i++) {
        const d = addMonths(anchor, -i * 3);
        const y = d.getUTCFullYear();
        const q = Math.floor(d.getUTCMonth() / 3) + 1;
        out.push({ id: `${y}Q${q}`, label: `Q${q} ${y}` });
      }
      break;
    }
    case 'SixMonthly': {
      for (let i = 0; i < count; i++) {
        const d = addMonths(anchor, -i * 6);
        const y = d.getUTCFullYear();
        const s = d.getUTCMonth() < 6 ? 1 : 2;
        out.push({ id: `${y}S${s}`, label: `S${s} ${y}` });
      }
      break;
    }
    case 'SixMonthlyApril': {
      // DHIS2 anchors S1 at April–September, S2 at October–March.
      for (let i = 0; i < count; i++) {
        const d = addMonths(anchor, -i * 6);
        const m = d.getUTCMonth();
        const inS1 = m >= 3 && m <= 8;
        const y = inS1 ? d.getUTCFullYear()
                        : (m >= 9 ? d.getUTCFullYear() : d.getUTCFullYear() - 1);
        const s = inS1 ? 1 : 2;
        out.push({ id: `${y}AprilS${s}`, label: `April S${s} ${y}` });
      }
      break;
    }
    case 'Yearly': {
      for (let i = 0; i < count; i++) {
        const y = anchor.getUTCFullYear() - i;
        out.push({ id: `${y}`, label: `${y}` });
      }
      break;
    }
    case 'FinancialApril':
    case 'FinancialJuly':
    case 'FinancialOct': {
      // FinancialYearApril/July/Oct use startYear + suffix.
      const suffix = type === 'FinancialApril' ? 'April'
                   : type === 'FinancialJuly'  ? 'July'
                                                : 'Oct';
      const startMonth = type === 'FinancialApril' ? 3
                       : type === 'FinancialJuly'  ? 6
                                                   : 9;
      for (let i = 0; i < count; i++) {
        const base = new Date(anchor);
        base.setUTCFullYear(anchor.getUTCFullYear() - i);
        const inThisYear = base.getUTCMonth() >= startMonth;
        const y = inThisYear ? base.getUTCFullYear() : base.getUTCFullYear() - 1;
        out.push({ id: `${y}${suffix}`, label: `FY ${suffix} ${y}` });
      }
      break;
    }
  }
  return out;
}

export function isSupportedPeriodType(s: string | null | undefined): s is PeriodType {
  return s === 'Daily' || s === 'Weekly' || s === 'WeeklyWednesday'
      || s === 'WeeklyThursday' || s === 'WeeklySaturday'
      || s === 'WeeklySunday' || s === 'BiWeekly'
      || s === 'Monthly' || s === 'BiMonthly' || s === 'Quarterly'
      || s === 'SixMonthly' || s === 'SixMonthlyApril' || s === 'Yearly'
      || s === 'FinancialApril' || s === 'FinancialJuly'
      || s === 'FinancialOct';
}
