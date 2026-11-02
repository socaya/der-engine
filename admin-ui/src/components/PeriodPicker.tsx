import { useMemo, useState } from 'react';
import {
  DhisPeriodType, PERIOD_TYPES, recentPeriods,
} from '../lib/dhis2Periods';

/**
 * §2.3.99 — DHIS2 period picker.
 *
 * Two coupled selects: a period type (Monthly / Quarterly / …) and a
 * searchable code list for that type. Changing the type regenerates
 * the code list. Matches the UX of DHIS2's own Data Entry period
 * picker.
 *
 * {@code value} is the period code (e.g. {@code 202411}, {@code
 * 2024Q4}). Empty string means "no period filter".
 */
export function PeriodPicker(
  { value, onChange, defaultType = 'Monthly', dataTest }:
    {
      value: string;
      onChange(code: string): void;
      defaultType?: DhisPeriodType;
      dataTest?: string;
    },
): JSX.Element {
  const [type, setType] = useState<DhisPeriodType>(defaultType);
  const periods = useMemo(() => recentPeriods(type, 36), [type]);

  function onTypeChange(next: DhisPeriodType): void {
    setType(next);
    // Clear the period code when the type changes — codes aren't
    // comparable across types.
    if (value) onChange('');
  }

  return (
    <>
      <select className="ea-input"
               style={{ maxWidth: 170 }}
               value={type}
               onChange={(e) => onTypeChange(e.target.value as DhisPeriodType)}
               data-test={`${dataTest ?? 'period'}-type`}>
        {PERIOD_TYPES.map((pt) => (
          <option key={pt.value} value={pt.value}>{pt.label}</option>
        ))}
      </select>
      <select className="ea-input ea-mono"
               style={{ maxWidth: 220 }}
               value={value}
               onChange={(e) => onChange(e.target.value)}
               data-test={`${dataTest ?? 'period'}-code`}>
        <option value="">Any period</option>
        {periods.map((p) => (
          <option key={p.code} value={p.code}>{p.label}</option>
        ))}
      </select>
    </>
  );
}
