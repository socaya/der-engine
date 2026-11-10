import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

/** Soft, modern, DER-themed date picker. Replaces the native
 *  `<input type="date">` browser widget with a popover calendar
 *  that honours the DER palette tokens (surface, border-soft,
 *  success, text, text-muted). The visible field keeps the same
 *  shape as the inputs it replaces — className, data-test, name,
 *  min/max, required and disabled all flow through — so swapping
 *  is a drop-in at each call site.
 *
 *  Keyboard model when the popover is open:
 *   ←/→ / ↑/↓   move focus one day / one week
 *   PageUp/Dn   previous / next month
 *   Shift+PgUp  previous year; Shift+PgDn next year
 *   Home/End    week start / week end
 *   Enter/Space select focused day
 *   Escape      close without committing
 *
 *  Values are always ISO YYYY-MM-DD (date only, no timezone), the
 *  same shape native `<input type="date">` emits. */
export function DerDatePicker(
  { value, onChange, min, max, required, disabled, readOnly,
    placeholder, className, id, name, 'data-test': dataTest,
    autoFocus, onBlur }: {
    value: string;
    onChange: (iso: string) => void;
    min?: string;
    max?: string;
    required?: boolean;
    disabled?: boolean;
    readOnly?: boolean;
    placeholder?: string;
    className?: string;
    id?: string;
    name?: string;
    'data-test'?: string;
    autoFocus?: boolean;
    onBlur?: () => void;
  },
): JSX.Element {
  const [open, setOpen] = useState<boolean>(false);
  const [viewYm, setViewYm] = useState<{ y: number; m: number }>(() =>
    initialView(value));
  const [focusIso, setFocusIso] = useState<string>(value || todayIso());
  const rootRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (value) {
      const d = parseIso(value);
      if (d) {
        setViewYm({ y: d.getFullYear(), m: d.getMonth() });
        setFocusIso(value);
      }
    }
  }, [value]);

  useEffect(() => {
    if (!open) return;
    function onDocClick(e: MouseEvent): void {
      if (!rootRef.current) return;
      if (!rootRef.current.contains(e.target as Node)) {
        setOpen(false);
        if (onBlur) onBlur();
      }
    }
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [open, onBlur]);

  const openIfEditable = useCallback((): void => {
    if (disabled || readOnly) return;
    setOpen(true);
    const base = value ? parseIso(value) : null;
    if (base) {
      setViewYm({ y: base.getFullYear(), m: base.getMonth() });
    }
    setFocusIso((cur) => value || cur || todayIso());
  }, [disabled, readOnly, value]);

  const commit = useCallback((iso: string): void => {
    if (!isWithin(iso, min, max)) return;
    onChange(iso);
    setOpen(false);
    inputRef.current?.focus();
  }, [onChange, min, max]);

  const onFieldKey = (e: React.KeyboardEvent<HTMLInputElement>): void => {
    if (e.key === 'Enter' || e.key === ' '
        || e.key === 'ArrowDown') {
      e.preventDefault();
      openIfEditable();
    }
  };

  const onGridKey = (e: React.KeyboardEvent<HTMLDivElement>): void => {
    if (!open) return;
    const cur = parseIso(focusIso) ?? new Date();
    const next = new Date(cur);
    let handled = true;
    if (e.key === 'ArrowLeft') next.setDate(cur.getDate() - 1);
    else if (e.key === 'ArrowRight') next.setDate(cur.getDate() + 1);
    else if (e.key === 'ArrowUp') next.setDate(cur.getDate() - 7);
    else if (e.key === 'ArrowDown') next.setDate(cur.getDate() + 7);
    else if (e.key === 'PageUp' && e.shiftKey) next.setFullYear(cur.getFullYear() - 1);
    else if (e.key === 'PageDown' && e.shiftKey) next.setFullYear(cur.getFullYear() + 1);
    else if (e.key === 'PageUp') next.setMonth(cur.getMonth() - 1);
    else if (e.key === 'PageDown') next.setMonth(cur.getMonth() + 1);
    else if (e.key === 'Home') next.setDate(cur.getDate() - cur.getDay());
    else if (e.key === 'End') next.setDate(cur.getDate() + (6 - cur.getDay()));
    else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      commit(focusIso);
      return;
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setOpen(false);
      inputRef.current?.focus();
      return;
    } else {
      handled = false;
    }
    if (handled) {
      e.preventDefault();
      const iso = toIso(next);
      setFocusIso(iso);
      setViewYm({ y: next.getFullYear(), m: next.getMonth() });
    }
  };

  const grid = useMemo(
    () => buildMonthGrid(viewYm.y, viewYm.m),
    [viewYm]);

  const monthLabel = new Date(viewYm.y, viewYm.m, 1)
    .toLocaleDateString(undefined, { month: 'long', year: 'numeric' });

  return (
    <div className={'der-dp' + (open ? ' is-open' : '')
      + (disabled ? ' is-disabled' : '')}
         ref={rootRef}>
      <input
        ref={inputRef}
        type="text"
        inputMode="numeric"
        autoComplete="off"
        className={className}
        id={id}
        name={name}
        data-test={dataTest}
        placeholder={placeholder ?? 'YYYY-MM-DD'}
        value={value ?? ''}
        onChange={(e) => {
          const v = e.target.value;
          if (v === '' || /^\d{4}-\d{2}-\d{2}$/.test(v)) {
            onChange(v);
          }
        }}
        onClick={openIfEditable}
        onFocus={openIfEditable}
        onKeyDown={onFieldKey}
        required={required}
        disabled={disabled}
        readOnly={readOnly}
        autoFocus={autoFocus}
        aria-haspopup="dialog"
        aria-expanded={open} />
      <span className="der-dp__icon" aria-hidden="true">
        <svg viewBox="0 0 24 24" width="14" height="14"
             fill="none" stroke="currentColor" strokeWidth="1.75"
             strokeLinecap="round" strokeLinejoin="round">
          <rect x="4" y="5" width="16" height="15" rx="2" />
          <path d="M8 3v4M16 3v4M4 10h16" />
        </svg>
      </span>
      {open && !disabled && !readOnly && (
        <div className="der-dp__pop" role="dialog" aria-label="Pick a date"
             onKeyDown={onGridKey}
             tabIndex={-1}>
          <div className="der-dp__head">
            <button type="button" className="der-dp__nav"
                    aria-label="Previous month"
                    onClick={() => setViewYm((s) => shiftMonth(s, -1))}>
              ‹
            </button>
            <span className="der-dp__title">{monthLabel}</span>
            <button type="button" className="der-dp__nav"
                    aria-label="Next month"
                    onClick={() => setViewYm((s) => shiftMonth(s, 1))}>
              ›
            </button>
          </div>
          <div className="der-dp__dow">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
              .map((d) => (
                <span key={d} className="der-dp__dow-cell">{d[0]}</span>
              ))}
          </div>
          <div className="der-dp__grid">
            {grid.map((d) => {
              const iso = toIso(d);
              const inMonth = d.getMonth() === viewYm.m;
              const isToday = iso === todayIso();
              const isSel = iso === value;
              const isFocus = iso === focusIso;
              const disabledDay = !isWithin(iso, min, max);
              return (
                <button key={iso}
                        type="button"
                        className={'der-dp__day'
                          + (inMonth ? '' : ' is-other')
                          + (isToday ? ' is-today' : '')
                          + (isSel ? ' is-selected' : '')
                          + (isFocus ? ' is-focus' : '')
                          + (disabledDay ? ' is-disabled' : '')}
                        onClick={() => { if (!disabledDay) commit(iso); }}
                        disabled={disabledDay}
                        aria-selected={isSel}
                        tabIndex={isFocus ? 0 : -1}>
                  {d.getDate()}
                </button>
              );
            })}
          </div>
          <div className="der-dp__foot">
            <button type="button" className="der-dp__linklike"
                    onClick={() => commit(todayIso())}>
              Today
            </button>
            {value && (
              <button type="button" className="der-dp__linklike"
                      onClick={() => commit('')}>
                Clear
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function todayIso(): string { return toIso(new Date()); }
function toIso(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
}
function parseIso(iso: string): Date | null {
  if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return null;
  const [y, m, d] = iso.split('-').map((n) => parseInt(n, 10));
  const dt = new Date(y!, m! - 1, d!);
  return Number.isNaN(dt.getTime()) ? null : dt;
}
function initialView(iso: string): { y: number; m: number } {
  const d = parseIso(iso) ?? new Date();
  return { y: d.getFullYear(), m: d.getMonth() };
}
function shiftMonth(s: { y: number; m: number }, delta: number
): { y: number; m: number } {
  const d = new Date(s.y, s.m + delta, 1);
  return { y: d.getFullYear(), m: d.getMonth() };
}
function isWithin(iso: string, min?: string, max?: string): boolean {
  if (!iso) return true;
  if (min && iso < min) return false;
  if (max && iso > max) return false;
  return true;
}
/** 6×7 grid starting on Sunday of the week that contains day 1. */
function buildMonthGrid(y: number, m: number): Date[] {
  const first = new Date(y, m, 1);
  const start = new Date(first);
  start.setDate(1 - first.getDay());
  const out: Date[] = [];
  for (let i = 0; i < 42; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    out.push(d);
  }
  return out;
}
