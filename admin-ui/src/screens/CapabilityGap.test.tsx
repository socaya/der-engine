import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { CapabilityGap } from './CapabilityGap';

function wrap(route: string, pattern = route): JSX.Element {
  return (
    <MemoryRouter initialEntries={[route]}>
      <Routes>
        <Route path={pattern} element={<CapabilityGap />} />
      </Routes>
    </MemoryRouter>
  );
}

describe('CapabilityGap', () => {
  it('renders the gap panel with route + "not available" chip', () => {
    render(wrap('/some/unimplemented'));
    expect(screen.getByTestId('capability-gap')).toBeInTheDocument();
    expect(screen.getByText(/Capability not available/)).toBeInTheDocument();
    expect(screen.getAllByText(/not available/).length).toBeGreaterThan(0);
    /* Route echoed back — appears in route code + label fallback. */
    expect(screen.getAllByText('/some/unimplemented').length).toBeGreaterThan(0);
  });

  it('Label field falls back to pathname when :label param absent', () => {
    render(wrap('/path-only'));
    /* With no :label in the pattern, the title defaults to pathname. */
    expect(screen.getAllByText('/path-only').length).toBeGreaterThan(0);
  });

  it(':label URL param surfaces as the Label field', () => {
    render(wrap('/gap/Settings', '/gap/:label'));
    expect(screen.getByText('Settings')).toBeInTheDocument();
  });

  it('renders the warning icon wrapped in aria-hidden div', () => {
    const { container } = render(wrap('/anywhere'));
    /* The icon sits inside an aria-hidden parent, not on the svg. */
    const hidden = container.querySelector('[aria-hidden="true"]');
    expect(hidden).not.toBeNull();
    expect(hidden?.querySelector('svg')).not.toBeNull();
  });
});
