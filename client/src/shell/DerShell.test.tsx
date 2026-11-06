import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { DerShell } from './DerShell';
import { renderWithProviders } from '../test/renderWithProviders';

describe('DerShell', () => {
  it('composes topbar + breadcrumb + main children slot', () => {
    renderWithProviders(
      <DerShell><div data-test="screen-slot">child</div></DerShell>,
      { route: '/capture/runs' },
    );
    expect(screen.getByTestId('der-shell')).toBeInTheDocument();
    expect(screen.getByTestId('der-topbar')).toBeInTheDocument();
    expect(screen.getByTestId('der-breadcrumb')).toBeInTheDocument();
    expect(screen.getByTestId('der-shell-main')).toBeInTheDocument();
    expect(screen.getByTestId('screen-slot')).toHaveTextContent('child');
  });

  it('hides the breadcrumb on /', () => {
    renderWithProviders(<DerShell>x</DerShell>, { route: '/' });
    expect(screen.queryByTestId('der-breadcrumb')).toBeNull();
  });
});
