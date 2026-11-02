/**
 * §2.3.102 R-P — Occurred-at date-range picker.
 *
 * Two inline <input type="date"> fields with "from" / "to" labels.
 * Clearing either side disables that bound. Server treats both bounds
 * as inclusive dates (interprets ?occurredFrom= as >= 00:00 and
 * ?occurredTo= as < +1 day on timestamp columns).
 *
 * The component is intentionally dumb — parents own the state and
 * read URL search params / server filters.
 */
export function DateRangePicker(
  { from, to, onChange, dataTest }:
    {
      from: string;
      to: string;
      onChange(next: { from: string; to: string }): void;
      dataTest?: string;
    },
): JSX.Element {
  return (
    <>
      <ShortcutButton label="Today"
                        onClick={() => onChange(todayRange())}
                        dataTest={`${dataTest ?? 'range'}-shortcut-today`} />
      <ShortcutButton label="Yesterday"
                        onClick={() => onChange(yesterdayRange())}
                        dataTest={`${dataTest ?? 'range'}-shortcut-yesterday`} />
      <ShortcutButton label="This week"
                        onClick={() => onChange(thisWeekRange())}
                        dataTest={`${dataTest ?? 'range'}-shortcut-week`} />
      <ShortcutButton label="Last week"
                        onClick={() => onChange(lastWeekRange())}
                        dataTest={`${dataTest ?? 'range'}-shortcut-lastweek`} />
      <ShortcutButton label="This month"
                        onClick={() => onChange(thisMonthRange())}
                        dataTest={`${dataTest ?? 'range'}-shortcut-month`} />
      <ShortcutButton label="Last 30 days"
                        onClick={() => onChange(last30Range())}
                        dataTest={`${dataTest ?? 'range'}-shortcut-30d`} />
      <input type="date"
              className="ea-input ea-mono"
              style={{ maxWidth: 150 }}
              value={from}
              onChange={(e) => onChange({ from: e.target.value, to })}
              title="Occurred on or after"
              data-test={`${dataTest ?? 'range'}-from`} />
      <input type="date"
              className="ea-input ea-mono"
              style={{ maxWidth: 150 }}
              value={to}
              onChange={(e) => onChange({ from, to: e.target.value })}
              title="Occurred on or before"
              data-test={`${dataTest ?? 'range'}-to`} />
    </>
  );
}

function ShortcutButton(
  { label, onClick, dataTest }:
    { label: string; onClick(): void; dataTest?: string },
): JSX.Element {
  return (
    <button type="button"
             className="ea-btn ea-btn--ghost ea-btn--sm"
             onClick={onClick}
             data-test={dataTest}>
      {label}
    </button>
  );
}

/* -------- range generators (local time, ISO date YYYY-MM-DD) -------- */

function iso(d: Date): string {
  const y = d.getFullYear();
  const m = (d.getMonth() + 1).toString().padStart(2, '0');
  const dd = d.getDate().toString().padStart(2, '0');
  return `${y}-${m}-${dd}`;
}

function todayRange(): { from: string; to: string } {
  const t = iso(new Date());
  return { from: t, to: t };
}

function yesterdayRange(): { from: string; to: string } {
  const y = new Date();
  y.setDate(y.getDate() - 1);
  const s = iso(y);
  return { from: s, to: s };
}

function thisWeekRange(): { from: string; to: string } {
  // ISO week: Monday is day 1. JavaScript getDay() returns 0 for
  // Sunday, so (day + 6) % 7 shifts to Monday-indexed 0..6.
  const now = new Date();
  const offset = (now.getDay() + 6) % 7;
  const mon = new Date(now);
  mon.setDate(now.getDate() - offset);
  return { from: iso(mon), to: iso(now) };
}

function lastWeekRange(): { from: string; to: string } {
  // Previous ISO week: Monday–Sunday of the week before this one.
  const now = new Date();
  const offset = (now.getDay() + 6) % 7;        // today's position in ISO-Mon week
  const thisMon = new Date(now);
  thisMon.setDate(now.getDate() - offset);
  const lastMon = new Date(thisMon);
  lastMon.setDate(thisMon.getDate() - 7);
  const lastSun = new Date(thisMon);
  lastSun.setDate(thisMon.getDate() - 1);
  return { from: iso(lastMon), to: iso(lastSun) };
}

function thisMonthRange(): { from: string; to: string } {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  return { from: iso(start), to: iso(now) };
}

function last30Range(): { from: string; to: string } {
  const now = new Date();
  const start = new Date(now);
  start.setDate(now.getDate() - 29);
  return { from: iso(start), to: iso(now) };
}
