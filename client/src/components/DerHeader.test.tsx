import { screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { DerHeader } from './DerHeader';
import { renderWithProviders } from '../test/renderWithProviders';
import type { SignInResponse } from '../api/edgeApi';

const user: SignInResponse = {
  userId: 'u', username: 'alice', displayName: 'Alice',
  roles: ['OPERATOR'], expiresAt: 'x',
};

describe('DerHeader', () => {
  it('renders brand + bound OU + user name when signed-in', async () => {
    renderWithProviders(<DerHeader />, {
      authApi: { session: vi.fn().mockResolvedValue(user), signIn: vi.fn(), signOut: vi.fn() },
    });
    expect(screen.getByTestId('der-header-brand')).toHaveTextContent('DER Edge Runtime');
    await waitFor(() =>
      expect(screen.getByTestId('der-header-orgunit')).toHaveTextContent('OU-A'));
    await waitFor(() =>
      expect(screen.getByTestId('der-header-user')).toHaveTextContent('Alice'));
  });

  it('shows the unbound indicator when the edge is not bound', async () => {
    renderWithProviders(<DerHeader />, { orgUnitBinding: null });
    await waitFor(() =>
      expect(screen.getByTestId('der-header-unbound')).toBeInTheDocument());
  });

  it('omits the user span when signed-out', async () => {
    renderWithProviders(<DerHeader />);
    expect(screen.queryByTestId('der-header-user')).toBeNull();
  });
});
