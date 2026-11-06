import { fireEvent, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { DerTopbar } from './DerTopbar';
import { renderWithProviders } from '../test/renderWithProviders';
import type { SignInResponse } from '../api/edgeApi';

const user: SignInResponse = {
  userId: 'u', username: 'alice', displayName: 'Alice',
  roles: ['OPERATOR'], expiresAt: 'x',
};

describe('DerTopbar', () => {
  it('renders brand + bound OU + user name when signed-in', async () => {
    renderWithProviders(<DerTopbar />, {
      authApi: { session: vi.fn().mockResolvedValue(user), signIn: vi.fn(), signOut: vi.fn() },
    });
    expect(screen.getByTestId('der-topbar-brand')).toHaveTextContent('Edge Runtime');
    await waitFor(() =>
      expect(screen.getByTestId('der-topbar-orgunit')).toBeInTheDocument());
    await waitFor(() =>
      expect(screen.getByTestId('der-topbar-user')).toHaveTextContent('A'));
  });

  it('shows the unbound indicator when the edge has no OU binding', async () => {
    renderWithProviders(<DerTopbar />, { orgUnitBinding: null });
    await waitFor(() =>
      expect(screen.getByTestId('der-topbar-unbound')).toBeInTheDocument());
  });

  it('omits the user span when signed-out', async () => {
    renderWithProviders(<DerTopbar />);
    expect(screen.queryByTestId('der-topbar-user')).toBeNull();
  });

  it('launcher button fires the onLauncherClick callback', () => {
    const onLauncherClick = vi.fn();
    renderWithProviders(<DerTopbar onLauncherClick={onLauncherClick} />);
    fireEvent.click(screen.getByTestId('der-topbar-launcher'));
    expect(onLauncherClick).toHaveBeenCalledTimes(1);
  });

  it('launcher button is a no-op without a handler', () => {
    renderWithProviders(<DerTopbar />);
    // Clicking should not throw.
    fireEvent.click(screen.getByTestId('der-topbar-launcher'));
    expect(screen.getByTestId('der-topbar-launcher')).toBeInTheDocument();
  });

  it('user tile fires onUserMenuToggle + reflects aria-expanded', async () => {
    const onUserMenuToggle = vi.fn();
    renderWithProviders(
      <DerTopbar userMenuOpen onUserMenuToggle={onUserMenuToggle} />, {
        authApi: { session: vi.fn().mockResolvedValue(user), signIn: vi.fn(), signOut: vi.fn() },
      });
    await waitFor(() =>
      expect(screen.getByTestId('der-topbar-user')).toBeInTheDocument());
    const btn = screen.getByTestId('der-topbar-user');
    expect(btn).toHaveAttribute('aria-expanded', 'true');
    fireEvent.click(btn);
    expect(onUserMenuToggle).toHaveBeenCalled();
  });
});
