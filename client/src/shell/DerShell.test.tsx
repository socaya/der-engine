import { fireEvent, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { DerShell } from './DerShell';
import { renderWithProviders } from '../test/renderWithProviders';
import type { SignInResponse } from '../api/edgeApi';

const user: SignInResponse = {
  userId: 'u', username: 'alice', displayName: 'Alice',
  roles: ['OPERATOR'], expiresAt: 'x',
};

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

  it('launcher button toggles the overlay', () => {
    renderWithProviders(<DerShell>x</DerShell>);
    expect(screen.queryByTestId('der-launcher')).toBeNull();
    fireEvent.click(screen.getByTestId('der-topbar-launcher'));
    expect(screen.getByTestId('der-launcher')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('der-topbar-launcher'));
    expect(screen.queryByTestId('der-launcher')).toBeNull();
  });

  it('user button toggles the menu and launcher closes', async () => {
    renderWithProviders(<DerShell>x</DerShell>, {
      authApi: { session: vi.fn().mockResolvedValue(user), signIn: vi.fn(), signOut: vi.fn() },
    });
    await waitFor(() =>
      expect(screen.getByTestId('der-topbar-user')).toBeInTheDocument());
    // Open the launcher first, then clicking the user button should
    // close the launcher and open the menu.
    fireEvent.click(screen.getByTestId('der-topbar-launcher'));
    expect(screen.getByTestId('der-launcher')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('der-topbar-user'));
    expect(screen.queryByTestId('der-launcher')).toBeNull();
    expect(screen.getByTestId('der-user-menu')).toBeInTheDocument();
  });
});
