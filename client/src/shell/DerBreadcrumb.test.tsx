import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { DerBreadcrumb } from './DerBreadcrumb';
import { renderWithProviders } from '../test/renderWithProviders';
import { trailFor } from './breadcrumb';

describe('trailFor', () => {
  it('returns empty on root', () => {
    expect(trailFor('/')).toEqual([]);
  });

  it('maps /capture/runs to Workflows › Capture runs', () => {
    expect(trailFor('/capture/runs').map((c) => c.label))
      .toEqual(['Workflows', 'Capture runs']);
  });

  it('maps the dynamic run-form path', () => {
    const trail = trailFor('/capture/runs/abc-123/form');
    expect(trail.map((c) => c.label))
      .toEqual(['Workflows', 'Capture runs', 'Run']);
    // The middle crumb is a back-link.
    expect(trail[1]?.to).toBe('/capture/runs');
  });

  it('maps /aggregate/entry', () => {
    expect(trailFor('/aggregate/entry').map((c) => c.label))
      .toEqual(['Data', 'Aggregate', 'Entry']);
  });

  it('maps /session + /recent', () => {
    expect(trailFor('/session').map((c) => c.label))
      .toEqual(['Administration', 'Session']);
    expect(trailFor('/recent').map((c) => c.label))
      .toEqual(['Administration', 'Recent work']);
  });

  it('returns empty for an unknown path', () => {
    expect(trailFor('/totally/unknown/path')).toEqual([]);
  });

  it('matches the metadata wildcard pattern', () => {
    expect(trailFor('/metadata/foo/bar').map((c) => c.label))
      .toEqual(['DHIS2', 'Metadata']);
  });
});

describe('DerBreadcrumb', () => {
  it('renders nothing on /', () => {
    renderWithProviders(<DerBreadcrumb />, { route: '/' });
    expect(screen.queryByTestId('der-breadcrumb')).toBeNull();
  });

  it('renders the trail + marks the last crumb aria-current', () => {
    renderWithProviders(<DerBreadcrumb />, { route: '/capture/runs' });
    expect(screen.getByTestId('der-breadcrumb')).toBeInTheDocument();
    expect(screen.getByTestId('der-breadcrumb-home')).toHaveTextContent('Home');
    expect(screen.getByTestId('der-breadcrumb-current'))
      .toHaveTextContent('Capture runs');
  });

  it('renders middle crumb as a link when it declares a `to`', () => {
    renderWithProviders(<DerBreadcrumb />,
      { route: '/capture/runs/abc-123/form' });
    const el = screen.getByText('Capture runs');
    expect(el.tagName).toBe('A');
    expect(el).toHaveAttribute('href', '/capture/runs');
  });
});
