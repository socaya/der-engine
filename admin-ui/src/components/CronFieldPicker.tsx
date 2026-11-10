import { useEffect, useMemo, useState } from 'react';

/**
 * UI-12 — Visual per-field cron editor.
 *
 * <p>Six selectors (seconds / minutes / hours / day-of-month /
 * month / day-of-week) with four modes each:
 * <ul>
 *   <li>Every — contributes <code>*</code></li>
 *   <li>Every N — contributes <code>*&#47;N</code></li>
 *   <li>Specific — one value or comma list ("1,15,30")</li>
 *   <li>Range — <code>a-b</code></li>
 * </ul>
 * Day-of-month and day-of-week additionally support "Ignore"
 * which emits <code>?</code> (Quartz requires one of the two to
 * be <code>?</code>).</p>
 *
 * <p>The component owns a derived cron string via
 * {@link #onChange}; parent components get a plain Quartz 6-field
 * expression and never need to know about the field abstraction.
 * On mount the current {@link #value} is parsed back into field
 * state so round-trips are lossless for any string this editor
 * could have produced.</p>
 */

type FieldKey = 'seconds' | 'minutes' | 'hours'
              | 'dayOfMonth' | 'month' | 'dayOfWeek';

type FieldMode = 'ANY' | 'EVERY_N' | 'SPECIFIC' | 'RANGE' | 'IGNORE';

interface FieldSpec {
  mode: FieldMode;
  n: number;      // for EVERY_N
  specific: string; // for SPECIFIC (comma list)
  from: string;   // for RANGE
  to: string;     // for RANGE
}

interface FieldDef {
  key: FieldKey;
  label: string;
  min: number;
  max: number;
  /** allow the IGNORE (?) mode */
  ignorable: boolean;
  /** humanised note shown under the field */
  hint?: string;
}

const FIELDS: ReadonlyArray<FieldDef> = [
  { key: 'seconds',    label: 'Seconds',      min: 0, max: 59, ignorable: false },
  { key: 'minutes',    label: 'Minutes',      min: 0, max: 59, ignorable: false },
  { key: 'hours',      label: 'Hours',        min: 0, max: 23, ignorable: false },
  { key: 'dayOfMonth', label: 'Day of month', min: 1, max: 31, ignorable: true,
    hint: 'Pick a day or ignore this field' },
  { key: 'month',      label: 'Month',        min: 1, max: 12, ignorable: false },
  { key: 'dayOfWeek',  label: 'Day of week',  min: 1, max: 7,  ignorable: true,
    hint: 'Pick a weekday or ignore this field' },
];

const EMPTY: FieldSpec = { mode: 'ANY', n: 5, specific: '0', from: '0', to: '0' };

export function CronFieldPicker(
  { value, onChange }:
  { value: string; onChange: (cron: string) => void },
): JSX.Element {
  const [fields, setFields] = useState<Record<FieldKey, FieldSpec>>(
    () => parseCron(value));

  // When an outside value change happens (preset pick), re-sync.
  useEffect(() => {
    const parsed = parseCron(value);
    setFields(parsed);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  const composed = useMemo(() => composeCron(fields), [fields]);

  // Enforce Quartz invariant: exactly one of dayOfMonth / dayOfWeek
  // must be '?'. If both are non-ignore, default dow → IGNORE.
  function patch(key: FieldKey, next: FieldSpec): void {
    setFields((prev) => {
      const updated: Record<FieldKey, FieldSpec> = { ...prev, [key]: next };
      const domOn = updated.dayOfMonth.mode !== 'IGNORE';
      const dowOn = updated.dayOfWeek.mode !== 'IGNORE';
      if (domOn && dowOn) {
        if (key === 'dayOfMonth') updated.dayOfWeek = { ...EMPTY, mode: 'IGNORE' };
        else if (key === 'dayOfWeek') updated.dayOfMonth = { ...EMPTY, mode: 'IGNORE' };
      }
      if (!domOn && !dowOn) {
        // Both ignore is invalid; restore dom to ANY.
        updated.dayOfMonth = { ...EMPTY, mode: 'ANY' };
      }
      const cron = composeCron(updated);
      onChange(cron);
      return updated;
    });
  }

  return (
    <div data-test="cron-field-picker"
         style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ display: 'grid',
                     gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
                     gap: 8 }}>
        {FIELDS.map((f) => (
          <FieldEditor key={f.key}
                       def={f}
                       value={fields[f.key]}
                       onChange={(v) => patch(f.key, v)} />
        ))}
      </div>
      <code data-test="cron-field-picker-output"
            style={{ fontSize: 11, color: 'var(--der-text-muted, #6b7280)',
                      padding: '4px 8px',
                      background: 'var(--der-surface-subtle, #f5f7fb)',
                      borderRadius: 4 }}>
        {composed}
      </code>
    </div>
  );
}

function FieldEditor(
  { def, value, onChange }:
  { def: FieldDef; value: FieldSpec; onChange: (v: FieldSpec) => void },
): JSX.Element {
  const availableModes: FieldMode[] = def.ignorable
    ? ['ANY', 'EVERY_N', 'SPECIFIC', 'RANGE', 'IGNORE']
    : ['ANY', 'EVERY_N', 'SPECIFIC', 'RANGE'];

  return (
    <div className="ea-cron-field"
         data-test={`cron-field-${def.key}`}
         style={{
           padding: 8,
           border: '1px solid var(--der-border-soft, #e2e6ef)',
           borderRadius: 6,
           background: 'var(--der-surface, #fff)',
         }}>
      <div style={{ display: 'flex', alignItems: 'center',
                     justifyContent: 'space-between', marginBottom: 6 }}>
        <strong style={{ fontSize: 12 }}>{def.label}</strong>
        <select value={value.mode}
                data-test={`cron-field-${def.key}-mode`}
                onChange={(e) => onChange({ ...value, mode: e.target.value as FieldMode })}
                className="ea-input"
                style={{ fontSize: 11, padding: '2px 6px',
                          height: 'auto' }}>
          {availableModes.map((m) => (
            <option key={m} value={m}>{modeLabel(m)}</option>
          ))}
        </select>
      </div>

      {value.mode === 'ANY' && (
        <span className="ea-text-muted" style={{ fontSize: 11 }}>
          Matches any value ({def.min}–{def.max}).
        </span>
      )}

      {value.mode === 'EVERY_N' && (
        <label style={{ display: 'flex', gap: 6, alignItems: 'center',
                         fontSize: 11 }}>
          <span>Every</span>
          <input type="number" min={1} max={def.max}
                 value={value.n}
                 data-test={`cron-field-${def.key}-n`}
                 onChange={(e) => onChange({ ...value, n: Math.max(1,
                   Math.min(def.max, Number(e.target.value) || 1)) })}
                 className="ea-input"
                 style={{ width: 60, fontSize: 11 }} />
          <span>{def.label.toLowerCase()}</span>
        </label>
      )}

      {value.mode === 'SPECIFIC' && (
        <label style={{ display: 'block', fontSize: 11 }}>
          <span className="ea-text-muted" style={{ fontSize: 10,
                                                     marginRight: 4 }}>
            Value(s), comma-separated
          </span>
          <input value={value.specific}
                 data-test={`cron-field-${def.key}-specific`}
                 onChange={(e) => onChange({ ...value,
                   specific: sanitiseList(e.target.value, def) })}
                 placeholder={`${def.min}, ${Math.min(def.max, def.min + 5)}, …`}
                 className="ea-input ea-mono"
                 style={{ width: '100%', fontSize: 11 }} />
        </label>
      )}

      {value.mode === 'RANGE' && (
        <div style={{ display: 'flex', gap: 6, alignItems: 'center',
                       fontSize: 11 }}>
          <input type="number" min={def.min} max={def.max}
                 value={value.from}
                 data-test={`cron-field-${def.key}-from`}
                 onChange={(e) => onChange({ ...value,
                   from: clampStr(e.target.value, def) })}
                 className="ea-input ea-mono"
                 style={{ width: 70, fontSize: 11 }} />
          <span>to</span>
          <input type="number" min={def.min} max={def.max}
                 value={value.to}
                 data-test={`cron-field-${def.key}-to`}
                 onChange={(e) => onChange({ ...value,
                   to: clampStr(e.target.value, def) })}
                 className="ea-input ea-mono"
                 style={{ width: 70, fontSize: 11 }} />
        </div>
      )}

      {value.mode === 'IGNORE' && (
        <span className="ea-text-muted" style={{ fontSize: 11 }}>
          Ignored (emits <code>?</code>).
        </span>
      )}

      {def.hint && value.mode !== 'IGNORE' && (
        <div className="ea-text-muted"
             style={{ fontSize: 10, marginTop: 4 }}>
          {def.hint}
        </div>
      )}
    </div>
  );
}

function modeLabel(m: FieldMode): string {
  switch (m) {
    case 'ANY':      return 'Every';
    case 'EVERY_N':  return 'Every N';
    case 'SPECIFIC': return 'Specific';
    case 'RANGE':    return 'Range';
    case 'IGNORE':   return 'Ignore (?)';
  }
}

function clampStr(s: string, def: FieldDef): string {
  const n = Number(s);
  if (Number.isNaN(n)) return String(def.min);
  return String(Math.max(def.min, Math.min(def.max, n)));
}

function sanitiseList(s: string, def: FieldDef): string {
  // Keep only digits + commas; clamp each piece to the field range.
  const parts = s.split(/[,\s]+/).filter((p) => p !== '');
  const kept: string[] = [];
  for (const p of parts) {
    const n = Number(p);
    if (!Number.isNaN(n) && n >= def.min && n <= def.max) {
      kept.push(String(n));
    } else if (/^[0-9]+$/.test(p)) {
      kept.push(p); // let the user keep typing; final clamp on blur
    }
  }
  return kept.join(',');
}

function fieldToStr(spec: FieldSpec, def: FieldDef): string {
  switch (spec.mode) {
    case 'ANY':      return '*';
    case 'EVERY_N':  return `*/${spec.n}`;
    case 'SPECIFIC': return spec.specific || String(def.min);
    case 'RANGE':    return `${spec.from}-${spec.to}`;
    case 'IGNORE':   return '?';
  }
}

export function composeCron(f: Record<FieldKey, FieldSpec>): string {
  const parts = FIELDS.map((def) => fieldToStr(f[def.key], def));
  return parts.join(' ');
}

export function parseCron(cron: string): Record<FieldKey, FieldSpec> {
  const tokens = (cron ?? '').trim().split(/\s+/);
  const out: Record<FieldKey, FieldSpec> = {
    seconds:    { ...EMPTY },
    minutes:    { ...EMPTY },
    hours:      { ...EMPTY },
    dayOfMonth: { ...EMPTY },
    month:      { ...EMPTY },
    dayOfWeek:  { ...EMPTY, mode: 'IGNORE' },
  };
  FIELDS.forEach((def, i) => {
    const tok = tokens[i];
    if (!tok) return;
    out[def.key] = parseToken(tok, def);
  });
  // Ensure exactly one of dom/dow is IGNORE.
  if (out.dayOfMonth.mode !== 'IGNORE' && out.dayOfWeek.mode !== 'IGNORE') {
    out.dayOfWeek = { ...EMPTY, mode: 'IGNORE' };
  }
  if (out.dayOfMonth.mode === 'IGNORE' && out.dayOfWeek.mode === 'IGNORE') {
    out.dayOfMonth = { ...EMPTY, mode: 'ANY' };
  }
  return out;
}

function parseToken(tok: string, def: FieldDef): FieldSpec {
  if (tok === '*') return { ...EMPTY, mode: 'ANY' };
  if (tok === '?') return { ...EMPTY, mode: 'IGNORE' };
  const stepMatch = tok.match(/^\*\/(\d+)$/);
  if (stepMatch) {
    return { ...EMPTY, mode: 'EVERY_N',
      n: Math.max(1, Math.min(def.max, Number(stepMatch[1]))) };
  }
  const rangeMatch = tok.match(/^(\d+)-(\d+)$/);
  if (rangeMatch) {
    return { ...EMPTY, mode: 'RANGE',
      from: rangeMatch[1]!, to: rangeMatch[2]! };
  }
  if (/^[\d,]+$/.test(tok)) {
    return { ...EMPTY, mode: 'SPECIFIC', specific: tok };
  }
  // Non-numeric forms (SUN-FRI, 2L, 15W etc.) fall through — the
  // operator can still use the custom raw text; this editor just
  // can't model them. Treat as ANY so the UI stays valid.
  return { ...EMPTY, mode: 'ANY' };
}
