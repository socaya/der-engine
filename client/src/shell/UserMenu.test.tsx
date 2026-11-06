import { fireEvent, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { UserMenu } from './UserMenu';
import { renderWithProviders } from '../test/renderWithProviders';
import type { SignInResponse } from '../api/edgeApi';

const user: SignInResponse = {
  userId: 'u', username: 'alice', displayName: 'Alice',
  roles: ['OPERATOR', 'ADMIN'], expiresAt: 'x',
};

afterEach(() => vi.restoreAllMocks());

describe('UserMenu', () => {
  it('renders nothing when closed', () => {
    renderWithProviders(<UserMenu open={false} onClose={() => undefined} />);
    expect(screen.queryByTestId('der-user-menu')).toBeNull();
  });

  it('renders nothing when signed-out even if open', () => {
    renderWithProviders(<UserMenu open onClose={() => undefined} />);
    expect(screen.queryByTestId('der-user-menu')).toBeNull();
  });

  it('shows name + roles + items when open and signed-in', async () => {
    renderWithProviders(<UserMenu open onClose={() => undefined} />, {
      authApi: { session: vi.fn().mockResolvedValue(user), signIn: vi.fn(), signOut: vi.fn() },
    });
    await waitFor(() =>
      expect(screen.getByTestId('der-user-menu-name')).toHaveTextContent('Alice'));
    expect(screen.getByTestId('der-user-menu-role')).toHaveTextContent('OPERATOR');
    expect(screen.getByTestId('der-user-menu-role')).toHaveTextContent('ADMIN');
    expect(screen.getByTestId('der-user-menu-session')).toHaveAttribute('href', '/session');
    expect(screen.getByTestId('der-user-menu-recent')).toHaveAttribute('href', '/recent');
    expect(screen.getByTestId('der-user-menu-signout')).toBeInTheDocument();
  });

  it('Esc fires onClose', async () => {
    const onClose = vi.fn();
    renderWithProviders(<UserMenu open onClose={onClose} />, {
      authApi: { session: vi.fn().mockResolvedValue(user), signIn: vi.fn(), signOut: vi.fn() },
    });
    await waitFor(() =>
      expect(screen.getByTestId('der-user-menu')).toBeInTheDocument());
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).toHaveBeenCalled();
  });

  it('outside mousedown fires onClose', async () => {
    const onClose = vi.fn();
    renderWithProviders(<UserMenu open onClose={onClose} />, {
      authApi: { session: vi.fn().mockResolvedValue(user), signIn: vi.fn(), signOut: vi.fn() },
    });
    await waitFor(() =>
      expect(screen.getByTestId('der-user-menu')).toBeInTheDocument());
    fireEvent.mouseDown(document.body);
    expect(onClose).toHaveBeenCalled();
  });

  it('inside mousedown does NOT fire onClose', async () => {
    const onClose = vi.fn();
    renderWithProviders(<UserMenu open onClose={onClose} />, {
      authApi: { session: vi.fn().mockResolvedValue(user), signIn: vi.fn(), signOut: vi.fn() },
    });
    await waitFor(() =>
      expect(screen.getByTestId('der-user-menu')).toBeInTheDocument());
    fireEvent.mouseDown(screen.getByTestId('der-user-menu'));
    expect(onClose).not.toHaveBeenCalled();
  });

  it('Sign out calls api.signOut + closes', async () => {
    const signOut = vi.fn().mockResolvedValue(undefined);
    const onClose = vi.fn();
    renderWithProviders(<UserMenu open onClose={onClose} />, {
      authApi: { session: vi.fn().mockResolvedValue(user), signIn: vi.fn(), signOut },
    });
    await waitFor(() =>
      expect(screen.getByTestId('der-user-menu-signout')).toBeInTheDocument());
    fireEvent.click(screen.getByTestId('der-user-menu-signout'));
    await waitFor(() => {
      expect(signOut).toHaveBeenCalled();
      expect(onClose).toHaveBeenCalled();
    });
  });

  it('Sign out closes even when the api throws', async () => {
    const signOut = vi.fn().mockRejectedValue(new Error('boom'));
    const onClose = vi.fn();
    renderWithProviders(<UserMenu open onClose={onClose} />, {
      authApi: { session: vi.fn().mockResolvedValue(user), signIn: vi.fn(), signOut },
    });
    await waitFor(() =>
      expect(screen.getByTestId('der-user-menu-signout')).toBeInTheDocument());
    fireEvent.click(screen.getByTestId('der-user-menu-signout'));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });
});
