import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { Breadcrumbs } from './Breadcrumbs';

/* Breadcrumbs is a route-sensitive navigation strip. The component
 * returns null for unknown paths + the sign-in route, and renders a
 * <Link> for every crumb except the last (which is a span with
 * aria-current="page"). */

function wrap(route: string): JSX.Element {
  return (
    <MemoryRouter initialEntries={[route]}>
      <Breadcrumbs />
    </MemoryRouter>
  );
}

describe('Breadcrumbs', () => {
  it('unknown route returns null (no nav rendered)', () => {
    const { container } = render(wrap('/nowhere'));
    expect(container.querySelector('[data-test="breadcrumbs"]')).toBeNull();
  });

  it('/sign-in explicitly returns null even when the MAP has a crumb', () => {
    const { container } = render(wrap('/sign-in'));
    expect(container.querySelector('[data-test="breadcrumbs"]')).toBeNull();
  });

  it('single-crumb route renders one span (current)', () => {
    render(wrap('/journal/conflicts'));
    expect(screen.getByTestId('breadcrumbs')).toBeInTheDocument();
    expect(screen.getByText('Journal — conflicts')).toBeInTheDocument();
    /* The current-page span has aria-current="page". */
    expect(screen.getByText('Journal — conflicts').closest('span'))
      .toHaveAttribute('aria-current', 'page');
  });

  it('multi-crumb route renders links for all but the last', () => {
    render(wrap('/sync/jobs/trigger'));
    /* "Sync — jobs" is a link, "Trigger" is the current-page span. */
    expect(screen.getByRole('link', { name: 'Sync — jobs' }))
      .toBeInTheDocument();
    expect(screen.getByText('Trigger')).toBeInTheDocument();
    /* Separator "/" renders between the two. */
    expect(screen.getByText('/')).toBeInTheDocument();
  });

  it('nested audit route renders Audit → Events', () => {
    render(wrap('/audit/events'));
    expect(screen.getByRole('link', { name: 'Audit' })).toBeInTheDocument();
    expect(screen.getByText('Events')).toBeInTheDocument();
  });

  it('provisioning/users/new renders Users → Create', () => {
    render(wrap('/provisioning/users/new'));
    expect(screen.getByRole('link', { name: 'Users' })).toBeInTheDocument();
    expect(screen.getByText('Create')).toBeInTheDocument();
  });

  it('root route "/" renders the Overview crumb', () => {
    render(wrap('/'));
    expect(screen.getByText('Overview')).toBeInTheDocument();
  });

  it('settings route renders the single Settings crumb', () => {
    render(wrap('/settings'));
    expect(screen.getByText('Settings')).toBeInTheDocument();
  });
});
