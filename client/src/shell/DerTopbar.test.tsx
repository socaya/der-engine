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

  it('renders the queued chip when queuedCount > 0', () => {
    renderWithProviders(<DerTopbar queuedCount={3} online={false} />);
    const chip = screen.getByTestId('der-topbar-queue');
    expect(chip).toHaveTextContent('3 queued');
    expect(chip.className).toMatch(/der-topbar__queue--offline/);
    expect(chip.getAttribute('title')).toMatch(/Offline/);
  });

  it('queued chip is neutral + mentions drain when online', () => {
    renderWithProviders(<DerTopbar queuedCount={2} online />);
    const chip = screen.getByTestId('der-topbar-queue');
    expect(chip).toHaveTextContent('2 queued');
    expect(chip.className).not.toMatch(/der-topbar__queue--offline/);
    expect(chip.getAttribute('title')).toMatch(/Draining/);
  });

  it('hides the queued chip at zero', () => {
    renderWithProviders(<DerTopbar queuedCount={0} />);
    expect(screen.queryByTestId('der-topbar-queue')).toBeNull();
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
