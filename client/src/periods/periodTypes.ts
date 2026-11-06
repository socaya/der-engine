/**
 * DHIS2 period-id generator + presentation helper.
 *
 * Produces DHIS2-canonical period identifiers and labels for every
 * PeriodType enumerated by DHIS2 2.41 through 2.44. The label format
 * follows what DHIS2 Data Entry / Capture render in their period
 * pickers so operators recognise them from the central app.
 *
 * ID formats (authoritative — DHIS2 PeriodType reference):
 *
 *   Daily              YYYYMMDD                  20261106
 *   Weekly             YYYYWn                    2026W45    (Mon-anchored)
 *   WeeklyWednesday    YYYYWedWn                 2026WedW45
 *   WeeklyThursday     YYYYThuWn                 2026ThuW45
 *   WeeklySaturday     YYYYSatWn                 2026SatW45
 *   WeeklySunday       YYYYSunWn                 2026SunW45
 *   BiWeekly           YYYYBiWn                  2026BiW23
 *   Monthly            YYYYMM                    202611
 *   BiMonthly          YYYYMMB   (odd MM)        202611B
 *   Quarterly          YYYYQn                    2026Q4
 *   QuarterlyNov       YYYYNovQn                 2026NovQ1  (Nov anchor)
 *   SixMonthly         YYYYSn                    2026S2
 *   SixMonthlyApril    YYYYAprilSn               2026AprilS2
 *   SixMonthlyNov      YYYYNovSn                 2026NovS1
 *   Yearly             YYYY                      2026
 *   FinancialApril     YYYYApril                 2026April
 *   FinancialJuly      YYYYJuly                  2026July
 *   FinancialOct       YYYYOct                   2026Oct
 *   FinancialNov       YYYYNov                   2026Nov
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
  | 'QuarterlyNov'
  | 'SixMonthly'
  | 'SixMonthlyApril'
  | 'SixMonthlyNov'
  | 'Yearly'
  | 'FinancialApril'
  | 'FinancialJuly'
  | 'FinancialOct'
  | 'FinancialNov';

export interface PeriodOption {
  readonly id: string;
  readonly label: string;
}

const MONTHS_LONG = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
] as const;

const MONTHS_SHORT = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
] as const;

const WEEKDAY_LONG = [
  'Sunday', 'Monday', 'Tuesday', 'Wednesday',
  'Thursday', 'Friday', 'Saturday',
] as const;

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
  n.setUTCDate(1); // avoid end-of-month overflow
  n.setUTCMonth(n.getUTCMonth() + months);
  return n;
}

function weekdayBaseFor(type: PeriodType): number {
  // Anchor day-of-week for the week-ending calendar: ISO-week Mon=1..Sun=7.
  switch (type) {
    case 'WeeklyWednesday': return 3;
    case 'WeeklyThursday':  return 4;
    case 'WeeklySaturday':  return 6;
    case 'WeeklySunday':    return 7;
    case 'Weekly':
    default:                return 1;
  }
}

function weekdaySuffixFor(type: PeriodType): string {
  switch (type) {
    case 'WeeklyWednesday': return 'WedW';
    case 'WeeklyThursday':  return 'ThuW';
    case 'WeeklySaturday':  return 'SatW';
    case 'WeeklySunday':    return 'SunW';
    case 'Weekly':
    default:                return 'W';
  }
}

/** Range label like "02 Nov – 08 Nov 2026" for weekly / bi-weekly cells. */
function rangeLabel(from: Date, to: Date): string {
  const fy = from.getUTCFullYear();
  const ty = to.getUTCFullYear();
  const fd = String(from.getUTCDate()).padStart(2, '0');
  const td = String(to.getUTCDate()).padStart(2, '0');
  const fm = MONTHS_SHORT[from.getUTCMonth()];
  const tm = MONTHS_SHORT[to.getUTCMonth()];
  if (fy === ty && from.getUTCMonth() === to.getUTCMonth()) {
    return `${fd}–${td} ${tm} ${ty}`;
  }
  if (fy === ty) {
    return `${fd} ${fm} – ${td} ${tm} ${ty}`;
  }
  return `${fd} ${fm} ${fy} – ${td} ${tm} ${ty}`;
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
        const weekday = WEEKDAY_LONG[d.getUTCDay()];
        const dd = String(d.getUTCDate()).padStart(2, '0');
        const mn = MONTHS_LONG[d.getUTCMonth()];
        out.push({
          id: yyyymmdd(d),
          label: `${weekday} ${dd} ${mn} ${d.getUTCFullYear()}`,
        });
      }
      break;
    }
    case 'Weekly':
    case 'WeeklyWednesday':
    case 'WeeklyThursday':
    case 'WeeklySaturday':
    case 'WeeklySunday': {
      // Each step is a full 7 days backward from the anchor.
      const suffix = weekdaySuffixFor(type);
      const base = weekdayBaseFor(type);
      for (let i = 0; i < count; i++) {
        const d = addDays(anchor, -i * 7);
        const { year, week } = isoWeek(d);
        // Compute start-of-week date for the range label.
        const currentDow = d.getUTCDay() || 7; // Mon=1..Sun=7
        const delta = currentDow - base;
        const start = addDays(d, -((delta + 7) % 7));
        const end = addDays(start, 6);
        out.push({
          id: `${year}${suffix}${week}`,
          label: `Week ${week}, ${year} (${rangeLabel(start, end)})`,
        });
      }
      break;
    }
    case 'BiWeekly': {
      for (let i = 0; i < count; i++) {
        const d = addDays(anchor, -i * 14);
        const { year, week } = isoWeek(d);
        const bw = Math.ceil(week / 2);
        // Bi-week starts on the Monday of the odd week in the pair.
        const currentDow = d.getUTCDay() || 7;
        const monday = addDays(d, -(currentDow - 1));
        const start = (week % 2 === 0) ? addDays(monday, -7) : monday;
        const end = addDays(start, 13);
        out.push({
          id: `${year}BiW${bw}`,
          label: `Bi-week ${bw}, ${year} (${rangeLabel(start, end)})`,
        });
      }
      break;
    }
    case 'Monthly': {
      for (let i = 0; i < count; i++) {
        const d = addMonths(anchor, -i);
        const y = d.getUTCFullYear();
        const m = String(d.getUTCMonth() + 1).padStart(2, '0');
        out.push({
          id: `${y}${m}`,
          label: `${MONTHS_LONG[d.getUTCMonth()]} ${y}`,
        });
      }
      break;
    }
    case 'BiMonthly': {
      for (let i = 0; i < count; i++) {
        const d = addMonths(anchor, -i * 2);
        const bmIndex = Math.floor(d.getUTCMonth() / 2); // 0..5
        const startMonth = bmIndex * 2;                   // 0,2,4,6,8,10
        const y = d.getUTCFullYear();
        const mm = String(startMonth + 1).padStart(2, '0');
        out.push({
          id: `${y}${mm}B`,
          label: `${MONTHS_LONG[startMonth]}–${MONTHS_LONG[startMonth + 1]} ${y}`,
        });
      }
      break;
    }
    case 'Quarterly': {
      for (let i = 0; i < count; i++) {
        const d = addMonths(anchor, -i * 3);
        const y = d.getUTCFullYear();
        const q = Math.floor(d.getUTCMonth() / 3) + 1;
        const startMonth = (q - 1) * 3;
        out.push({
          id: `${y}Q${q}`,
          label: `Q${q} ${y} (${MONTHS_SHORT[startMonth]}–${MONTHS_SHORT[startMonth + 2]})`,
        });
      }
      break;
    }
    case 'QuarterlyNov': {
      // Q1 = Nov-Jan (prev year start), Q2 = Feb-Apr, Q3 = May-Jul, Q4 = Aug-Oct
      for (let i = 0; i < count; i++) {
        const d = addMonths(anchor, -i * 3);
        const month0 = d.getUTCMonth();
        const qStarts = [1, 4, 7, 10]; // Feb(1), May(4), Aug(7), Nov(10)
        let q = 1; let startMonth = 10; // default: Nov-Jan
        for (let idx = 0; idx < qStarts.length; idx++) {
          if (month0 >= qStarts[idx] && month0 < qStarts[idx] + 3) {
            q = (idx + 2) > 4 ? idx + 2 - 4 : idx + 2;
            startMonth = qStarts[idx];
            break;
          }
        }
        const year = (month0 <= 0) ? d.getUTCFullYear() - 1 : d.getUTCFullYear();
        const endMonth = (startMonth + 2) % 12;
        out.push({
          id: `${year}NovQ${q}`,
          label: `Q${q} ${year} (${MONTHS_SHORT[startMonth]}–${MONTHS_SHORT[endMonth]})`,
        });
      }
      break;
    }
    case 'SixMonthly': {
      for (let i = 0; i < count; i++) {
        const d = addMonths(anchor, -i * 6);
        const y = d.getUTCFullYear();
        const s = d.getUTCMonth() < 6 ? 1 : 2;
        const startMonth = (s - 1) * 6;
        out.push({
          id: `${y}S${s}`,
          label: `S${s} ${y} (${MONTHS_LONG[startMonth]}–${MONTHS_LONG[startMonth + 5]})`,
        });
      }
      break;
    }
    case 'SixMonthlyApril': {
      // S1 Apr-Sep (0-indexed 3-8), S2 Oct-Mar.
      for (let i = 0; i < count; i++) {
        const d = addMonths(anchor, -i * 6);
        const m = d.getUTCMonth();
        const inS1 = m >= 3 && m <= 8;
        const y = inS1 ? d.getUTCFullYear()
                        : (m >= 9 ? d.getUTCFullYear() : d.getUTCFullYear() - 1);
        const s = inS1 ? 1 : 2;
        const label = inS1
          ? `Apr–Sep ${y}`
          : `Oct ${y} – Mar ${y + 1}`;
        out.push({ id: `${y}AprilS${s}`, label: `S${s} ${y} (${label})` });
      }
      break;
    }
    case 'SixMonthlyNov': {
      // S1 Nov-Apr, S2 May-Oct.
      for (let i = 0; i < count; i++) {
        const d = addMonths(anchor, -i * 6);
        const m = d.getUTCMonth();
        const inS2 = m >= 4 && m <= 9;
        const y = inS2
          ? d.getUTCFullYear()
          : (m >= 10 ? d.getUTCFullYear() : d.getUTCFullYear() - 1);
        const s = inS2 ? 2 : 1;
        const label = inS2
          ? `May–Oct ${y}`
          : `Nov ${y} – Apr ${y + 1}`;
        out.push({ id: `${y}NovS${s}`, label: `S${s} ${y} (${label})` });
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
    case 'FinancialOct':
    case 'FinancialNov': {
      const map = {
        FinancialApril: { suffix: 'April', startMonth: 3 },
        FinancialJuly:  { suffix: 'July',  startMonth: 6 },
        FinancialOct:   { suffix: 'Oct',   startMonth: 9 },
        FinancialNov:   { suffix: 'Nov',   startMonth: 10 },
      }[type];
      for (let i = 0; i < count; i++) {
        const base = new Date(anchor);
        base.setUTCFullYear(anchor.getUTCFullYear() - i);
        const inThisYear = base.getUTCMonth() >= map.startMonth;
        const y = inThisYear ? base.getUTCFullYear() : base.getUTCFullYear() - 1;
        const endMonth = (map.startMonth + 11) % 12;
        out.push({
          id: `${y}${map.suffix}`,
          label: `${MONTHS_LONG[map.startMonth]} ${y} – ${MONTHS_LONG[endMonth]} ${y + 1}`,
        });
      }
      break;
    }
  }
  return out;
}

export function isSupportedPeriodType(s: string | null | undefined): s is PeriodType {
  switch (s) {
    case 'Daily':
    case 'Weekly':
    case 'WeeklyWednesday':
    case 'WeeklyThursday':
    case 'WeeklySaturday':
    case 'WeeklySunday':
    case 'BiWeekly':
    case 'Monthly':
    case 'BiMonthly':
    case 'Quarterly':
    case 'QuarterlyNov':
    case 'SixMonthly':
    case 'SixMonthlyApril':
    case 'SixMonthlyNov':
    case 'Yearly':
    case 'FinancialApril':
    case 'FinancialJuly':
    case 'FinancialOct':
    case 'FinancialNov':
      return true;
    default:
      return false;
  }
}
