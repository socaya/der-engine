import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DateRangePicker } from './DateRangePicker';

/* DateRangePicker is a pure dumb component: 6 shortcut buttons that
 * each call onChange with a computed range, plus two date inputs
 * that call onChange({from, to}) on edit. All six range generators
 * use `new Date()` so we freeze time first. */

describe('DateRangePicker', () => {
  beforeEach(() => {
    /* Wednesday 2026-11-04 — mid-week lets us hit the Monday-offset
     * branch in thisWeekRange / lastWeekRange. */
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-11-04T10:00:00Z'));
  });
  afterEach(() => { vi.useRealTimers(); });

  it('renders both from/to inputs + 6 shortcut buttons', () => {
    render(<DateRangePicker from="" to="" onChange={() => undefined} />);
    expect(screen.getByTestId('range-from')).toBeInTheDocument();
    expect(screen.getByTestId('range-to')).toBeInTheDocument();
    expect(screen.getByTestId('range-shortcut-today')).toBeInTheDocument();
    expect(screen.getByTestId('range-shortcut-yesterday')).toBeInTheDocument();
    expect(screen.getByTestId('range-shortcut-week')).toBeInTheDocument();
    expect(screen.getByTestId('range-shortcut-lastweek')).toBeInTheDocument();
    expect(screen.getByTestId('range-shortcut-month')).toBeInTheDocument();
    expect(screen.getByTestId('range-shortcut-30d')).toBeInTheDocument();
  });

  it('Today shortcut fires onChange with {today, today}', () => {
    const onChange = vi.fn();
    render(<DateRangePicker from="" to="" onChange={onChange} />);
    fireEvent.click(screen.getByTestId('range-shortcut-today'));
    expect(onChange).toHaveBeenCalledTimes(1);
    const arg = onChange.mock.calls[0][0];
    expect(arg.from).toBe(arg.to);
    expect(arg.from).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('Yesterday shortcut returns yesterday for both bounds', () => {
    const onChange = vi.fn();
    render(<DateRangePicker from="" to="" onChange={onChange} />);
    fireEvent.click(screen.getByTestId('range-shortcut-yesterday'));
    const arg = onChange.mock.calls[0][0];
    expect(arg.from).toBe(arg.to);
    /* Should be before today. */
    expect(new Date(arg.from).getTime())
      .toBeLessThan(new Date('2026-11-04').getTime());
  });

  it('This-week shortcut returns Monday → today', () => {
    const onChange = vi.fn();
    render(<DateRangePicker from="" to="" onChange={onChange} />);
    fireEvent.click(screen.getByTestId('range-shortcut-week'));
    const arg = onChange.mock.calls[0][0];
    /* From-date <= to-date. */
    expect(arg.from <= arg.to).toBe(true);
    /* From-date is a Monday (ISO 1). Node Date getDay=1 means Monday. */
    expect(new Date(arg.from + 'T12:00:00').getDay()).toBe(1);
  });

  it('Last-week shortcut returns previous Monday → previous Sunday', () => {
    const onChange = vi.fn();
    render(<DateRangePicker from="" to="" onChange={onChange} />);
    fireEvent.click(screen.getByTestId('range-shortcut-lastweek'));
    const arg = onChange.mock.calls[0][0];
    /* Both dates are 1 week before this week; from < to. */
    expect(arg.from < arg.to).toBe(true);
    /* from is a Monday, to is a Sunday. */
    expect(new Date(arg.from + 'T12:00:00').getDay()).toBe(1);
    expect(new Date(arg.to + 'T12:00:00').getDay()).toBe(0);
  });

  it('This-month shortcut returns 1st-of-month → today', () => {
    const onChange = vi.fn();
    render(<DateRangePicker from="" to="" onChange={onChange} />);
    fireEvent.click(screen.getByTestId('range-shortcut-month'));
    const arg = onChange.mock.calls[0][0];
    expect(arg.from).toMatch(/^\d{4}-\d{2}-01$/);
  });

  it('Last-30-days shortcut spans a 30-day window', () => {
    const onChange = vi.fn();
    render(<DateRangePicker from="" to="" onChange={onChange} />);
    fireEvent.click(screen.getByTestId('range-shortcut-30d'));
    const arg = onChange.mock.calls[0][0];
    const diff = (new Date(arg.to).getTime()
                   - new Date(arg.from).getTime()) / 86_400_000;
    expect(diff).toBeCloseTo(29, 0);
  });

  it('from-input onChange — preserves `to`, swaps `from`', () => {
    const onChange = vi.fn();
    render(<DateRangePicker from="2026-10-01" to="2026-10-31"
             onChange={onChange} />);
    const from = screen.getByTestId('range-from') as HTMLInputElement;
    fireEvent.change(from, { target: { value: '2026-10-15' } });
    expect(onChange).toHaveBeenCalledWith({
      from: '2026-10-15', to: '2026-10-31',
    });
  });

  it('to-input onChange — preserves `from`, swaps `to`', () => {
    const onChange = vi.fn();
    render(<DateRangePicker from="2026-10-01" to="2026-10-31"
             onChange={onChange} />);
    const to = screen.getByTestId('range-to') as HTMLInputElement;
    fireEvent.change(to, { target: { value: '2026-10-20' } });
    expect(onChange).toHaveBeenCalledWith({
      from: '2026-10-01', to: '2026-10-20',
    });
  });

  it('custom dataTest prop overrides the default "range" prefix', () => {
    render(<DateRangePicker from="" to="" onChange={() => undefined}
             dataTest="occurred" />);
    expect(screen.getByTestId('occurred-from')).toBeInTheDocument();
    expect(screen.getByTestId('occurred-to')).toBeInTheDocument();
    expect(screen.getByTestId('occurred-shortcut-today'))
      .toBeInTheDocument();
  });

  it('Monday-start-of-week — if today is Monday the offset is 0', () => {
    /* Switch system time to a Monday to exercise the (day+6)%7=0 arm. */
    vi.setSystemTime(new Date('2026-11-02T10:00:00Z'));  /* Mon */
    const onChange = vi.fn();
    render(<DateRangePicker from="" to="" onChange={onChange} />);
    fireEvent.click(screen.getByTestId('range-shortcut-week'));
    const arg = onChange.mock.calls[0][0];
    /* On a Monday, from == to (Monday to today-same-Monday). */
    expect(arg.from).toBe(arg.to);
  });
});
