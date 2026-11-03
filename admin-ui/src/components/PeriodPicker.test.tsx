import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { PeriodPicker } from './PeriodPicker';

describe('PeriodPicker', () => {
  it('renders both selects + default type is Monthly', () => {
    render(<PeriodPicker value="" onChange={() => undefined}
             dataTest="pp" />);
    const typeSel = screen.getByTestId('pp-type') as HTMLSelectElement;
    const codeSel = screen.getByTestId('pp-code') as HTMLSelectElement;
    expect(typeSel.value).toBe('Monthly');
    expect(codeSel.value).toBe('');
    /* Any-period option is present. */
    expect(screen.getByText('Any period')).toBeInTheDocument();
  });

  it('changing period code fires onChange', async () => {
    const onChange = vi.fn();
    render(<PeriodPicker value="" onChange={onChange} />);
    const user = userEvent.setup();
    const codeSel = screen.getByTestId('period-code') as HTMLSelectElement;
    /* Pick the second option — the first is "Any period". */
    const opts = codeSel.querySelectorAll('option');
    expect(opts.length).toBeGreaterThan(1);
    await user.selectOptions(codeSel, opts[1].value);
    expect(onChange).toHaveBeenCalledWith(opts[1].value);
  });

  it('changing period type clears a non-empty value (onTypeChange branch)', async () => {
    const onChange = vi.fn();
    render(<PeriodPicker value="202411" onChange={onChange}
             dataTest="pp" />);
    const user = userEvent.setup();
    await user.selectOptions(screen.getByTestId('pp-type'), 'Quarterly');
    /* Value was non-empty → onChange('') fires per the clear branch. */
    expect(onChange).toHaveBeenCalledWith('');
  });

  it('changing period type with empty value does NOT fire onChange', async () => {
    const onChange = vi.fn();
    render(<PeriodPicker value="" onChange={onChange} />);
    const user = userEvent.setup();
    await user.selectOptions(screen.getByTestId('period-type'), 'Yearly');
    /* Empty-value branch skips the onChange('') call. */
    expect(onChange).not.toHaveBeenCalled();
  });

  it('defaultType override — Yearly selected on first render', () => {
    render(<PeriodPicker value="" onChange={() => undefined}
             defaultType="Yearly" />);
    const typeSel = screen.getByTestId('period-type') as HTMLSelectElement;
    expect(typeSel.value).toBe('Yearly');
  });

  it('dataTest fallback — omitted prop defaults to "period"', () => {
    render(<PeriodPicker value="" onChange={() => undefined} />);
    expect(screen.getByTestId('period-type')).toBeInTheDocument();
    expect(screen.getByTestId('period-code')).toBeInTheDocument();
  });
});
